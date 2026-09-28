import React, { useId, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { Loader2, Info } from 'lucide-react';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-accent hover:bg-accent-hover text-white shadow-xs',
      secondary: 'bg-ink hover:bg-ink-soft text-white shadow-xs',
      outline: 'border border-line-strong bg-surface hover:bg-surface-muted text-ink',
      ghost: 'text-ink-soft hover:bg-ink/5',
      danger: 'bg-negative hover:bg-negative/90 text-white',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-6 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// --- Card ---
export const Card = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => (
  <div
    className={cn(
      'rounded-2xl border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(15,27,45,.04),0_8px_24px_-12px_rgba(15,27,45,.08)]',
      className
    )}
  >
    {children}
  </div>
);

export const CardHeader = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;

export const CardTitle = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => (
  <h3 className={cn('font-display text-lg leading-none tracking-tight text-ink', className)}>
    {children}
  </h3>
);

export const CardContent = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <div className={cn('p-6 pt-0', className)}>{children}</div>;

// --- Input ---
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink ring-offset-paper file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

// --- Badge ---
export type BadgeVariant =
  | 'neutral'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'info'
  | 'accent'
  // Legacy variants kept so older callers keep compiling.
  | 'default'
  | 'outline';

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-surface-muted text-ink-soft',
  positive: 'border-transparent bg-accent-light text-positive',
  negative: 'border-transparent bg-negative/10 text-negative',
  warning: 'border-transparent bg-warning/10 text-warning',
  info: 'border-transparent bg-info/10 text-info',
  accent: 'border-transparent bg-accent text-white',
  default: 'border-transparent bg-ink text-surface',
  outline: 'border-line text-ink',
};

export const Badge = ({
  className,
  variant = 'neutral',
  children,
}: {
  className?: string;
  variant?: BadgeVariant;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </div>
  );
};

// --- StatusDot ---
export const StatusDot = ({
  variant = 'neutral',
  className,
}: {
  variant?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info' | 'accent';
  className?: string;
}) => {
  const colors = {
    neutral: 'bg-muted',
    positive: 'bg-positive',
    negative: 'bg-negative',
    warning: 'bg-warning',
    info: 'bg-info',
    accent: 'bg-accent',
  };
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2 w-2 rounded-full', colors[variant], className)}
    />
  );
};

// --- Eyebrow ---
export const Eyebrow = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => (
  <p className={cn('text-[11px] font-medium uppercase tracking-[0.08em] text-muted', className)}>
    {children}
  </p>
);

// --- SectionTitle ---
export const SectionTitle = ({
  eyebrow,
  className,
  children,
}: {
  eyebrow?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) => (
  <div className={className}>
    {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
    <h2 className="font-display text-xl text-ink">{children}</h2>
    <div aria-hidden="true" className="mt-2 h-px w-6 bg-brass" />
  </div>
);

// --- SegmentedControl ---
interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible radiogroup of mutually-exclusive options with roving tabindex
 * and arrow-key navigation (Left/Right, plus Home/End).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  // Option ids come from useId — ariaLabel may contain spaces, which would
  // produce invalid ids for the focus-by-id lookup below.
  const groupId = useId();

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (index + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      nextIndex = (index - 1 + options.length) % options.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = options.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const next = options[nextIndex];
    onChange(next.value);
    document.getElementById(`${groupId}-option-${nextIndex}`)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-muted p-1',
        className
      )}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          id={`${groupId}-option-${index}`}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent',
            value === option.value
              ? 'bg-surface text-ink shadow-xs'
              : 'text-ink-soft hover:text-ink'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// --- InfoTip ---
interface InfoTipProps {
  /** Short heading shown at the top of the popover. */
  title: string;
  children: React.ReactNode;
  /** Accessible name for the trigger button; defaults to "About {title}". */
  ariaLabel?: string;
  /** Horizontal alignment of the popover relative to the trigger. */
  align?: 'start' | 'center' | 'end';
}

/**
 * An "ⓘ" button that toggles a small explanatory popover. Opens on click,
 * Enter or Space; closes on Escape, outside click or clicking the trigger
 * again. `aria-expanded` + `aria-controls` wire the dialog relationship.
 * Centered popovers near a screen edge are nudged back inside the viewport.
 */
export const InfoTip: React.FC<InfoTipProps> = ({
  title,
  children,
  ariaLabel,
  align = 'center',
}) => {
  const [open, setOpen] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Keep a centered popover inside the viewport (e.g. triggers near the right
  // edge of a 390px screen would otherwise clip half the popover).
  React.useLayoutEffect(() => {
    if (!open || align !== 'center') {
      setShiftX(0);
      return;
    }
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover || popover.offsetWidth === 0) return;
    const margin = 8;
    const half = popover.offsetWidth / 2;
    const center = trigger.getBoundingClientRect().left + trigger.offsetWidth / 2;
    const clamped = Math.min(Math.max(center, half + margin), window.innerWidth - half - margin);
    setShiftX(clamped - center);
  }, [open, align]);

  const positionClass =
    align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? `About ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          ref={popoverRef}
          id={id}
          role="dialog"
          aria-label={title}
          style={shiftX ? { transform: `translateX(calc(-50% + ${shiftX}px))` } : undefined}
          className={cn(
            'absolute top-full z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-line bg-surface p-3 text-left shadow-[0_1px_2px_rgba(15,27,45,.04),0_8px_24px_-12px_rgba(15,27,45,.08)] animate-rise',
            positionClass
          )}
        >
          <p className="text-sm font-semibold text-ink">{title}</p>
          <div className="mt-1 text-xs leading-relaxed text-ink-soft">{children}</div>
        </div>
      )}
    </span>
  );
};

// --- Disclosure ---
interface DisclosureProps {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Extra content rendered next to the summary line (e.g. a muted hint). */
  aside?: React.ReactNode;
}

/** Styled native <details>/<summary> — collapsed by default. */
export const Disclosure: React.FC<DisclosureProps> = ({ summary, children, className, aside }) => (
  <details className={cn('group rounded-2xl border border-line bg-surface', className)}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-display text-lg text-ink [&::-webkit-details-marker]:hidden">
      <span className="flex flex-col">
        <span>{summary}</span>
        {aside && <span className="mt-0.5 font-sans text-xs text-muted">{aside}</span>}
      </span>
      <span
        aria-hidden="true"
        className="text-muted transition-transform duration-150 group-open:rotate-45"
      >
        +
      </span>
    </summary>
    <div className="border-t border-line p-6">{children}</div>
  </details>
);

// --- Toggle ---
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/** Switch control with role="switch" + aria-checked. */
export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled,
}) => (
  <div className="flex items-start justify-between gap-4">
    {(label || description) && (
      <div className="min-w-0">
        {label && <p className="text-sm font-medium text-ink">{label}</p>}
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
    )}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : 'Toggle'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-line-strong'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-150',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  </div>
);
