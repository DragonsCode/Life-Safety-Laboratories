import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import { getLessonById } from '../data/lessons';
import { getKnowledgeLayer, theoryBlocksWithGoal } from '../data/knowledgeLayer';
import TheorySection from '../components/lesson/TheorySection';
import LabSection from '../components/lesson/LabSection';
import TestSection from '../components/lesson/TestSection';
import type { LessonId } from '../types/theme';

type Section = 'theory' | 'lab' | 'test';

function normalizeSection(raw?: string): Section {
  if (raw === 'lab' || raw === 'test') return raw;
  return 'theory';
}

export default function LessonPage() {
  const navigate = useNavigate();
  const { id, section } = useParams<{ id: string; section?: string }>();
  const lesson = getLessonById(Number(id));
  const activeSection = normalizeSection(section);
  const [search, setSearch] = useState('');
  const knowledgeLayer = lesson ? getKnowledgeLayer(lesson.id as LessonId) : undefined;

  const goHome = () => {
    // Primary SPA navigation
    navigate('/', { replace: true });

    // Fallback: some WebViews (or misconfigured hosting) can update the URL
    // without React Router reliably re-rendering. If we're at "/" but still
    // not seeing the home screen, a one-time hard reload fixes it.
    window.setTimeout(() => {
      const isAtHomePath = window.location.pathname === '/';
      const homeMounted = Boolean(document.querySelector('[data-testid="home-page"]'));
      if (isAtHomePath && !homeMounted) {
        window.location.reload();
      }
    }, 50);
  };

  const query = search.trim().toLowerCase();
  const theoryBlocks = useMemo(() => {
      if (!lesson || !knowledgeLayer) return [];
      return theoryBlocksWithGoal(knowledgeLayer, lesson.id as LessonId).map((block) => ({
        id: block.id,
        title: block.heading,
        keywords: block.keywords,
        text: block.text,
      }));
    }, [knowledgeLayer, lesson]);
  const filteredTheoryBlocks = theoryBlocks.filter((block) => {
    if (!query) return true;
    const inTitle = block.title.toLowerCase().includes(query);
    const inKeywords = block.keywords.some((keyword) => keyword.toLowerCase().includes(query));
    const inText = block.text.toLowerCase().includes(query);
    return inTitle || inKeywords || inText;
  });

  function scrollToId(targetId: string) {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function openLabStep(stepId: string) {
    window.dispatchEvent(
      new CustomEvent('lesson-lab-step-request', {
        detail: { lessonId: Number(lesson?.id ?? 0), stepId },
      }),
    );
    scrollToId('lab-wizard');
  }

  if (!lesson) {
    return (
      <Box>
        <Typography variant="h5">Занятие не найдено</Typography>
        <Button sx={{ mt: 2 }} onClick={goHome}>
          К списку занятий
        </Button>
      </Box>
    );
  }

  return (
    <Box data-testid="lesson-page">
      <Button startIcon={<ArrowBackIcon />} onClick={goHome} sx={{ mb: 1 }}>
        На главную
      </Button>

      <Typography variant="h4" sx={{ mb: 1 }}>
        {lesson.title}
      </Typography>
      {!(lesson.id >= 1 && lesson.id <= 15) && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {lesson.goal}
        </Typography>
      )}

      <Tabs
        value={activeSection}
        onChange={(_, value: Section) => navigate(`/lesson/${lesson.id}/${value}`)}
        sx={{ mb: 2 }}
      >
        <Tab value="theory" label="Теория" />
        <Tab value="lab" label="Практика" />
        <Tab value="test" label="Тест" />
      </Tabs>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 1.5, position: 'sticky', top: 16 }}>
            <Typography variant="subtitle1">Оглавление</Typography>
            {activeSection === 'theory' && (
              <TextField
                size="small"
                fullWidth
                label="Поиск по теории"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ mt: 1 }}
              />
            )}
            <List dense sx={{ mt: 1 }}>
              {activeSection === 'theory' &&
                filteredTheoryBlocks.map((block) => (
                  <ListItemButton key={`toc-${block.id}`} onClick={() => scrollToId(block.id)}>
                    <ListItemText primary={block.title} />
                  </ListItemButton>
                ))}
              {activeSection === 'lab' && (
                <>
                  <ListItemButton onClick={() => scrollToId('lab-variant')}>
                    <ListItemText primary="Шаг 0. Вариант" />
                  </ListItemButton>
                  {lesson.labWizard.steps.map((step, index) => (
                    <ListItemButton key={`step-${step.id}`} onClick={() => openLabStep(step.id)}>
                      <ListItemText primary={`Шаг ${index + 1}. ${step.title}`} />
                    </ListItemButton>
                  ))}
                </>
              )}
              {activeSection === 'test' &&
                lesson.tests.map((question, index) => (
                  <ListItemButton key={`q-${question.id}`} onClick={() => scrollToId(`test-question-${question.id}`)}>
                    <ListItemText primary={`Вопрос ${index + 1}`} />
                  </ListItemButton>
                ))}
            </List>
            <Stack spacing={0.4} sx={{ mt: 1 }}>
              {lesson.references.map((reference) => (
                <Typography key={`ref-${reference}`} variant="caption" color="text.secondary">
                  • {reference}
                </Typography>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 9 }}>
          {activeSection === 'theory' && <TheorySection lessonId={lesson.id as LessonId} />}
          {activeSection === 'lab' && <LabSection key={`lab-${lesson.id}`} lesson={lesson} />}
          {activeSection === 'test' && <TestSection questions={lesson.tests} lessonId={lesson.id as LessonId} />}
        </Grid>
      </Grid>
    </Box>
  );
}

