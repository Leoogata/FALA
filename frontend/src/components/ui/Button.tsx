import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ai' | 'ghost';
  loading?: boolean;
  size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[var(--navy)] text-white hover:bg-[#252b50]',
  secondary: 'bg-white border border-[var(--line)] text-[var(--navy)] hover:bg-[var(--soft)]',
  destructive: 'bg-[var(--err)] text-white hover:bg-[#8a2e09]',
  ai: 'bg-[var(--ai-bg)] text-[var(--ai)] hover:bg-[#e5deff]',
  ghost: 'bg-transparent text-[var(--navy)] hover:bg-[var(--soft)]',
};

export function Button({
  variant = 'primary',
  loading = false,
  size = 'md',
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-[14px]';
  const disabledClass = disabled || loading ? 'opacity-45 cursor-not-allowed' : '';

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--proc)] focus-visible:outline-offset-2 ${sizeClass} ${VARIANT_CLASSES[variant]} ${disabledClass} ${className}`}
    >
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
