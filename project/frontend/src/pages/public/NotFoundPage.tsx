import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, HeartPulse, ShieldCheck } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="auth-shell">
      <main className="auth-panel">
        <section className="auth-form surface-glass surface-raised page-enter card-pad" aria-labelledby="not-found-title">
          <div className="state-icon">
            <Compass size={24} aria-hidden="true" />
          </div>
          <span className="eyebrow">Error 404</span>
          <h1 className="page-title" id="not-found-title">Page not found</h1>
          <p className="page-subtitle">The page you requested does not exist or has moved.</p>
          <div className="section-actions form-actions">
            <Link className="btn btn-primary" to="/">
              <ArrowLeft size={15} aria-hidden="true" /> Return home
            </Link>
            <Link className="btn btn-secondary" to="/app/dashboard">
              Open dashboard
            </Link>
          </div>
        </section>
      </main>
      <aside className="auth-visual" aria-label="LifeLink navigation help">
        <div className="stagger-1">
          <span className="brand-mark">
            <HeartPulse size={22} aria-hidden="true" />
          </span>
          <h2>Everything you need is one click away.</h2>
          <p>Your dashboard gathers the queues and records available to your role.</p>
          <ul className="check-list">
            <li><ShieldCheck size={17} aria-hidden="true" /> Role-aware quick actions</li>
            <li><ShieldCheck size={17} aria-hidden="true" /> Live task queues</li>
            <li><ShieldCheck size={17} aria-hidden="true" /> Permission-gated navigation</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
