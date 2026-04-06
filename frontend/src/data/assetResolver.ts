const PUBLIC_MANUAL_ASSETS_PREFIX = '/assets/manual-imported/';
const SOURCE_ASSETS_PREFIX = '/src/assets/';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Единый вид имени файла/относительного пути: NFC (macOS NFD vs диск),
 * без ведущих слэшей, без обратных слэшей.
 */
function normalizeManualRelativePath(relativePath: string): string {
  let s = safeDecode(relativePath).replace(/^\/+/, '').replace(/\\/g, '/');
  try {
    s = s.normalize('NFC');
  } catch {
    /* ignore */
  }
  return s
    .split('/')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .join('/');
}

/**
 * Кодируем каждый сегмент пути отдельно (корректно для вложенных папок и кириллицы).
 */
function encodePathSegments(relativePath: string): string {
  const norm = normalizeManualRelativePath(relativePath);
  if (!norm) return '';
  return norm
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function toPublicAssetPath(relativePath: string): string {
  const encoded = encodePathSegments(relativePath);
  return `${PUBLIC_MANUAL_ASSETS_PREFIX}${encoded}`;
}

/**
 * Resolves JSON-provided asset paths:
 * `/src/assets/*` -> `/assets/manual-imported/*` (percent-encoded).
 *
 * Пути, которые уже начинаются с `/assets/manual-imported/`, тоже проходят
 * через нормализацию и перекодирование — как в JSON из manualAssets без encode.
 */
function manualImportedRelative(path: string): string | undefined {
  if (path.startsWith(SOURCE_ASSETS_PREFIX)) return path.slice(SOURCE_ASSETS_PREFIX.length);
  if (path.startsWith(PUBLIC_MANUAL_ASSETS_PREFIX)) return path.slice(PUBLIC_MANUAL_ASSETS_PREFIX.length);
  return undefined;
}

export function resolveAssetPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const rel = manualImportedRelative(path);
  if (rel !== undefined) return toPublicAssetPath(rel);
  return path;
}

const IMAGE_EXT = /\.(png|jpg|jpeg|webp)$/i;

function stripSpaceBeforeImageExt(filename: string): string {
  return filename.replace(/\s+\.(png|jpg|jpeg|webp)$/i, (m) => m.trim());
}

function manualImportPathCandidates(rel: string): string[] {
  const norm = normalizeManualRelativePath(rel);
  const out: string[] = [];
  const add = (s: string) => {
    const t = normalizeManualRelativePath(s);
    if (t && !out.includes(t)) out.push(t);
  };

  add(norm);

  if (IMAGE_EXT.test(norm)) {
    add(stripSpaceBeforeImageExt(norm));
  }

  add(norm.replace(/\s+/g, ' '));

  add(norm.replace(/\u2014/g, '-').replace(/\u2013/g, '-'));

  add(
    stripSpaceBeforeImageExt(
      norm.replace(/\u2014/g, '-').replace(/\u2013/g, '-').replace(/\s+/g, ' '),
    ),
  );

  try {
    const nfd = norm.normalize('NFD');
    if (nfd !== norm) add(nfd);
  } catch {
    /* noop */
  }

  return out;
}

function urlsForRelativeCandidate(candidate: string): string[] {
  const strict = toPublicAssetPath(candidate);
  const raw = `${PUBLIC_MANUAL_ASSETS_PREFIX}${candidate}`;
  return strict === raw ? [strict] : [strict, raw];
}

/**
 * Список URL для <img src>: варианты имени (JSON vs файл на диске) и способа кодирования пути.
 */
export function resolveAssetPathTryList(path: string | undefined): string[] {
  if (!path) return [];
  const rel = manualImportedRelative(path);
  if (rel === undefined) return [path];
  const urls: string[] = [];
  for (const candidate of manualImportPathCandidates(rel)) {
    urls.push(...urlsForRelativeCandidate(candidate));
  }
  return [...new Set(urls)];
}
