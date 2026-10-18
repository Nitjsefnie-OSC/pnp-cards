import { useId, useState } from 'react';
import styles from './form.module.css';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  integer?: boolean;
  disabled?: boolean;
}

/** Número escrito por el usuario (acepta coma decimal) o null si no es válido. */
function parse(text: string, { min, max, integer }: Pick<Props, 'min' | 'max' | 'integer'>) {
  if (text.trim() === '') return null;
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (integer && !Number.isInteger(n)) return null;
  if ((min !== undefined && n < min) || (max !== undefined && n > max)) return null;
  return n;
}

/** Campo numérico que deja escribir libremente y solo propaga valores válidos. */
export function NumberField({ label, value, onChange, min, max, unit, integer, disabled }: Props) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // Si el valor cambia desde fuera (p. ej. al restablecer), se muestra el nuevo.
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }

  const invalid = parse(text, { min, max, integer }) === null;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.numberWrap}>
        <input
          id={id}
          className={styles.number}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={text}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const next = parse(e.target.value, { min, max, integer });
            if (next !== null && next !== value) {
              setLastValue(next);
              onChange(next);
            }
          }}
          onBlur={() => {
            if (invalid) setText(String(value));
          }}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
    </div>
  );
}
