import { useEffect, useMemo, useState } from 'react';
import { Box, Container, Fab, Stack, Typography, Zoom } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const getScrollMetrics = () => {
    const root = document.getElementById('root');
    const scrollingEl = document.scrollingElement as HTMLElement | null;

    const tops = [
      window.scrollY,
      document.documentElement.scrollTop,
      document.body.scrollTop,
      root?.scrollTop ?? 0,
      scrollingEl?.scrollTop ?? 0,
    ];

    const top = Math.max(...tops);

    const scrollables = [
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      Math.max(0, (root?.scrollHeight ?? 0) - (root?.clientHeight ?? 0)),
      Math.max(0, (scrollingEl?.scrollHeight ?? 0) - (scrollingEl?.clientHeight ?? 0)),
    ];

    const scrollable = Math.max(...scrollables);
    return { top, scrollable };
  };

  const scrollToTop = () => {
    const root = document.getElementById('root');
    const scrollingEl = document.scrollingElement as HTMLElement | null;

    // Some environments (tests, embedded WebViews) may not implement scrollTo.
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    try { document.documentElement.scrollTo?.({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    try { document.body.scrollTo?.({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    try { root?.scrollTo?.({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    try { scrollingEl?.scrollTo?.({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
  };

  useEffect(() => {
    scrollToTop();
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const { top, scrollable } = getScrollMetrics();
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, top / scrollable)) : 0;

      setShowScrollTop(top > 80);
      setScrollProgress(progress);
    };

    const root = document.getElementById('root');
    const scrollingEl = document.scrollingElement as HTMLElement | null;

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    root?.addEventListener('scroll', handleScroll, { passive: true });
    scrollingEl?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      root?.removeEventListener('scroll', handleScroll);
      scrollingEl?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    setShowScrollTop(false);
    setScrollProgress(0);
  }, [location.pathname]);

  const scrollTopSx = useMemo(
    () => ({
      position: 'fixed',
      right: { xs: 16, md: 32 },
      bottom: { xs: 16, md: 32 },
      zIndex: 1400,
      width: 56,
      height: 56,
      background: `conic-gradient(#2e7d32 ${Math.round(scrollProgress * 360)}deg, #1565c0 0deg)`,
      color: '#fff',
      boxShadow: '0 6px 24px rgba(21, 101, 192, 0.35)',
      border: '2px solid rgba(255,255,255,0.25)',
      transition: 'all 0.3s ease',
      '&:hover': {
        background: 'linear-gradient(135deg, #1976d2 0%, #2e7d32 100%)',
        boxShadow: '0 8px 32px rgba(21, 101, 192, 0.5)',
        transform: 'translateY(-2px)',
      },
    }),
    [scrollProgress],
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Container maxWidth="xl" sx={{ flex: 1, py: 3, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Container>
      <Zoom in={showScrollTop}>
        <Fab
          aria-label="Наверх"
          sx={scrollTopSx}
          onClick={scrollToTop}
        >
          <Stack alignItems="center" spacing={0}>
            <KeyboardArrowUpIcon sx={{ fontSize: 28 }} />
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: 1, mt: '-4px' }}>
              {`${Math.round(scrollProgress * 100)}%`}
            </Typography>
          </Stack>
        </Fab>
      </Zoom>
    </Box>
  );
}
