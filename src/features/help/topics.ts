/**
 * Temas de la ayuda, en una lista fija: el identificador es parte de la dirección
 * (`#/help/card-size`), de las claves de traducción (`help.topics.<id>` en el espacio principal
 * para el título, `topics.<id>` en el espacio `help` para el contenido) y de los botones «?».
 */
export const HELP_SECTIONS = [
  { id: 'start', topics: ['getting-started', 'print-real-size'] },
  { id: 'cards', topics: ['layout', 'card-size', 'crop', 'cut-lines', 'backs'] },
  { id: 'projects', topics: ['projects', 'bsk'] },
  { id: 'tools', topics: ['merge', 'split', 'extract-images', 'templates'] },
  { id: 'more', topics: ['offline', 'faq', 'shortcuts', 'privacy'] },
] as const;

export type HelpSectionId = (typeof HELP_SECTIONS)[number]['id'];
export type HelpTopicId = (typeof HELP_SECTIONS)[number]['topics'][number];

export const HELP_TOPICS: readonly HelpTopicId[] = HELP_SECTIONS.flatMap((s) => s.topics);

/** Tema que se abre sin indicar ninguno (`#/help`). */
export const DEFAULT_TOPIC: HelpTopicId = 'getting-started';

export function isHelpTopic(id: string | undefined): id is HelpTopicId {
  return (HELP_TOPICS as readonly string[]).includes(id ?? '');
}

/** Destino de un enlace de la ayuda: otro tema o una pantalla de la app. */
export type HelpLinkTarget = { topic: HelpTopicId; to?: never } | { to: string; topic?: never };

/**
 * Contenido de un tema: bloques que se pintan con componentes. Las traducciones no llevan HTML
 * ni Markdown, solo texto.
 */
export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'step'; title: string; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string; link?: HelpLinkTarget & { label: string } }
  | ({ type: 'link'; label: string } & HelpLinkTarget);

export interface HelpTopicContent {
  /** Entradilla opcional, bajo el título. */
  lead?: string;
  blocks: HelpBlock[];
}

export const HELP_BLOCK_TYPES: readonly HelpBlock['type'][] = [
  'p',
  'h',
  'step',
  'list',
  'note',
  'link',
];

/** Texto de un tema en una sola cadena, para buscar. */
export function topicText(content: HelpTopicContent): string {
  const parts: string[] = [content.lead ?? ''];
  for (const block of content.blocks) {
    if (block.type === 'list') parts.push(...block.items);
    else if (block.type === 'step') parts.push(block.title, block.text);
    else if (block.type === 'link') parts.push(block.label);
    else parts.push(block.text);
  }
  return parts.join(' ');
}

/** Sin acentos ni mayúsculas, para que «lineas» encuentre «Líneas». */
export const foldText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
