import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <main className="auth-panel" style={{ minHeight: '100dvh' }}>
      <section className="card card-pad" style={{ width: 'min(100%, 460px)', textAlign: 'center' }}>
        <div className="state-icon" style={{ margin: '0 auto' }}>
          <Compass size={24} aria-hidden="true" />
        </div>
        <h1 style={{ marginTop: 16 }}>Page not found</h1>
        <p className="text-muted" style={{ marginTop: 8 }}>
          The page you requested does not exist or has moved.
        </p>
        <Link className="btn btn-primary" style={{ marginTop: 20 }} to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
