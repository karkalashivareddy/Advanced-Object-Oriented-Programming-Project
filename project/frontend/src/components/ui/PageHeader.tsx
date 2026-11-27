import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  backTo?: string;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, backTo, className }: PageHeaderProps) {
  return (
    <header className={cx('page-header', 'page-header--app', className)}>
      <div className="page-header__copy">
        {backTo && (
          <Link className="auth-back" to={backTo}>
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </Link>
        )}
        {eyebrow && <span className="eyebrow eyebrow--chip">{eyebrow}</span>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
