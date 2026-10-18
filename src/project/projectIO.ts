import type { BskProject } from '../lib/bsk';
import { parseCopies } from '../lib/filename';
import { matchImages } from '../lib/imageMatch';
import type { ProjectFile } from '../lib/project';
import { loadImage } from '../features/cards/loadImages';
import { useCardsStore, type NewImage } from '../store/cardsStore';
import { useSettingsStore } from '../store/settingsStore';
import type { PickedFolder } from './folder';

type LoadedCard = NewImage & { copies: number };

const blankCard = (copies: number): LoadedCard => ({
  name: '',
  path: '',
  blob: null,
  format: 'png',
  widthPx: 0,
  heightPx: 0,
  dpi: null,
  thumbUrl: null,
  copies,
});

/** El proyecto abierto, tal como se guarda en el .pnpcards. */
export function currentProject(): ProjectFile {
  const { name, folder, cards } = useCardsStore.getState();
  return {
    name,
    folder: folder?.name ?? '',
    settings: useSettingsStore.getState().settings,
    cards: cards.map(({ path, name, copies }) => ({ path, name, copies })),
  };
}

/** Un .bsk de PDFCartas como proyecto: rutas relativas a su carpeta y copias del nombre si faltan. */
export function bskToProject(bsk: BskProject, name: string): ProjectFile {
  return {
    name,
    folder: '',
    settings: bsk.settings,
    cards: bsk.images.map((img) => ({
      path: img.path,
      name: img.name,
      copies: img.copies ?? parseCopies(img.name) ?? 1,
    })),
  };
}

/**
 * Abre un proyecto con las imágenes de la carpeta elegida (de una en una, para no disparar la
 * memoria). Devuelve las imágenes que faltan o no se han podido leer.
 */
export async function openProjectWithFolder(project: ProjectFile, picked: PickedFolder) {
  const { matched, missing } = matchImages(project.cards, picked.files);
  const failed: string[] = [];
  const cards: LoadedCard[] = [];
  for (const { ref, file } of matched) {
    if (!ref.name) {
      cards.push(blankCard(ref.copies));
      continue;
    }
    if (!file) {
      cards.push({ ...blankCard(ref.copies), name: ref.name, path: ref.path, missing: true });
      continue;
    }
    try {
      // Se conserva la ruta del proyecto, para que al guardarlo no cambie.
      cards.push({ ...(await loadImage(file, ref.path || ref.name)), copies: ref.copies });
    } catch {
      failed.push(ref.path || ref.name);
    }
  }
  useSettingsStore.getState().replace(project.settings);
  useCardsStore.getState().load(project.name, cards, picked.folder);
  return [...missing, ...failed];
}
