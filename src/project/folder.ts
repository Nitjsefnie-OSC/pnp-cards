import type { FolderFile } from '../lib/imageMatch';
import type { ImageFolder } from '../store/cardsStore';
import { isAcceptedImage } from '../features/cards/loadImages';

export interface PickedFolder {
  folder: ImageFolder;
  files: FolderFile[];
}

/** Chrome y Edge permiten guardar el acceso a una carpeta para volver a abrirla. */
const canRememberFolders = () => typeof window.showDirectoryPicker === 'function';

/** Imágenes de una carpeta y sus subcarpetas, con su ruta relativa. */
export async function readFolder(
  handle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<FolderFile[]> {
  const files: FolderFile[] = [];
  for await (const entry of handle.values()) {
    const path = prefix + entry.name;
    if (entry.kind === 'directory') {
      files.push(...(await readFolder(entry as FileSystemDirectoryHandle, `${path}/`)));
    } else {
      const file = await (entry as FileSystemFileHandle).getFile();
      if (isAcceptedImage(file)) files.push({ path, file });
    }
  }
  return files;
}

/** Pide (si hace falta) permiso para leer una carpeta recordada. Debe llamarse desde un clic. */
export async function ensureReadPermission(handle: FileSystemDirectoryHandle) {
  const opts = { mode: 'read' as const };
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  return (await handle.requestPermission?.(opts)) === 'granted';
}

/** Alternativa sin File System Access: <input webkitdirectory>. */
function pickWithInput(): Promise<PickedFolder | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.addEventListener('change', () => {
      const all = [...(input.files ?? [])];
      // webkitRelativePath empieza por el nombre de la carpeta elegida.
      const name = all[0]?.webkitRelativePath.split('/')[0] ?? '';
      const files = all.filter(isAcceptedImage).map((file) => ({
        file,
        path: file.webkitRelativePath.split('/').slice(1).join('/') || file.name,
      }));
      resolve({ folder: { name, handle: null }, files });
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** Pide al usuario una carpeta de imágenes; null si cancela. Debe llamarse desde un clic. */
export async function pickFolder(
  startIn?: FileSystemDirectoryHandle | null,
): Promise<PickedFolder | null> {
  if (!canRememberFolders()) return pickWithInput();
  try {
    const handle = await window.showDirectoryPicker!({
      id: 'pnp-cards-images',
      mode: 'read',
      ...(startIn ? { startIn } : {}),
    });
    return { folder: { name: handle.name, handle }, files: await readFolder(handle) };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/** Vuelve a leer una carpeta recordada; null si el usuario no da permiso. */
export async function reopenFolder(folder: ImageFolder): Promise<PickedFolder | null> {
  if (!folder.handle || !(await ensureReadPermission(folder.handle))) return null;
  return { folder, files: await readFolder(folder.handle) };
}
