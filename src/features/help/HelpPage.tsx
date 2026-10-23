import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HELP_NS, hasHelp, helpLanguage, loadHelp } from '../../i18n/help';
import {
  DEFAULT_TOPIC,
  foldText,
  HELP_SECTIONS,
  HELP_TOPICS,
  isHelpTopic,
  topicText,
  type HelpBlock,
  type HelpLinkTarget,
  type HelpTopicContent,
  type HelpTopicId,
} from './topics';
import styles from './HelpPage.module.css';

/** Carga el espacio de nombres `help` del idioma en uso; true cuando ya está. */
function useHelpBundle() {
  const { i18n } = useTranslation();
  const lng = helpLanguage(i18n.resolvedLanguage);
  const [, setLoaded] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (hasHelp(lng)) return;
    let cancelled = false;
    loadHelp(lng).then(
      () => !cancelled && setLoaded(lng),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [lng]);

  return { lng, ready: hasHelp(lng), failed };
}

function TopicLink({ target, label }: { target: HelpLinkTarget; label: string }) {
  const to = target.topic ? `/help/${target.topic}` : target.to;
  return (
    <Link to={to} className={styles.link}>
      {label}
    </Link>
  );
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{block.text}</p>;
    case 'h':
      return <h2>{block.text}</h2>;
    case 'list':
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'note':
      return (
        <aside className={styles.note}>
          <p>
            {block.text}
            {block.link ? (
              <>
                {' '}
                <Link to={block.link.topic ? `/help/${block.link.topic}` : block.link.to}>
                  {block.link.label}
                </Link>
              </>
            ) : null}
          </p>
        </aside>
      );
    case 'link':
      return <TopicLink target={block} label={block.label} />;
    case 'step':
      // Los pasos seguidos se agrupan en Topic en una lista numerada.
      return (
        <li className={styles.step}>
          <h2>{block.title}</h2>
          <p>{block.text}</p>
        </li>
      );
  }
}

/** Bloques del tema, con los pasos consecutivos reunidos en una lista numerada. */
function Blocks({ blocks }: { blocks: HelpBlock[] }) {
  const groups: HelpBlock[][] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === 'step' && last?.[0].type === 'step') last.push(block);
    else groups.push([block]);
  }
  return groups.map((group, i) =>
    group[0].type === 'step' ? (
      <ol key={i} className={styles.steps}>
        {group.map((block, j) => (
          <Block key={j} block={block} />
        ))}
      </ol>
    ) : (
      <Block key={i} block={group[0]} />
    ),
  );
}

export function HelpPage() {
  const { topic: param } = useParams();
  const topic = param === undefined ? DEFAULT_TOPIC : isHelpTopic(param) ? param : null;
  if (topic === null) return <Navigate to="/help" replace />;
  return <Help topic={topic} />;
}

function Help({ topic }: { topic: HelpTopicId }) {
  const { t } = useTranslation();
  const { t: th } = useTranslation(HELP_NS);
  const { lng, ready, failed } = useHelpBundle();
  const [query, setQuery] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusedRef = useRef<HelpTopicId | null>(null);

  // Al cambiar de tema, el foco va al título (y la página sube hasta él).
  useEffect(() => {
    if (!ready || focusedRef.current === topic) return;
    focusedRef.current = topic;
    headingRef.current?.focus();
  }, [topic, ready]);

  const content = ready
    ? (th(`topics.${topic}`, { returnObjects: true }) as HelpTopicContent)
    : null;

  // Texto de cada tema (título y contenido) sin acentos, para buscar.
  const searchable = useMemo(() => {
    const map = new Map<HelpTopicId, string>();
    for (const id of HELP_TOPICS) {
      const body = ready
        ? topicText(th(`topics.${id}`, { returnObjects: true }) as HelpTopicContent)
        : '';
      map.set(id, foldText(`${t(`help.topics.${id}`)} ${body}`));
    }
    return map;
    // th y t cambian con el idioma; lng y ready cubren esos cambios.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lng, ready]);

  const words = foldText(query).split(/\s+/).filter(Boolean);
  const matches = (id: HelpTopicId) => words.every((w) => searchable.get(id)!.includes(w));
  const sections = HELP_SECTIONS.map((s) => ({
    id: s.id,
    topics: words.length ? s.topics.filter(matches) : [...s.topics],
  })).filter((s) => s.topics.length > 0);
  const found = sections.reduce((n, s) => n + s.topics.length, 0);

  return (
    <div className={styles.page}>
      <aside className={styles.index}>
        <input
          type="search"
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('help.search')}
          placeholder={t('help.searchPlaceholder')}
        />
        <p className={styles.results} aria-live="polite">
          {words.length
            ? found
              ? t('help.results', { count: found })
              : t('help.noResults')
            : null}
        </p>
        <nav aria-label={t('help.index')}>
          {sections.map((section) => (
            <div key={section.id}>
              <h2 className={styles.sectionTitle}>{t(`help.sections.${section.id}`)}</h2>
              <ul className={styles.topics}>
                {section.topics.map((id) => (
                  <li key={id}>
                    <Link
                      to={`/help/${id}`}
                      className={styles.topic}
                      aria-current={id === topic ? 'page' : undefined}
                    >
                      {t(`help.topics.${id}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <article className={styles.content}>
        <h1 ref={headingRef} tabIndex={-1}>
          {t(`help.topics.${topic}`)}
        </h1>
        {content ? (
          <>
            {content.lead ? <p className={styles.lead}>{content.lead}</p> : null}
            <Blocks blocks={content.blocks} />
          </>
        ) : failed ? (
          <p className={styles.error} role="alert">
            {t('help.loadFailed')}
          </p>
        ) : null}
      </article>
    </div>
  );
}
