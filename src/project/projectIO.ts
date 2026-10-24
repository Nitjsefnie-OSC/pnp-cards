import type { BskProject } from '../lib/bsk';
import { parseCopies } from '../lib/filename';
import { matchImages, type ImageRef } from '../lib/imageMatch';
import type { ProjectFile } from '../lib/project';
import { loadImage } from '../features/cards/loadImages';
import { useCardsStore, type NewImage } from '../store/cardsStore';
import { useSettingsStore } from '../store/settingsStore';
import type { PickedFolder } from './folder';

type LoadedCard = NewImage & { copies: number };

const blankImage = (): NewImage => ({
  name: '',
  path: '',
  blob: null,
  format: 'png',
  widthPx: 0,
  heightPx: 0,
  dpi: null,
  thumbUrl: null,
});

/** El proyecto abierto, tal como se guarda en el .pnpcards. */
export function currentProject(): ProjectFile {
  const { name, folder, cards, back } = useCardsStore.getState();
  return {
    name,
    folder: folder?.name ?? '',
    settings: useSettingsStore.getState().settings,
    cards: cards.map(({ path, name, copies, noBack, rotation }) => ({
      path,
      name,
      copies,
      ...(noBack ? { noBack: true as const } : {}),
      ...(rotation ? { rotation } : {}),
    })),
    back: back ? { path: back.path, name: back.name } : null,
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
    back: null,
  };
}

/**
 * Lee la imagen de una carta (o del reverso) emparejada con la carpeta. Si no se encontró, se
 * conserva su ruta marcada como que falta; si no se puede leer, devuelve null.
 */
async function loadRef(ref: ImageRef, file: File | null): Promise<NewImage | null> {
  if (!ref.name) return blankImage();
  if (!file) return { ...blankImage(), name: ref.name, path: ref.path, missing: true };
  try {
    // Se conserva la ruta del proyecto, para que al guardarlo no cambie.
    return await loadImage(file, ref.path || ref.name);
  } catch {
    return null;
  }
}

/**
 * Abre un proyecto con las imágenes de la carpeta elegida (de una en una, para no disparar la
 * memoria). Devuelve las imágenes que faltan o no se han podido leer.
 */
export async function openProjectWithFolder(project: ProjectFile, picked: PickedFolder) {
  const refs: ImageRef[] = project.back ? [...project.cards, project.back] : project.cards;
  const { matched, missing } = matchImages(refs, picked.files);
  const failed: string[] = [];
  const cards: LoadedCard[] = [];
  for (const [i, { ref, file }] of matched.slice(0, project.cards.length).entries()) {
    const image = await loadRef(ref, file);
    const { copies, noBack, rotation } = project.cards[i];
    if (image) {
      cards.push({
        ...image,
        copies,
        ...(noBack ? { noBack } : {}),
        ...(rotation ? { rotation } : {}),
      });
    } else failed.push(ref.path || ref.name);
  }
  let back: NewImage | null = null;
  if (project.back) {
    const { ref, file } = matched[project.cards.length];
    back = await loadRef(ref, file);
    if (!back) failed.push(ref.path || ref.name);
  }
  useSettingsStore.getState().replace(project.settings);
  useCardsStore.getState().load(project.name, cards, picked.folder, back);
  return [...missing, ...failed];
}
