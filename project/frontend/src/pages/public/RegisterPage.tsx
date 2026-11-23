import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, HeartPulse, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError, getErrorMessage } from '@/lib/api';
import { tokenStore } from '@/lib/tokenStore';
import { FormField } from '@/components/ui/FormField';

interface FieldErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

type FieldName = keyof FieldErrors;

const FIELD_NAMES: FieldName[] = ['fullName', 'email', 'phone', 'password', 'confirmPassword'];

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

function validateField(field: FieldName, form: Record<FieldName, string>): string | undefined {
  switch (field) {
    case 'fullName':
      return form.fullName.trim() ? undefined : 'Full name is required.';
    case 'email':
      return validateEmail(form.email);
    case 'phone':
      return form.phone && !/^[+\d][\d\s()-]{5,}$/.test(form.phone.trim())
        ? 'Enter a valid phone number or leave this blank.'
        : undefined;
    case 'password':
      if (form.password.length < 10) return 'Use at least 10 characters.';
      if (form.password.length > 72) return 'Use no more than 72 characters.';
      return undefined;
    case 'confirmPassword':
      return form.confirmPassword === form.password ? undefined : 'Passwords do not match.';
  }
}

function applyDetails(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !error.details) return {};
  const next: FieldErrors = {};
  Object.entries(error.details).forEach(([key, message]) => {
    const normalised = key.toLowerCase().replace(/[^a-z]/g, '');
    const field: FieldName | undefined =
      normalised === 'email'
        ? 'email'
        : normalised === 'fullname' || normalised === 'name'
          ? 'fullName'
          : normalised === 'phone' || normalised === 'phonenumber'
            ? 'phone'
            : normalised === 'password'
              ? 'password'
              : normalised === 'confirmpassword' || normalised === 'passwordconfirmation'
                ? 'confirmPassword'
                : undefined;
    if (field) next[field] = message;
  });
  return next;
}

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState<Record<FieldName, string>>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    fullName: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [showSessionNotice, setShowSessionNotice] = useState(
    sessionExpired || (location.state as { sessionExpired?: boolean } | null)?.sessionExpired === true,
  );

  const strengthChecks = [
    { label: 'At least 10 characters', met: form.password.length >= 10 },
    { label: '14 or more characters', met: form.password.length >= 14 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(form.password) },
    { label: 'Number', met: /\d/.test(form.password) },
    { label: 'Symbol', met: /[^A-Za-z0-9]/.test(form.password) },
  ];
  const strengthScore = strengthChecks.filter((check) => check.met).length;
  const strengthLabel = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'][strengthScore];

  const setField = (key: FieldName, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (touched[key]) setErrors((current) => ({ ...current, [key]: validateField(key, { ...form, [key]: value }) }));
    if (key === 'password' && touched.confirmPassword) {
      setErrors((current) => ({ ...current, confirmPassword: validateField('confirmPassword', { ...form, password: value }) }));
    }
  };

  const handleBlur = (field: FieldName) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateField(field, form) }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const next: FieldErrors = {};
    FIELD_NAMES.forEach((field) => {
      next[field] = validateField(field, form);
    });
    setTouched({ fullName: true, email: true, phone: true, password: true, confirmPassword: true });
    setErrors(next);
    if (FIELD_NAMES.some((field) => next[field])) return;

    setSubmitting(true);
    try {
      await auth.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      sessionExpired = false;
      setShowSessionNotice(false);
      navigate('/app/dashboard', { replace: true });
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
      <main className="auth-panel">
        <div className="auth-form surface-glass surface-raised page-enter">
          <Link to="/" className="auth-back">
            <ArrowLeft size={14} aria-hidden="true" /> Back to home
          </Link>
          <div>
            <span className="eyebrow"><UserPlus size={14} aria-hidden="true" /> Create account</span>
            <h1 className="page-title">Join LifeLink</h1>
            <p className="page-subtitle">Create a donor account. Staff roles are assigned by an organization administrator.</p>
          </div>

          {showSessionNotice && (
            <div className="alert alert-warning" role="status">
              <AlertCircle size={17} aria-hidden="true" />
              <div>
                <strong>Your session ended</strong>
                You can register again or sign in with current credentials.
              </div>
            </div>
          )}

          {formError && (
            <div className="alert alert-danger form-error-banner" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={(event) => void submit(event)} noValidate className="form-grid">
            <FormField label="Full name" error={errors.fullName} required full>
              <input
                className="input"
                autoComplete="name"
                value={form.fullName}
                disabled={submitting}
                onChange={(event) => setField('fullName', event.target.value)}
                onBlur={() => handleBlur('fullName')}
              />
            </FormField>
            <FormField label="Email address" error={errors.email} required full>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={form.email}
                disabled={submitting}
                onChange={(event) => setField('email', event.target.value)}
                onBlur={() => handleBlur('email')}
              />
            </FormField>
            <FormField label="Phone" error={errors.phone} hint="Optional" full>
              <input
                className="input"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                disabled={submitting}
                onChange={(event) => setField('phone', event.target.value)}
                onBlur={() => handleBlur('phone')}
              />
            </FormField>
            <FormField label="Password" error={errors.password} hint="10–72 characters" full>
              <div className="search-input-wrap">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  disabled={submitting}
                  onChange={(event) => setField('password', event.target.value)}
                  onBlur={() => handleBlur('password')}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </FormField>
            <div className="form-field-full">
              <progress
                className="strength-meter"
                max={5}
                value={strengthScore}
                aria-label="Password strength"
                aria-valuetext={strengthLabel}
              />
              <span className="field-hint">Strength: {strengthLabel}</span>
              <ul className="check-list">
                {strengthChecks.map((check) => (
                  <li key={check.label} data-met={check.met}>
                    {check.met ? <ShieldCheck size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>
            <FormField label="Confirm password" error={errors.confirmPassword} required full>
              <div className="search-input-wrap">
                <input
                  className="input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  disabled={submitting}
                  onChange={(event) => setField('confirmPassword', event.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={showConfirmPassword ? 'Hide confirmation' : 'Show confirmation'}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </FormField>
            <div className="form-actions form-field-full">
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          </form>

          <p className="text-sm text-muted">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="text-xs text-subtle">
            Registration creates a donor account through the API. Organization membership is added by an administrator.
          </p>
        </div>
      </main>
      <aside className="auth-visual" aria-label="About LifeLink">
        <div className="surface-glass stagger-1">
          <span className="brand-mark">
            <HeartPulse size={22} aria-hidden="true" />
          </span>
          <h2>Start with a verified organization.</h2>
          <p>
            Your account is scoped to memberships and permissions. An administrator can verify your organization and assign
            the right role.
          </p>
          <ul className="check-list">
            <li><ShieldCheck size={17} aria-hidden="true" /> Role-based access</li>
            <li><ShieldCheck size={17} aria-hidden="true" /> Organization membership</li>
            <li><ShieldCheck size={17} aria-hidden="true" /> Traceable activity</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
