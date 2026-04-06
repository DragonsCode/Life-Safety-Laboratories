import { memo, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import CloseIcon from '@mui/icons-material/Close';
import { resolveAssetPathTryList } from '../../data/assetResolver';

interface FigureZoomProps {
  src: string;
  alt?: string;
  caption?: string;
  /** Уменьшить высоту превью на узких экранах / в «компактном» режиме теории */
  compact?: boolean;
}

function FigureZoom({ src, alt, caption, compact }: FigureZoomProps) {
  const [open, setOpen] = useState(false);
  const tryList = useMemo(() => resolveAssetPathTryList(src), [src]);
  const [tryIdx, setTryIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const activeSrc = tryList[tryIdx] ?? '';

  useEffect(() => {
    setTryIdx(0);
    setFailed(false);
  }, [src]);

  if (!tryList.length || !activeSrc) {
    return null;
  }

  const onImgError = () => {
    if (tryIdx < tryList.length - 1) {
      setTryIdx((i) => i + 1);
    } else {
      setFailed(true);
    }
  };

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          position: 'relative',
          cursor: failed ? 'default' : 'zoom-in',
          ...(!failed ? { '&:hover .zoom-icon': { opacity: 1 } } : {}),
        }}
        onClick={() => !failed && setOpen(true)}
      >
        {failed ? (
          <Alert severity="warning" sx={{ my: 0.5 }} onClick={(e) => e.stopPropagation()}>
            Не удалось загрузить файл рисунка. Проверьте, что в{' '}
            <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
              public/assets/manual-imported/
            </Typography>{' '}
            есть PNG с точным именем, как в методичке (кириллица, пробелы, «ё», запятая в 0,4 и т.д.).
          </Alert>
        ) : (
          <Box
            component="img"
            src={activeSrc}
            alt={alt ?? caption ?? 'Рисунок'}
            sx={{
              width: '100%',
              maxHeight: compact ? 240 : 560,
              objectFit: 'contain',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
            onError={onImgError}
          />
        )}
        {!failed && (
          <Box
            className="zoom-icon"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: '50%',
              p: 0.5,
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
          >
            <ZoomInIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
        )}
        {caption && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: 'block' }}>
            {caption}
          </Typography>
        )}
      </Paper>

      <Dialog open={open && !failed} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {caption ?? 'Рисунок'}
          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            component="img"
            src={activeSrc}
            alt={alt ?? caption ?? 'Рисунок'}
            sx={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            onError={onImgError}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default memo(FigureZoom);
