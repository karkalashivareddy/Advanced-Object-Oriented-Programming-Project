import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  backTo?: string;
}

export function PageHeader({ title, description, eyebrow, actions, backTo }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {backTo && (
          <Link className="auth-back" to={backTo} style={{ marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </Link>
        )}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
