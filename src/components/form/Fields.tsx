import { useId, type ReactNode } from 'react';
import type { HelpTopicId } from '../../features/help/topics';
import { HelpLink } from '../HelpLink';
import styles from './form.module.css';

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small className={styles.hint}>{hint}</small>}
      </span>
    </label>
  );
}

export function RadioGroup<T extends string>({
  legend,
  hideLegend,
  value,
  options,
  onChange,
}: {
  legend: string;
  /** Oculta la leyenda a la vista (no a los lectores de pantalla) si repite el título. */
  hideLegend?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className={styles.radios}>
      <legend className={hideLegend ? 'visually-hidden' : undefined}>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={styles.check}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={styles.color}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Sección plegable de ajustes, con un botón «?» que abre su tema de ayuda. */
export function Section({
  title,
  children,
  defaultOpen,
  help,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  help?: HelpTopicId;
}) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary>
        {title}
        {help ? <HelpLink topic={help} className={styles.help} /> : null}
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
