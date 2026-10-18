import { mergeSettings, type LayoutSettings } from './settings';

/** Extensión de los proyectos: un JSON que apunta a las imágenes de la carpeta del usuario. */
export const PROJECT_EXTENSION = '.pnpcards';
export const PROJECT_MIME = 'application/x-pnpcards';

const FORMAT = 'pnp-cards';
const VERSION = 1;

/** Carta del proyecto: ruta dentro de la carpeta de imágenes (y nombre); '' = en blanco. */
export interface ProjectCardRef {
  path: string;
  name: string;
  copies: number;
}

export interface ProjectFile {
  name: string;
  /** Nombre de la carpeta de imágenes, para ayudar a encontrarla al abrir el proyecto. */
  folder: string;
  settings: LayoutSettings;
  cards: ProjectCardRef[];
}

export type ProjectErrorCode = 'invalid' | 'newer-version';

export class ProjectError extends Error {
  constructor(readonly code: ProjectErrorCode) {
    super(code);
    this.name = 'ProjectError';
  }
}

export function serializeProject(project: ProjectFile): string {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      app: 'PnP Cards',
      name: project.name,
      folder: project.folder,
      settings: project.settings,
      cards: project.cards.map(({ path, name, copies }) => ({ path, name, copies })),
    },
    null,
    2,
  );
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function parseProject(text: string): ProjectFile {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ProjectError('invalid');
  }
  if (
    !json ||
    json.format !== FORMAT ||
    typeof json.version !== 'number' ||
    !Array.isArray(json.cards)
  ) {
    throw new ProjectError('invalid');
  }
  if (json.version > VERSION) throw new ProjectError('newer-version');

  return {
    name: str(json.name),
    folder: str(json.folder),
    settings: mergeSettings(json.settings as Partial<LayoutSettings> | undefined),
    cards: (json.cards as Record<string, unknown>[]).map((c) => {
      const copies = Number(c?.copies);
      return {
        path: str(c?.path),
        name: str(c?.name),
        copies: Number.isInteger(copies) && copies > 0 ? copies : 1,
      };
    }),
  };
}
