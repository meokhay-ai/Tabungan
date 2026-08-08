'use client';

import { Loader2, X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useEffect } from 'react';
import { cn } from '@/ui/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'honey';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-deep)] shadow-[0_6px_16px_-8px_rgba(15,122,90,0.7)]',
  honey:
    'bg-[var(--color-honey)] text-white hover:brightness-95 shadow-[0_6px_16px_-8px_rgba(224,146,47,0.7)]',
  secondary: 'bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)] hover:brightness-[0.97]',
  ghost: 'bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-soft)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] hover:brightness-[0.97]',
};

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] px-5 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]',
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 tab-spin" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 tab-spin', className)} />;
}

export function Pill({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'honey' | 'muted';
}) {
  const tones = {
    brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)]',
    honey: 'bg-[var(--color-honey-soft)] text-[var(--color-honey-ink)]',
    muted: 'bg-[var(--color-bg-soft)] text-[var(--color-ink-soft)]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-[var(--color-danger)]">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-[var(--color-ink-soft)]">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-soft)] px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-brand)] focus:bg-[var(--color-card)] focus:ring-2 focus:ring-[var(--color-brand-soft)]';

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(16,40,30,0.45)] p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="tab-rise w-full max-w-md rounded-t-[var(--radius-card)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-pop)] sm:rounded-[var(--radius-card)]"
        style={{ boxShadow: 'var(--shadow-pop)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-soft)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
