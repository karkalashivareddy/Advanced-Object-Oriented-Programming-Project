import { Link } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function ForbiddenPage() {
  const auth = useAuth();

  return (
    <main className="auth-panel" style={{ minHeight: '100dvh' }}>
      <section className="card card-pad" style={{ width: 'min(100%, 520px)', textAlign: 'center' }} aria-labelledby="forbidden-title">
        <div className="state-icon" style={{ margin: '0 auto', width: 64, height: 64, background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
          <ShieldAlert size={28} aria-hidden="true" />
        </div>
        <p className="eyebrow" style={{ justifyContent: 'center', marginTop: 16 }}>Error 403</p>
        <h1 id="forbidden-title">You do not have access to this area.</h1>
        <p className="text-muted" style={{ marginTop: 12 }}>
          Your account is signed in, but it does not hold the permission or role required for this section. If you believe
          this is a mistake, ask your organization administrator to review your access.
        </p>
        <div className="cluster" style={{ justifyContent: 'center', marginTop: 24 }}>
          <Link className="btn btn-primary" to="/app/dashboard">
            <ArrowLeft size={15} aria-hidden="true" /> Back to dashboard
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => void auth.logout()}>
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
        <p className="text-xs text-subtle" style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <LockKeyhole size={12} aria-hidden="true" /> Access is enforced by the server, not only by this interface.
        </p>
      </section>
    </main>
  );
}
