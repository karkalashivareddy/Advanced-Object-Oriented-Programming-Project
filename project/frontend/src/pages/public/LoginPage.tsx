import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, HeartPulse, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/api';
import { FormField } from '@/components/ui';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;
    try {
      await auth.login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <div className="auth-layout">
      <main className="auth-panel">
        <div className="auth-form">
          <Link to="/" className="auth-back">
            <ArrowLeft size={14} aria-hidden="true" /> Back to home
          </Link>
          <div>
            <span className="eyebrow"><LockKeyhole size={14} aria-hidden="true" /> Secure sign in</span>
            <h1>Welcome back</h1>
            <p>Sign in to your LifeLink organization workspace.</p>
          </div>

          {formError && (
            <div className="alert alert-danger form-error-banner" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={submit} noValidate className="stack">
            <FormField label="Email address" error={errors.email} required full>
              <input
                className="input"
                type="email"
                autoComplete="username"
                placeholder="you@organization.org"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
            <FormField label="Password" error={errors.password} required full>
              <div className="search-input-wrap">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ position: 'absolute', right: 2 }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </FormField>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={auth.status === 'loading'}>
              Sign in
            </button>
          </form>

          <p className="text-sm text-muted">
            New here? <Link to="/register">Create an account</Link>
          </p>
          <p className="text-xs text-subtle">
            Demo accounts are seeded by the backend. Contact your administrator for credentials.
          </p>
        </div>
      </main>
      <aside className="auth-aside" aria-label="About LifeLink">
        <span className="brand-mark" style={{ background: 'rgba(255,255,255,0.16)' }}>
          <HeartPulse size={22} aria-hidden="true" />
        </span>
        <h2>One shared record for every critical handover.</h2>
        <p>
          Move from donation to delivery with traceable units, explicit permissions, and a clear operational history.
        </p>
        <ul>
          <li><ShieldCheck size={17} aria-hidden="true" /> Organization-scoped access</li>
          <li><ShieldCheck size={17} aria-hidden="true" /> Permission-aware workflows</li>
          <li><ShieldCheck size={17} aria-hidden="true" /> Auditable critical actions</li>
        </ul>
      </aside>
    </div>
  );
}
