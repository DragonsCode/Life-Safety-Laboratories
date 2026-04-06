import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { LessonId, TheoryModule } from '../../types/theme';
import FormulaBlock from './FormulaBlock';
import FigureZoom from './FigureZoom';
import TermHighlight from './TermHighlight';
import MiniSimulator from './MiniSimulator';
import {
  getKnowledgeLayer,
  toFormulaBlockProps,
  buildGlossary,
  shouldInlineGoalInTheory,
  theoryBlocksWithGoal,
} from '../../data/knowledgeLayer';
import { useProgress } from '../../context/ProgressContext';
import { getLessonById } from '../../data/lessons';

interface TheorySectionProps {
  lessonId?: LessonId;
}

export default function TheorySection({ lessonId }: TheorySectionProps) {
  const progress = useProgress();
  const knowledgeLayer = lessonId ? getKnowledgeLayer(lessonId) : undefined;
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const theoryModules = lesson?.theoryModules ?? [];
  const glossary = useMemo(() => (knowledgeLayer ? buildGlossary(knowledgeLayer) : {}), [knowledgeLayer]);
  /** Раньше «краткий режим» полностью скрывал рисунки — формулы оставались; из‑за этого казалось, что «рисунки не отображаются». */
  const [diagramsCompact, setDiagramsCompact] = useState(false);

  /* ─── Build interleaved content list ─── */
  const interleavedContent = useMemo(() => {
    if (!knowledgeLayer || !lessonId) return [];

    /* Явный порядок из contentFlow (например, занятие №11 — как в txt методички). */
    if (knowledgeLayer.contentFlow && knowledgeLayer.contentFlow.length > 0) {
      const flowItems: Array<{ type: 'theory' | 'formula' | 'figure' | 'scene'; data: unknown }> = [];
      if (shouldInlineGoalInTheory(lessonId) && knowledgeLayer.goal?.trim()) {
        flowItems.push({
          type: 'theory',
          data: {
            id: `${knowledgeLayer.id}-goal`,
            heading: 'Цель работы',
            text: knowledgeLayer.goal.trim(),
            keywords: ['цель работы'],
          },
        });
      }
      const theoryById = new Map(knowledgeLayer.theory.map((t) => [t.id, t]));
      const formulaById = new Map(knowledgeLayer.formulas.map((f) => [f.id, f]));
      const figureById = new Map(knowledgeLayer.figures.map((g) => [g.id, g]));
      for (const flow of knowledgeLayer.contentFlow) {
        if (flow.step === 'theory') {
          const b = theoryById.get(flow.blockId);
          if (b) flowItems.push({ type: 'theory', data: b });
        } else if (flow.step === 'formula') {
          const f = formulaById.get(flow.id);
          if (f) flowItems.push({ type: 'formula', data: f });
        } else {
          const fig = figureById.get(flow.id);
          if (fig) flowItems.push({ type: 'figure', data: fig });
        }
      }

      /* contentFlow раньше полностью отбрасывал 3D-сцены из theoryModules — добавляем с тем же правилом, что и без flow */
      const theoriesInFlow = knowledgeLayer.contentFlow
        .filter((s): s is { step: 'theory'; blockId: string } => s.step === 'theory')
        .map((s) => s.blockId);
      const moduleByTheoryId = new Map<string, TheoryModule>();
      const moduleCount = theoryModules.length;
      const theoryCount = theoriesInFlow.length;
      if (moduleCount > 0 && theoryCount > 0) {
        const ratio = moduleCount / theoryCount;
        theoriesInFlow.forEach((blockId, tIdx) => {
          const moduleIdx = Math.min(Math.floor(tIdx * ratio), moduleCount - 1);
          moduleByTheoryId.set(blockId, theoryModules[moduleIdx]);
        });
      }

      const merged: typeof flowItems = [];
      const usedSimulators = new Set<string>();
      for (const item of flowItems) {
        merged.push(item);
        if (item.type === 'theory') {
          const block = item.data as { id: string };
          const mod = moduleByTheoryId.get(block.id);
          if (mod && !usedSimulators.has(mod.simulator)) {
            merged.push({ type: 'scene', data: mod });
            usedSimulators.add(mod.simulator);
          }
        }
      }
      theoryModules.forEach((mod) => {
        if (!usedSimulators.has(mod.simulator)) {
          merged.push({ type: 'scene', data: mod });
          usedSimulators.add(mod.simulator);
        }
      });
      return merged;
    }

    const theoryBlocks = theoryBlocksWithGoal(knowledgeLayer, lessonId);
    const goalShift =
      shouldInlineGoalInTheory(lessonId) && knowledgeLayer.goal?.trim() ? 1 : 0;

    const items: Array<{
      type: 'theory' | 'formula' | 'figure' | 'scene';
      data: unknown;
    }> = [];

    const formulas = [...knowledgeLayer.formulas];
    const figures = [...knowledgeLayer.figures];
    const usedFormulaIds = new Set<string>();
    const usedSimulators = new Set<string>();
    let figureIndex = 0;

    /* ── Map each formula number "X.Y" → formula object ── */
    const formulaByNumber = new Map<string, (typeof formulas)[number]>();
    formulas.forEach((formula) => {
      const match = formula.label?.match(/\(?\s*(\d+\.\d+)\s*\)?/);
      if (match) formulaByNumber.set(match[1], formula);
    });

    /* ── For each theory block, collect formula numbers it references ── */
    const formulaRefPattern = /формул[а-яё]{0,4}\s*(\d+\.\d+)/gi;
    const blockFormulaRefs: string[][] = knowledgeLayer.theory.map((block) =>
      [...block.text.matchAll(formulaRefPattern)].map((m) => m[1]),
    );

    /* ── Assign each formula to the LAST (most specific) block that references it ── */
    const formulaOwner = new Map<string, number>(); // formulaNumber → blockIndex (в исходном theory без цели)
    blockFormulaRefs.forEach((refs, blockIndex) => {
      refs.forEach((num) => {
        // Later blocks override earlier ones (overview block loses to specific method blocks)
        formulaOwner.set(num, blockIndex);
      });
    });

    /* ── Formulas not referenced by any block: distribute sequentially ── */
    const assignedNumbers = new Set(formulaOwner.keys());
    const unassigned: typeof formulas = [];
    formulas.forEach((f) => {
      const match = f.label?.match(/\(?\s*(\d+\.\d+)\s*\)?/);
      if (!match || !assignedNumbers.has(match[1])) unassigned.push(f);
    });

    /* ── Build a formulaNumber→formula map indexed by block (индекс с учётом блока «Цель») ── */
    const formulasForBlock = new Map<number, typeof formulas>();
    formulaOwner.forEach((blockIdx, num) => {
      const f = formulaByNumber.get(num);
      if (!f) return;
      const displayIdx = blockIdx + goalShift;
      if (!formulasForBlock.has(displayIdx)) formulasForBlock.set(displayIdx, []);
      formulasForBlock.get(displayIdx)!.push(f);
    });
    // Sort each block's formulas by their label number
    formulasForBlock.forEach((arr) => {
      arr.sort((a, b) => {
        const na = parseFloat(a.label?.match(/(\d+\.\d+)/)?.[1] ?? '0');
        const nb = parseFloat(b.label?.match(/(\d+\.\d+)/)?.[1] ?? '0');
        return na - nb;
      });
    });

    /* ── Distribute unassigned formulas evenly across non-first blocks ── */
    if (unassigned.length > 0 && knowledgeLayer.theory.length > 1) {
      const startBlock = 1; // skip overview block (в исходных индексах theory)
      const blocks = knowledgeLayer.theory.length - startBlock;
      const perBlock = Math.ceil(unassigned.length / blocks);
      let uIdx = 0;
      for (let bi = startBlock; bi < knowledgeLayer.theory.length && uIdx < unassigned.length; bi++) {
        const displayIdx = bi + goalShift;
        if (!formulasForBlock.has(displayIdx)) formulasForBlock.set(displayIdx, []);
        for (let j = 0; j < perBlock && uIdx < unassigned.length; j++, uIdx++) {
          formulasForBlock.get(displayIdx)!.push(unassigned[uIdx]);
        }
      }
    } else if (unassigned.length > 0) {
      const displayIdx = goalShift; // первый содержательный блок теории
      if (!formulasForBlock.has(displayIdx)) formulasForBlock.set(displayIdx, []);
      unassigned.forEach((f) => formulasForBlock.get(displayIdx)!.push(f));
    }

    /* ── Build simulator lookup: distribute theoryModules across blocks ── */
    const moduleByIndex = new Map<number, TheoryModule>();
    const theoryBlockCount = knowledgeLayer.theory.length;
    const moduleCount = theoryModules.length;
    if (moduleCount > 0 && theoryBlockCount > 0) {
      const ratio = moduleCount / theoryBlockCount;
      for (let blockIdx = 0; blockIdx < theoryBlocks.length; blockIdx++) {
        if (goalShift && blockIdx === 0) continue;
        const logicalIdx = blockIdx - goalShift;
        const moduleIdx = Math.min(Math.floor(logicalIdx * ratio), moduleCount - 1);
        moduleByIndex.set(blockIdx, theoryModules[moduleIdx]);
      }
    }

    /* ── Interleave: theory → formulas → scene → figure ── */
    theoryBlocks.forEach((block, blockIndex) => {
      items.push({ type: 'theory', data: block });

      // Formulas owned by this block
      const blockFormulas = formulasForBlock.get(blockIndex) ?? [];
      blockFormulas.forEach((formula) => {
        if (usedFormulaIds.has(formula.id)) return;
        items.push({ type: 'formula', data: formula });
        usedFormulaIds.add(formula.id);
      });

      // 3D scene
      const matchedModule = moduleByIndex.get(blockIndex);
      if (matchedModule && !usedSimulators.has(matchedModule.simulator)) {
        items.push({ type: 'scene', data: matchedModule });
        usedSimulators.add(matchedModule.simulator);
      }

      // Figure every 2 blocks (как раньше — по порядку содержательных блоков)
      const logicalIdx = blockIndex - goalShift;
      if (logicalIdx >= 0 && (logicalIdx + 1) % 2 === 0 && figureIndex < figures.length) {
        items.push({ type: 'figure', data: figures[figureIndex++] });
      }
    });

    // Any remaining formulas
    formulas.forEach((formula) => {
      if (!usedFormulaIds.has(formula.id)) {
        items.push({ type: 'formula', data: formula });
      }
    });

    // Remaining figures
    while (figureIndex < figures.length) {
      items.push({ type: 'figure', data: figures[figureIndex++] });
    }

    // Any remaining simulators
    theoryModules.forEach((mod) => {
      if (!usedSimulators.has(mod.simulator)) {
        items.push({ type: 'scene', data: mod });
        usedSimulators.add(mod.simulator);
      }
    });

    return items;
  }, [knowledgeLayer, theoryModules, lessonId]);

  useEffect(() => {
    if (!lessonId || !knowledgeLayer) return;
    theoryBlocksWithGoal(knowledgeLayer, lessonId).forEach((block) =>
      progress.markTheoryRead(lessonId, block.id),
    );
  }, [knowledgeLayer, lessonId, progress]);

  if (!knowledgeLayer) {
    return (
      <Alert severity="warning">
        Для этой лабораторной пока нет структурированной теории из методички.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <Chip
          label={diagramsCompact ? 'Рисунки: компактно' : 'Рисунки: обычный размер'}
          color={diagramsCompact ? 'default' : 'primary'}
          onClick={() => setDiagramsCompact((prev) => !prev)}
          variant="outlined"
          size="small"
        />
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Теоретические сведения
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Теория, формулы, сцены и иллюстрации идут в том порядке, в котором студент выполняет расчёт по методичке.
          </Typography>
          <Stack spacing={1.5}>
            {interleavedContent.map((item) => {
              if (item.type === 'theory') {
                const block = item.data as { id: string; heading: string; text: string; keywords: string[] };
                return <KnowledgeBlock key={block.id} block={block} glossary={glossary} />;
              }
              if (item.type === 'formula') {
                const formula = item.data as Parameters<typeof toFormulaBlockProps>[0];
                return <FormulaBlock key={formula.id} {...toFormulaBlockProps(formula)} />;
              }
              if (item.type === 'scene') {
                const mod = item.data as TheoryModule;
                return (
                  <Paper key={`scene-${mod.id}`} variant="outlined" sx={{ p: 1.5 }}>
                    <MiniSimulator type={mod.simulator} />
                  </Paper>
                );
              }
              const figure = item.data as { id: string; path: string; caption: string };
              return (
                <FigureZoom key={figure.id} src={figure.path} caption={figure.caption} compact={diagramsCompact} />
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function KnowledgeBlock({
  block,
  glossary,
}: {
  block: { id: string; heading: string; text: string; keywords: string[] };
  glossary: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = block.text.length > 260;
  const displayText = !isLong || expanded ? block.text : `${block.text.slice(0, 260)}…`;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }} id={block.id}>
      <Typography variant="subtitle2" color="primary.main">
        {block.heading}
      </Typography>
      <Typography
        variant="body2"
        component="div"
        sx={{ mt: 0.5, whiteSpace: 'pre-wrap', tabSize: 4, wordBreak: 'break-word' }}
      >
        <TermHighlight text={displayText} glossary={glossary} />
      </Typography>
      {isLong && (
        <Button
          size="small"
          endIcon={<ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
          onClick={() => setExpanded((prev) => !prev)}
          sx={{ mt: 0.5 }}
        >
          {expanded ? 'Свернуть' : 'Читать далее'}
        </Button>
      )}
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
        {block.keywords.map((keyword) => (
          <Chip key={keyword} label={keyword} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
        ))}
      </Stack>
    </Paper>
  );
}
