import { useMemo, useState, memo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import FunctionsIcon from '@mui/icons-material/Functions';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { resolveAssetPath } from '../../data/assetResolver';

/**
 * Render formula expression with proper subscripts/superscripts.
 * Patterns handled:
 *  - explicit subscript markers: _{…}  e.g. E_{н} → E<sub>н</sub>
 *  - explicit superscript markers: ^{…}  e.g. r^{2} → r<sup>2</sup>
 *  - Unicode subscript suffix attached to a letter: Eн, Фл, Sп, Hр, Kз, αкз etc.
 *    A capital letter or Greek followed by 1-2 lowercase Cyrillic → treat tail as subscript
 *  - Σe style (Greek + single latin lowercase)
 */
function renderFormulaExpression(expr: string): string {
  let html = expr;
  // 1) Explicit LaTeX-like markers: _{…} and ^{…}
  html = html.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  html = html.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  // 2) Shorthand: _X (single char subscript without braces)
  html = html.replace(/_([A-Za-zА-Яа-яёЁ0-9])/g, '<sub>$1</sub>');
  // 3) ^X (single char superscript without braces) — only digits/letters
  html = html.replace(/\^([A-Za-zА-Яа-яёЁ0-9])/g, '<sup>$1</sup>');
  // 4) Auto subscript: Capital or Greek letter followed by 1-3 lowercase Cyrillic
  //    e.g. Фсв → Ф<sub>св</sub>, Eн → E<sub>н</sub>, Hр → H<sub>р</sub>
  html = html.replace(
    /([A-ZА-ЯΦΣΩαβγδεηκμνωЁ])([а-яё]{1,3})(?=[^а-яё\w]|$)/g,
    (match, head: string, tail: string) => {
      // Skip real words (e.g. "Где", "лампы") — only process when head is uppercase/Greek
      // and tail is short subscript-like
      const skipWords = ['Где', 'Чем', 'Для', 'Вт/', 'все', 'тип', 'шаг', 'при', 'или', 'Это', 'Она', 'Они', 'Его', 'Все', 'Тип', 'Шаг', 'При', 'Или', 'Вт', 'Гц', 'Па', 'лм', 'лк', 'кд', 'ед', 'дБ', 'ср', 'Тл'];
      if (skipWords.includes(match)) return match;
      // Skip if tail is longer than 2 and doesn't look like a subscript
      if (tail.length === 3 && !/^[а-яё]{1,3}$/.test(tail)) return match;
      return `${head}<sub>${tail}</sub>`;
    },
  );
  return html;
}

export interface FormulaVariable {
  symbol: string;
  description: string;
  unit: string;
}

export interface FormulaExample {
  given: Record<string, number>;
  steps: string[];
  result: string;
}

export interface FormulaBlockProps {
  id?: string;
  label?: string;
  expression: string;
  imagePath?: string;
  variables: FormulaVariable[];
  example?: FormulaExample;
  explanation?: string;
}

function FormulaBlock({
  id,
  label,
  expression,
  imagePath,
  variables,
  example,
  explanation,
}: FormulaBlockProps) {
  const [showExample, setShowExample] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const resolvedImagePath = useMemo(() => resolveAssetPath(imagePath), [imagePath]);
  const hasExtraContent = Boolean(example || explanation);

  const formulaHtml = useMemo(() => renderFormulaExpression(expression), [expression]);

  return (
    <Paper
      id={id}
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: 'primary.main',
        my: 1.5,
        background: 'linear-gradient(135deg, rgba(19,83,162,0.03) 0%, transparent 100%)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <FunctionsIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" color="primary.main">
          Формула {label ?? ''}
        </Typography>
      </Stack>

      <Typography
        component="div"
        sx={{
          fontFamily: '"Cambria Math", "Latin Modern Math", serif',
          fontWeight: 500,
          fontSize: '1.15rem',
          letterSpacing: 0.5,
          my: 1,
          overflowX: 'auto',
          '& sub': { fontSize: '0.65em', verticalAlign: 'sub', lineHeight: 0 },
          '& sup': { fontSize: '0.65em', verticalAlign: 'super', lineHeight: 0 },
        }}
        dangerouslySetInnerHTML={{ __html: formulaHtml }}
      />

      {resolvedImagePath && (
        <Box
          component="img"
          src={resolvedImagePath}
          alt={`Формула ${label ?? expression}`}
          sx={{
            maxWidth: '100%',
            maxHeight: 80,
            objectFit: 'contain',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            my: 1,
          }}
          onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}

      {variables.length > 0 && (
        <>
          <Typography variant="caption" fontWeight={600} sx={{ mt: 1 }}>
            Обозначения:
          </Typography>
          <Table size="small" sx={{ mt: 0.5, '& td': { py: 0.3, borderBottom: 'none' } }}>
            <TableBody>
              {variables.map((v) => (
                <TableRow key={v.symbol}>
                  <TableCell sx={{ pl: 0, width: 60 }}>
                    <Tooltip title={v.description} arrow placement="right">
                      <Chip
                        label={
                          <span
                            dangerouslySetInnerHTML={{ __html: renderFormulaExpression(v.symbol) }}
                            style={{ fontFamily: 'serif', fontWeight: 600 }}
                          />
                        }
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{
                          '& sub': { fontSize: '0.65em', verticalAlign: 'sub', lineHeight: 0 },
                          '& sup': { fontSize: '0.65em', verticalAlign: 'super', lineHeight: 0 },
                        }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {v.description}
                      {v.unit && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          [{v.unit}]
                        </Typography>
                      )}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {hasExtraContent && <Divider sx={{ my: 1 }} />}

      <Stack direction="row" spacing={1} flexWrap="wrap">
        {example && (
          <Button
            size="small"
            variant={showExample ? 'contained' : 'outlined'}
            startIcon={<ExpandMoreIcon sx={{ transform: showExample ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
            onClick={() => setShowExample((prev) => !prev)}
          >
            Пример расчёта
          </Button>
        )}
        {explanation && (
          <Button
            size="small"
            variant={showExplanation ? 'contained' : 'outlined'}
            startIcon={<InfoOutlinedIcon />}
            onClick={() => setShowExplanation((prev) => !prev)}
          >
            Пояснить
          </Button>
        )}
      </Stack>

      <Collapse in={showExample}>
        {example && (
          <Paper variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: 'action.hover' }}>
            <Typography variant="caption" fontWeight={600}>
              Дано:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
              {Object.entries(example.given).map(([key, val]) => (
                <Chip
                  key={key}
                  label={
                    <span
                      dangerouslySetInnerHTML={{ __html: renderFormulaExpression(`${key} = ${val}`) }}
                    />
                  }
                  size="small"
                  variant="outlined"
                  sx={{
                    '& sub': { fontSize: '0.65em', verticalAlign: 'sub', lineHeight: 0 },
                    '& sup': { fontSize: '0.65em', verticalAlign: 'super', lineHeight: 0 },
                  }}
                />
              ))}
            </Stack>
            <Typography variant="caption" fontWeight={600} sx={{ mt: 1, display: 'block' }}>
              Решение:
            </Typography>
            {example.steps.map((step, i) => (
              <Typography key={i} variant="body2" sx={{ pl: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {i + 1}. {step}
              </Typography>
            ))}
            <Alert severity="success" sx={{ mt: 1, py: 0 }}>
              <Typography variant="body2" fontWeight={600}>
                {example.result}
              </Typography>
            </Alert>
          </Paper>
        )}
      </Collapse>

      <Collapse in={showExplanation}>
        {explanation && (
          <Alert severity="info" sx={{ mt: 1 }}>
            {explanation}
          </Alert>
        )}
      </Collapse>
    </Paper>
  );
}

export default memo(FormulaBlock);
