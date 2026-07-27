import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PropertySectionCardProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headingId?: string;
}

interface PropertySubIconProps {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
}

export function PropertySubIcon({
  icon: Icon,
  className = '',
  iconClassName = 'h-4 w-4',
}: PropertySubIconProps) {
  return (
    <span
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-neutral-200/90 bg-[linear-gradient(145deg,#ffffff_0%,#f2f2ef_100%)] text-neutral-800 shadow-[0_12px_26px_-20px_rgba(15,23,42,0.8),inset_0_1px_0_rgba(255,255,255,0.95)] ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-x-1 top-0 h-px bg-white" />
      <Icon aria-hidden="true" className={iconClassName} />
    </span>
  );
}

export function PropertySectionCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
  contentClassName = 'p-5 sm:p-6',
  headingId,
}: PropertySectionCardProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={`overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_22px_55px_-42px_rgba(15,23,42,0.55)] ${className}`}
    >
      <header className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-neutral-950 text-white shadow-[0_12px_24px_-16px_rgba(0,0,0,0.95)]">
            <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 pt-0.5">
            <span className="block text-[9px] font-black uppercase tracking-[0.17em] text-neutral-400">
              {eyebrow}
            </span>
            <h3
              id={headingId}
              className="mt-1 text-base font-black leading-tight tracking-[-0.025em] text-neutral-950 sm:text-lg"
            >
              {title}
            </h3>
            {description && (
              <p className="mt-1 max-w-2xl text-[11px] font-semibold leading-relaxed text-neutral-500">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0 sm:self-center">{action}</div>}
      </header>
      <div className={`border-t border-neutral-200/70 bg-neutral-50/35 ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}
