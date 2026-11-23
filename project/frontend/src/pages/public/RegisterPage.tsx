import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, HeartPulse, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/api';
import { FormField } from '@/components/ui';

interface FieldErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  const setField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!form.fullName.trim()) next.fullName = 'Full name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.phone && !/^[+\d][\d\s()-]{5,}$/.test(form.phone.trim())) {
      next.phone = 'Enter a valid phone number or leave this blank.';
    }
    if (form.password.length < 10) next.password = 'Use at least 10 characters.';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;
    try {
      await auth.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      navigate('/app/dashboard', { replace: true });
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
            <span className="eyebrow"><UserPlus size={14} aria-hidden="true" /> Create account</span>
            <h1>Join LifeLink</h1>
            <p>Register to request access or join an existing organization.</p>
          </div>

          {formError && (
            <div className="alert alert-danger form-error-banner" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={submit} noValidate className="form-grid">
            <FormField label="Full name" error={errors.fullName} required full>
              <input
                className="input"
                autoComplete="name"
                value={form.fullName}
                onChange={(event) => setField('fullName', event.target.value)}
              />
            </FormField>
            <FormField label="Email address" error={errors.email} required full>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </FormField>
            <FormField label="Phone" error={errors.phone} hint="Optional" full>
              <input
                className="input"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </FormField>
            <FormField label="Password" error={errors.password} required>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setField('password', event.target.value)}
              />
            </FormField>
            <FormField label="Confirm password" error={errors.confirmPassword} required>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => setField('confirmPassword', event.target.value)}
              />
            </FormField>
            <div className="form-field-full">
              <button className="btn btn-primary btn-lg btn-block" type="submit">
                Create account
              </button>
            </div>
          </form>

          <p className="text-sm text-muted">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="text-xs text-subtle">
            Demo accounts are seeded by the backend. Registration creates a new account through the API.
          </p>
        </div>
      </main>
      <aside className="auth-aside" aria-label="About LifeLink">
        <span className="brand-mark" style={{ background: 'rgba(255,255,255,0.16)' }}>
          <HeartPulse size={22} aria-hidden="true" />
        </span>
        <h2>Start with a verified organization.</h2>
        <p>
          Your account is scoped to memberships and permissions. An administrator can verify your organization and assign
          the right role.
        </p>
        <ul>
          <li><ShieldCheck size={17} aria-hidden="true" /> Role-based access</li>
          <li><ShieldCheck size={17} aria-hidden="true" /> Organization membership</li>
          <li><ShieldCheck size={17} aria-hidden="true" /> Traceable activity</li>
        </ul>
      </aside>
    </div>
  );
}
