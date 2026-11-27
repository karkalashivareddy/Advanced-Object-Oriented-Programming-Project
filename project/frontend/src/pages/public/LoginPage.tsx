import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError, getErrorMessage } from '@/lib/api';
import { tokenStore } from '@/lib/tokenStore';
import { CellField, LifelinePath, Wordmark } from '@/components/brand';
import { Field, Input, PasswordField } from '@/components/ui';

interface FieldErrors {
  email?: string;
  password?: string;
}

type FieldName = keyof FieldErrors;

/** The module is loaded at app start, so this catches an expiry that happened before /login mounted. */
let sessionExpired = false;
if (typeof window !== 'undefined') {
  tokenStore.onSessionExpired(() => {
    sessionExpired = true;
  });
}

function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
  return undefined;
}

function applyDetails(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !error.details) return {};
  const next: FieldErrors = {};
  Object.entries(error.details).forEach(([key, message]) => {
    const normalised = key.toLowerCase().replace(/[^a-z]/g, '');
    if (normalised === 'email') next.email = message;
    if (normalised === 'password') next.password = message;
  });
  return next;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string; sessionExpired?: boolean } | null)?.from ?? '/app/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ email: false, password: false });
  const [formError, setFormError] = useState('');
  const [showSessionNotice, setShowSessionNotice] = useState(
    sessionExpired || (location.state as { sessionExpired?: boolean } | null)?.sessionExpired === true,
  );
  const [authenticatedOnMount] = useState(auth.status === 'authenticated');

  // Only redirect visitors who open /login with an existing session. The login
  // submit handler owns navigation for a fresh sign-in; a status-driven effect
  // here would fire a second replace navigation and remount the destination.
  useEffect(() => {
    if (authenticatedOnMount) navigate(from, { replace: true });
  }, [authenticatedOnMount, from, navigate]);

  const busy = submitting || auth.status === 'loading';

  const validateField = (field: FieldName, value: string): string | undefined => {
    if (field === 'email') return validateEmail(value);
    return value ? undefined : 'Password is required.';
  };

  const handleBlur = (field: FieldName, value: string) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateField(field, value) }));
  };

  const handleChange = (field: FieldName, value: string) => {
    if (field === 'email') setEmail(value);
    else setPassword(value);
    if (touched[field]) setErrors((current) => ({ ...current, [field]: validateField(field, value) }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const next: FieldErrors = {
      email: validateField('email', email),
      password: validateField('password', password),
    };
    setTouched({ email: true, password: true });
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    try {
      await auth.login({ email: email.trim(), password });
      sessionExpired = false;
      setShowSessionNotice(false);
      navigate(from, { replace: true });
    } catch (error) {
      const details = applyDetails(error);
      setErrors((current) => ({ ...current, ...details }));
      setFormError(Object.keys(details).length > 0 ? 'Please correct the highlighted fields.' : getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#login-form">Skip to sign-in form</a>

      <header className="auth-visual" aria-label="About LifeLink">
        <CellField className="auth-visual__cells" />
        <LifelinePath variant="hero" className="auth-visual__path" />
        <div className="auth-visual__safe">
          <Wordmark inverse />
          <div className="auth-visual__footer">
            <p className="auth-visual__statement">One record. Every critical handover.</p>
            <p className="auth-visual__note">
              Move from donation to delivery with traceable units, explicit permissions, and a clear operational history.
            </p>
            <div className="auth-visual__proof">
              <span><ShieldCheck size={14} aria-hidden="true" /> Organization-scoped</span>
              <span><ShieldCheck size={14} aria-hidden="true" /> Permission-aware</span>
              <span><Route size={14} aria-hidden="true" /> Auditable</span>
            </div>
          </div>
        </div>
      </header>

      <main className="auth-panel" id="main-content">
        <div className="auth-card page-enter">
          <Link to="/" className="auth-back">
            <ArrowLeft size={14} aria-hidden="true" /> Back to home
          </Link>
          <div>
            <span className="eyebrow"><LockKeyhole size={14} aria-hidden="true" /> Secure sign in</span>
            <h1>Welcome back</h1>
            <p>Sign in to your LifeLink organization workspace.</p>
          </div>

          {showSessionNotice && (
            <div className="alert alert-warning" role="status">
              <AlertCircle size={17} aria-hidden="true" />
              <div>
                <strong>Your session ended</strong>
                Sign in again to continue. Refresh tokens rotate on every use, so the previous session can no longer be reused.
              </div>
            </div>
          )}

          {formError && (
            <div className="alert alert-danger form-error-banner" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form id="login-form" onSubmit={(event) => void submit(event)} noValidate className="form-grid">
            <Field label="Email address" error={errors.email} required full>
              <Input
                type="email"
                autoComplete="username"
                placeholder="you@organization.org"
                value={email}
                onChange={(event) => handleChange('email', event.target.value)}
                onBlur={() => handleBlur('email', email)}
              />
            </Field>
            <PasswordField
              label="Password"
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              error={errors.password}
              required
              onChange={(event) => handleChange('password', event.target.value)}
              onBlur={() => handleBlur('password', password)}
            />
            <div className="form-actions form-field-full">
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy} aria-busy={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
                {!busy && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </div>
          </form>

          <p className="auth-card__footer">
            New here? <Link to="/register">Create account</Link>
          </p>
          <p className="auth-secure-note">
            <ShieldCheck size={14} aria-hidden="true" />
            Demo accounts are seeded by the backend. Contact your administrator for credentials.
          </p>
        </div>
      </main>
    </div>
  );
}
