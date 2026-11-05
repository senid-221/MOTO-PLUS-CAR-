/**
 * The 6-digit code box.
 *
 * `autoComplete="one-time-code"` lets Android and iOS fill it straight from the
 * SMS, and the pattern plus maxlength keep a stray space from turning a valid
 * code into a rejected one. Digits are spaced out so a misread is obvious.
 */
export interface OtpFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  disabled = false,
}: OtpFieldProps) {
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
        name="code"
        className="otp-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
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
