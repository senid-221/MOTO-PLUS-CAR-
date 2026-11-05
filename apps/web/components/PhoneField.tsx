/**
 * The phone input used by every sign-in and sign-up step.
 *
 * It is a tel field with a numeric keyboard, starts empty (no example number
 * sitting in a placeholder), and keeps the 16px font size that stops iOS from
 * zooming the whole page when the field is focused. Labels, hints and errors
 * arrive already translated from the caller.
 */
export interface PhoneFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: 'tel' | 'username';
}

export function PhoneField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  disabled = false,
  autoComplete = 'tel',
}: PhoneFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter((v): v is string => v !== null)
    .join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        required
      />
      {hint ? (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
