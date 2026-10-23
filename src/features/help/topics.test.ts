import es from '../../i18n/es.json';
import en from '../../i18n/en.json';
import helpEs from '../../i18n/help.es.json';
import helpEn from '../../i18n/help.en.json';
import {
  DEFAULT_TOPIC,
  foldText,
  HELP_BLOCK_TYPES,
  HELP_SECTIONS,
  HELP_TOPICS,
  isHelpTopic,
  topicText,
  type HelpBlock,
  type HelpTopicContent,
} from './topics';

/** Pantallas a las que puede enlazar la ayuda (rutas de App.tsx). */
const ROUTES = ['/', '/merge', '/split', '/extract-images', '/templates', '/privacy'];

const bundles = [
  { lng: 'es', main: es, help: helpEs },
  { lng: 'en', main: en, help: helpEn },
];

const titles = (main: typeof es) => main.help.topics as Record<string, string>;
const contents = (help: typeof helpEs) => help.topics as Record<string, HelpTopicContent>;

describe('temas de ayuda', () => {
  it('no se repiten y el tema por defecto existe', () => {
    expect(new Set(HELP_TOPICS).size).toBe(HELP_TOPICS.length);
    expect(isHelpTopic(DEFAULT_TOPIC)).toBe(true);
    expect(isHelpTopic('nada')).toBe(false);
    expect(isHelpTopic(undefined)).toBe(false);
  });

  it.each(bundles)(
    'cada sección y cada tema tienen título y contenido en $lng',
    ({ main, help }) => {
      for (const section of HELP_SECTIONS) {
        expect(main.help.sections[section.id]).toEqual(expect.any(String));
      }
      for (const id of HELP_TOPICS) {
        expect(titles(main)[id], id).toEqual(expect.any(String));
        expect(contents(help)[id]?.blocks.length, id).toBeGreaterThan(0);
      }
      // Y ningún tema de más en las traducciones.
      expect(Object.keys(titles(main)).sort()).toEqual([...HELP_TOPICS].sort());
      expect(Object.keys(contents(help)).sort()).toEqual([...HELP_TOPICS].sort());
    },
  );

  it.each(bundles)('los bloques tienen tipos conocidos y enlaces válidos en $lng', ({ help }) => {
    for (const id of HELP_TOPICS) {
      for (const block of contents(help)[id].blocks as HelpBlock[]) {
        expect(HELP_BLOCK_TYPES, `${id}: ${block.type}`).toContain(block.type);
        const link = block.type === 'link' ? block : block.type === 'note' ? block.link : null;
        if (!link) continue;
        if (link.topic !== undefined) {
          expect(isHelpTopic(link.topic), `${id} → ${link.topic}`).toBe(true);
        } else {
          expect(ROUTES, `${id} → ${link.to}`).toContain(link.to);
        }
      }
    }
  });

  it('los dos idiomas tienen los mismos bloques, en el mismo orden', () => {
    for (const id of HELP_TOPICS) {
      const shape = (c: HelpTopicContent) => c.blocks.map((b) => b.type);
      expect(shape(contents(helpEn)[id]), id).toEqual(shape(contents(helpEs)[id]));
      expect(!!contents(helpEn)[id].lead, id).toBe(!!contents(helpEs)[id].lead);
    }
  });
});

describe('búsqueda', () => {
  it('reúne el texto de todos los bloques', () => {
    const text = topicText({
      lead: 'Entradilla',
      blocks: [
        { type: 'p', text: 'Párrafo' },
        { type: 'h', text: 'Título' },
        { type: 'step', title: 'Paso', text: 'Detalle' },
        { type: 'list', items: ['Uno', 'Dos'] },
        { type: 'note', text: 'Aviso', link: { topic: 'crop', label: 'Enlace' } },
        { type: 'link', to: '/merge', label: 'Ir' },
      ],
    });
    expect(text).toBe('Entradilla Párrafo Título Paso Detalle Uno Dos Aviso Ir');
  });

  it('ignora acentos y mayúsculas', () => {
    expect(foldText('Líneas de CORTE')).toBe('lineas de corte');
  });
});
