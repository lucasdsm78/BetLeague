import React from 'react';

type Props = {
  value: string; // digits only
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
  error?: string;
  name?: string;
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

export default function TotpCodeInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  label,
  error,
  name = 'totp',
}: Props) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  const digits = React.useMemo(() => {
    const v = onlyDigits(value).slice(0, length);
    const arr = new Array(length).fill('');
    for (let i = 0; i < v.length; i++) arr[i] = v[i];
    return arr;
  }, [value, length]);

  const focusIndex = React.useCallback((idx: number) => {
    const el = refs.current[idx];
    if (el) el.focus();
  }, []);

  const setAt = React.useCallback((idx: number, digit: string) => {
    const current = digits.slice();
    current[idx] = digit;
    onChange(current.join(''));
  }, [digits, onChange]);

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return;
    const text = e.clipboardData.getData('text');
    const pasted = onlyDigits(text).slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    const nextFocus = Math.min(pasted.length, length - 1);
    focusIndex(nextFocus);
  };

  React.useEffect(() => {
    if (!autoFocus || disabled) return;
    const t = window.setTimeout(() => focusIndex(0), 80);
    return () => window.clearTimeout(t);
  }, [autoFocus, disabled, focusIndex]);

  return (
    <div>
      {label && (
        <label htmlFor={`${name}-0`} style={{ display: 'block' }}>
          {label}
        </label>
      )}

      <div
        onPaste={handlePaste}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))`,
          gap: '0.5rem',
          marginTop: '0.35rem',
        }}
        aria-invalid={!!error}
      >
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            id={`${name}-${idx}`}
            inputMode="numeric"
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            type="text"
            value={digit}
            disabled={disabled}
            aria-label={`Chiffre ${idx + 1} sur ${length}`}
            maxLength={1}
            onChange={(e) => {
              if (disabled) return;
              const v = onlyDigits(e.target.value).slice(-1);
              setAt(idx, v);
              if (v && idx < length - 1) focusIndex(idx + 1);
            }}
            onKeyDown={(e) => {
              if (disabled) return;

              if (e.key === 'Backspace') {
                if (digits[idx]) {
                  setAt(idx, '');
                } else if (idx > 0) {
                  setAt(idx - 1, '');
                  focusIndex(idx - 1);
                }
              }

              if (e.key === 'ArrowLeft' && idx > 0) focusIndex(idx - 1);
              if (e.key === 'ArrowRight' && idx < length - 1) focusIndex(idx + 1);
            }}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: '100%',
              borderRadius: 12,
              border: error ? '1px solid rgba(255,107,107,0.65)' : '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(7, 10, 15, 0.6)',
              color: 'rgba(255,255,255,0.92)',
              padding: '0.85rem 0',
              textAlign: 'center',
              fontSize: '1.05rem',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              outline: 'none',
            }}
          />
        ))}
      </div>

      {error && (
        <div
          style={{
            marginTop: '0.5rem',
            color: 'rgba(255,107,107,0.95)',
            fontSize: '0.85rem',
          }}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
