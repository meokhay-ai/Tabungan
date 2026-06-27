import { cn } from '@/ui/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--color-brand)" />
      <circle cx="32" cy="38" r="15" fill="#fffdf7" />
      <text
        x="32"
        y="44.5"
        fontFamily="Georgia, serif"
        fontSize="19"
        fontWeight="700"
        textAnchor="middle"
        fill="var(--color-brand-deep)"
      >
        T
      </text>
      <path d="M32 23c0-6 4-10 10-10-1 7-4 10-10 10z" fill="var(--color-honey)" />
      <path
        d="M32 23v-9"
        stroke="var(--color-brand-deep)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <p className="font-display text-lg font-semibold text-[var(--color-ink)]">Tabungan</p>
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-ink-soft)]">
          Family allowance desk
        </p>
      </div>
    </div>
  );
}
