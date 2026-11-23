import { Link } from 'react-router-dom';
import { ArrowLeft, HeartPulse, LockKeyhole, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function ForbiddenPage() {
  const auth = useAuth();

  return (
    <div className="auth-shell">
      <main className="auth-panel">
        <section className="auth-form surface-glass surface-raised page-enter card-pad" aria-labelledby="forbidden-title">
          <div className="state-icon">
            <ShieldAlert size={28} aria-hidden="true" />
          </div>
          <span className="eyebrow">Error 403</span>
          <h1 className="page-title" id="forbidden-title">You do not have access to this area.</h1>
          <p className="page-subtitle">
            Your account is signed in, but it does not hold the permission or role required for this section. If you believe
            this is a mistake, ask your organization administrator to review your access.
          </p>
          <div className="section-actions form-actions">
            <Link className="btn btn-primary" to="/app/dashboard">
              <ArrowLeft size={15} aria-hidden="true" /> Back to dashboard
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => void auth.logout()}>
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </div>
          <p className="freshness">
            <LockKeyhole size={12} aria-hidden="true" /> Access is enforced by the server, not only by this interface.
          </p>
        </section>
      </main>
      <aside className="auth-visual" aria-label="Why access is restricted">
        <div className="stagger-1">
          <span className="brand-mark">
            <HeartPulse size={22} aria-hidden="true" />
          </span>
          <h2>Access is scoped to your role and organization.</h2>
          <p>LifeLink checks permissions on every API request, even when the interface hides an action.</p>
          <ul className="check-list">
            <li><ShieldCheck size={17} aria-hidden="true" /> Your membership defines your scope</li>
            <li><ShieldCheck size={17} aria-hidden="true" /> Administrators manage roles</li>
            <li><ShieldCheck size={17} aria-hidden="true" /> The dashboard shows only your work</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
