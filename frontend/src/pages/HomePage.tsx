import { Box, Button, Card, CardActions, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ScienceIcon from '@mui/icons-material/Science';
import QuizIcon from '@mui/icons-material/Quiz';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';
import { lessons } from '../data/lessons';
import { getKnowledgeLayer } from '../data/knowledgeLayer';
import { useProgress } from '../context/ProgressContext';
import type { LessonId } from '../types/theme';

export default function HomePage() {
  const navigate = useNavigate();
  const progress = useProgress();

  return (
    <Box data-testid="home-page">
      <Typography variant="h3" gutterBottom>
        Life-Safety Laboratories
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3, maxWidth: 900 }}>
        Полный интерактивный практикум по БЖД: теория, лабораторные и тесты по занятиям в формате методички.
      </Typography>

      <Grid container spacing={2.5}>
        {lessons.map((lesson) => {
          const lp = progress.get(lesson.id as LessonId);
          const theoryCount = getKnowledgeLayer(lesson.id as LessonId)?.theory.length ?? lesson.theoryModules.length;
          const theoryPct = theoryCount > 0
            ? Math.min(100, Math.round((lp.theoryRead.length / theoryCount) * 100))
            : 0;

          return (
            <Grid key={lesson.id} size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Занятие ${lesson.id}`} color="primary" />
                    <Chip label={`${theoryCount} блоков теории`} variant="outlined" />
                    <Chip label={`${lesson.labWizard.steps.length + 1} шагов лаб.`} variant="outlined" />
                    {lp.testScore !== null && (
                      <Chip
                        icon={<CheckCircleOutlineIcon />}
                        label={`Тест: ${lp.testScore}%`}
                        color={lp.testScore >= 70 ? 'success' : 'warning'}
                        size="small"
                      />
                    )}
                    {theoryPct > 0 && theoryPct < 100 && (
                      <Chip label={`Теория: ${theoryPct}%`} color="info" size="small" variant="outlined" />
                    )}
                    {theoryPct === 100 && (
                      <Chip icon={<CheckCircleOutlineIcon />} label="Теория ✓" color="success" size="small" />
                    )}
                  </Stack>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {lesson.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {lesson.goal}
                  </Typography>
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ width: '100%' }}>
                    <Button
                      variant="contained"
                      startIcon={<AutoStoriesIcon />}
                      onClick={() => navigate(`/lesson/${lesson.id}/theory`)}
                    >
                      Теория
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<ScienceIcon />}
                      onClick={() => navigate(`/lesson/${lesson.id}/lab`)}
                    >
                      Практика
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<QuizIcon />}
                      onClick={() => navigate(`/lesson/${lesson.id}/test`)}
                    >
                      Тест
                    </Button>
                  </Stack>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
