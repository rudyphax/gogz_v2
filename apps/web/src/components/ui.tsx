import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary:
    'bg-brand-400 text-night-950 shadow-[0_0_24px_-6px_rgb(34_211_238/0.7)] hover:bg-brand-300 disabled:bg-brand-400/40 disabled:shadow-none',
  secondary:
    'bg-white/5 text-ink ring-1 ring-line-strong hover:bg-white/10 hover:ring-brand-400/50',
  danger: 'bg-red-500/10 text-red-300 ring-1 ring-red-400/40 hover:bg-red-500/20',
  ghost: 'text-muted hover:bg-white/5 hover:text-ink',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-2xl bg-gradient-to-b from-panel-2/80 to-panel p-4 shadow-lg shadow-black/20 ring-1 ring-line sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="heading-display text-3xl text-white sm:text-4xl">{title}</h1>
        <span
          aria-hidden
          className="mt-2 block h-0.5 w-16 rounded-full bg-gradient-to-r from-brand-400 to-transparent"
        />
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-line-strong focus:ring-2 focus:ring-brand-400 focus:outline-none disabled:opacity-60"
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/30"
    >
      {message}
    </p>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-muted">{label}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function Badge({
  children,
  tone = 'stone',
}: {
  children: ReactNode;
  tone?: 'stone' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const tones = {
    stone: 'bg-white/5 text-muted ring-line-strong',
    green: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
    amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
    red: 'bg-red-500/10 text-red-300 ring-red-400/30',
    blue: 'bg-brand-400/10 text-brand-300 ring-brand-400/30',
  };
  return (
    <span
      className={cx(
        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export { cx };
