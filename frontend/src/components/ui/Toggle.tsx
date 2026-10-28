import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  locked?: boolean;
  lockedTitle?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
  locked = false,
  lockedTitle,
  loading = false,
  disabled = false,
}: ToggleProps) {
  const isDisabled = disabled || loading || locked;

  return (
    <label
      title={locked ? lockedTitle : undefined}
      className="relative inline-flex items-center cursor-pointer"
      style={{ width: 38, height: 22 }}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label={ariaLabel}
        aria-checked={checked}
        checked={checked}
        disabled={isDisabled}
        className="sr-only"
        onChange={(e) => {
          if (locked || loading || disabled) return;
          onChange(e.target.checked);
        }}
      />
      <span
        className={`w-full h-full rounded-full transition-colors ${
          locked
            ? 'bg-[var(--off-bg)]'
            : checked
            ? 'bg-[var(--ok)]'
            : 'bg-[var(--line)]'
        } ${isDisabled ? 'opacity-60' : ''}`}
      />
      <span
        className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-3 h-3 border-2 border-[var(--proc)] border-t-transparent rounded-full animate-spin" />
        </span>
      )}
    </label>
  );
}
