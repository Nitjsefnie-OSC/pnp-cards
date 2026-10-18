/** Imagen que un proyecto espera encontrar: ruta dentro de su carpeta y nombre ('' = en blanco). */
export interface ImageRef {
  path: string;
  name: string;
}

/** Archivo de la carpeta elegida, con su ruta relativa a ella (separada con "/"). */
export interface FolderFile {
  path: string;
  file: File;
}

export interface MatchResult<T extends ImageRef> {
  matched: { ref: T; file: File | null }[];
  /** Rutas (o nombres) de las imágenes que no se han encontrado. */
  missing: string[];
}

/** Ruta comparable: barras "/", sin barra ni "./" inicial y en minúsculas. */
export function normalizePath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^(\.\/|\/)+/, '')
    .toLowerCase();
}

const baseName = (path: string) => path.split('/').pop() ?? '';

/**
 * Empareja las imágenes de un proyecto con los archivos de una carpeta: por la ruta exacta, por
 * la ruta aunque se haya elegido una carpeta más arriba o más abajo, y si no, por el nombre.
 */
export function matchImages<T extends ImageRef>(refs: T[], files: FolderFile[]): MatchResult<T> {
  const entries = files.map((f) => ({ path: normalizePath(f.path), file: f.file }));
  const byPath = new Map(entries.map((e) => [e.path, e.file]));
  const missing: string[] = [];

  const matched = refs.map((ref) => {
    if (!ref.name) return { ref, file: null };
    const path = normalizePath(ref.path || ref.name);
    const name = normalizePath(ref.name);
    const file =
      byPath.get(path) ??
      entries.find((e) => e.path.endsWith(`/${path}`) || path.endsWith(`/${e.path}`))?.file ??
      entries.find((e) => baseName(e.path) === name)?.file ??
      null;
    if (!file) missing.push(ref.path || ref.name);
    return { ref, file };
  });

  return { matched, missing };
}
