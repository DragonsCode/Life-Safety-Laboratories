import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { TestQuestion } from '../../types/theme';
import type { LessonId } from '../../types/theme';
import { useProgress } from '../../context/ProgressContext';

/* ---------- helpers ---------- */

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isCorrectAnswer(
  question: TestQuestion,
  singleAnswers: Record<string, number>,
  multiAnswers: Record<string, number[]>,
  numericAnswers: Record<string, string>,
): boolean {
  if (question.type === 'single') {
    return singleAnswers[question.id] === question.correct;
  }
  if (question.type === 'multi') {
    const selected = [...(multiAnswers[question.id] ?? [])].sort((a, b) => a - b);
    const expected = [...question.correct].sort((a, b) => a - b);
    return selected.length === expected.length && selected.every((v, i) => v === expected[i]);
  }
  const val = Number(numericAnswers[question.id]);
  return Number.isFinite(val) && Math.abs(val - question.correct) <= question.tolerance;
}

function correctAnswerLabel(question: TestQuestion): string {
  if (question.type === 'single') {
    return question.options[question.correct] ?? `вариант ${question.correct + 1}`;
  }
  if (question.type === 'multi') {
    return question.correct.map((i) => question.options[i]).join('; ');
  }
  return `${question.correct}${question.unit ? ' ' + question.unit : ''} (±${question.tolerance})`;
}

/* ---------- Component ---------- */

interface TestSectionProps {
  questions: TestQuestion[];
  lessonId?: LessonId;
}

export default function TestSection({ questions, lessonId }: TestSectionProps) {
  const progress = useProgress();
  const [order, setOrder] = useState<TestQuestion[]>(questions);
  const [singleAnswers, setSingleAnswers] = useState<Record<string, number>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, number[]>>({});
  const [numericAnswers, setNumericAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = order.length;

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const q of order) {
      if (q.type === 'single' && singleAnswers[q.id] !== undefined) count++;
      else if (q.type === 'multi' && (multiAnswers[q.id]?.length ?? 0) > 0) count++;
      else if (q.type === 'numeric' && (numericAnswers[q.id] ?? '').trim() !== '') count++;
    }
    return count;
  }, [order, singleAnswers, multiAnswers, numericAnswers]);

  const correctCount = useMemo(() => {
    if (!submitted) return 0;
    return order.filter((q) => isCorrectAnswer(q, singleAnswers, multiAnswers, numericAnswers)).length;
  }, [submitted, order, singleAnswers, multiAnswers, numericAnswers]);

  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  useEffect(() => {
    if (!submitted || !lessonId) return;
    progress.setTestScore(lessonId, score);
  }, [lessonId, progress, score, submitted]);

  const handleShuffle = useCallback(() => {
    setOrder(shuffleArray(questions));
    setSubmitted(false);
    setSingleAnswers({});
    setMultiAnswers({});
    setNumericAnswers({});
  }, [questions]);

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setSingleAnswers({});
    setMultiAnswers({});
    setNumericAnswers({});
  }, []);

  return (
    <Stack spacing={1.5}>
      {/* Progress bar */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Отвечено: {answeredCount} / {total}
          </Typography>
          {submitted && (
            <Chip
              icon={<CheckCircleOutlineIcon />}
              label={`${correctCount}/${total} верно (${score}%)`}
              color={score >= 70 ? 'success' : 'warning'}
              size="small"
            />
          )}
        </Stack>
        <LinearProgress variant="determinate" value={total > 0 ? (answeredCount / total) * 100 : 0} />
      </Paper>

      {order.map((question, index) => {
        const correct = submitted ? isCorrectAnswer(question, singleAnswers, multiAnswers, numericAnswers) : undefined;

        return (
          <Paper
            key={question.id}
            variant="outlined"
            sx={{
              p: 2,
              borderLeft: submitted ? 4 : 1,
              borderColor: submitted
                ? correct
                  ? 'success.main'
                  : 'error.main'
                : 'divider',
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {index + 1}. {question.prompt}
            </Typography>

            {question.type === 'single' && (
              <RadioGroup
                value={String(singleAnswers[question.id] ?? '')}
                onChange={(event) =>
                  setSingleAnswers((prev) => ({ ...prev, [question.id]: Number(event.target.value) }))
                }
              >
                {question.options.map((option, optionIndex) => {
                  const isOptionCorrect = submitted && optionIndex === question.correct;
                  return (
                    <FormControlLabel
                      key={`${question.id}-single-${optionIndex}`}
                      value={String(optionIndex)}
                      control={<Radio disabled={submitted} />}
                      label={
                        <Box component="span" sx={isOptionCorrect ? { fontWeight: 700, color: 'success.main' } : undefined}>
                          {option}
                        </Box>
                      }
                    />
                  );
                })}
              </RadioGroup>
            )}

            {question.type === 'multi' && (
              <Stack>
                {question.options.map((option, optionIndex) => {
                  const selectedValues = multiAnswers[question.id] ?? [];
                  const checked = selectedValues.includes(optionIndex);
                  const isOptionCorrect = submitted && question.correct.includes(optionIndex);
                  return (
                    <FormControlLabel
                      key={`${question.id}-multi-${optionIndex}`}
                      control={
                        <Checkbox
                          checked={checked}
                          disabled={submitted}
                          onChange={(event) => {
                            setMultiAnswers((prev) => {
                              const current = prev[question.id] ?? [];
                              const next = event.target.checked
                                ? [...current, optionIndex]
                                : current.filter((value) => value !== optionIndex);
                              return { ...prev, [question.id]: next };
                            });
                          }}
                        />
                      }
                      label={
                        <Box component="span" sx={isOptionCorrect ? { fontWeight: 700, color: 'success.main' } : undefined}>
                          {option}
                        </Box>
                      }
                    />
                  );
                })}
              </Stack>
            )}

            {question.type === 'numeric' && (
              <TextField
                type="number"
                size="small"
                disabled={submitted}
                label={`Числовой ответ${question.unit ? `, ${question.unit}` : ''}`}
                value={numericAnswers[question.id] ?? ''}
                onChange={(event) => setNumericAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
              />
            )}

            {submitted && (
              <Alert severity={correct ? 'success' : 'error'} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {correct ? 'Верно!' : `Неверно. Правильный ответ: ${correctAnswerLabel(question)}`}
                </Typography>
                {question.explanation && (
                  <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                    {question.explanation}
                  </Typography>
                )}
              </Alert>
            )}
          </Paper>
        );
      })}

      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => setSubmitted(true)} disabled={submitted}>
          Проверить тест
        </Button>
        <Button variant="outlined" onClick={handleReset}>
          Сброс
        </Button>
        <Button variant="outlined" startIcon={<ShuffleIcon />} onClick={handleShuffle}>
          Перемешать
        </Button>
      </Stack>

      {submitted && (
        <Alert severity={score >= 70 ? 'success' : 'warning'} sx={{ mt: 1 }}>
          <Typography variant="body1" fontWeight={600}>
            Итог: {score}% ({correctCount} из {total}).{' '}
            {score >= 70 ? 'Тест пройден!' : 'Нужно повторить материал и пересдать.'}
          </Typography>
        </Alert>
      )}
    </Stack>
  );
}

