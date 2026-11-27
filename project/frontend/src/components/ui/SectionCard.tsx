import { useId, type ReactNode } from 'react';
import { cx } from '@/lib/utils';
import { Surface, type SurfaceVariant } from './Surface';

interface SectionCardProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  variant?: SurfaceVariant;
  className?: string;
  children?: ReactNode;
}

/** A titled Surface with a stable heading id and no nested chrome. */
export function SectionCard({
  title,
  eyebrow,
  description,
  actions,
  variant = 'flat',
  className,
  children,
}: SectionCardProps) {
  const headingId = useId();
  return (
    <Surface as="section" variant={variant} className={cx('section-card', className)} aria-labelledby={headingId}>
      <div className="section-card__header">
        <div className="section-card__heading">
          {eyebrow && <span className="eyebrow eyebrow--chip">{eyebrow}</span>}
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="section-card__actions">{actions}</div>}
      </div>
      {children && <div className="section-card__body">{children}</div>}
    </Surface>
  );
}
