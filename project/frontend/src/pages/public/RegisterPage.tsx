import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Route,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError, getErrorMessage } from '@/lib/api';
import { tokenStore } from '@/lib/tokenStore';
import { CellField, LifelinePath, Wordmark } from '@/components/brand';
import { Field, Input, PasswordField } from '@/components/ui';

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
      <a className="skip-link" href="#register-form">Skip to registration form</a>

      <header className="auth-visual" aria-label="About LifeLink">
        <CellField className="auth-visual__cells" />
        <LifelinePath variant="hero" className="auth-visual__path" />
        <div className="auth-visual__safe">
          <Wordmark inverse />
          <div className="auth-visual__footer">
            <p className="auth-visual__statement">Your first link in the network.</p>
            <p className="auth-visual__note">
              Registration creates a donor account through the API. An administrator adds organization membership and the right role.
            </p>
            <div className="auth-visual__proof">
              <span><ShieldCheck size={14} aria-hidden="true" /> Role-based access</span>
              <span><ShieldCheck size={14} aria-hidden="true" /> Membership scoped</span>
              <span><Route size={14} aria-hidden="true" /> Traceable activity</span>
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
            <span className="eyebrow"><UserPlus size={14} aria-hidden="true" /> Create account</span>
            <h1>Join LifeLink</h1>
            <p>Create a donor account. Staff roles are assigned by an organization administrator.</p>
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

          <form id="register-form" onSubmit={(event) => void submit(event)} noValidate className="form-grid">
            <Field label="Full name" error={errors.fullName} required full>
              <Input
                autoComplete="name"
                value={form.fullName}
                disabled={submitting}
                onChange={(event) => setField('fullName', event.target.value)}
                onBlur={() => handleBlur('fullName')}
              />
            </Field>
            <Field label="Email address" error={errors.email} required full>
              <Input
                type="email"
                autoComplete="username"
                value={form.email}
                disabled={submitting}
                onChange={(event) => setField('email', event.target.value)}
                onBlur={() => handleBlur('email')}
              />
            </Field>
            <Field label="Phone" error={errors.phone} hint="Optional" full>
              <Input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                disabled={submitting}
                onChange={(event) => setField('phone', event.target.value)}
                onBlur={() => handleBlur('phone')}
              />
            </Field>
            <PasswordField
              label="Password"
              name="password"
              autoComplete="new-password"
              hint="10–72 characters"
              value={form.password}
              error={errors.password}
              required
              disabled={submitting}
              onChange={(event) => setField('password', event.target.value)}
              onBlur={() => handleBlur('password')}
            />
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
            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword}
              error={errors.confirmPassword}
              required
              disabled={submitting}
              onChange={(event) => setField('confirmPassword', event.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
            />
            <div className="form-actions form-field-full">
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
                {!submitting && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </div>
          </form>

          <p className="auth-card__footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="auth-secure-note">
            <ShieldCheck size={14} aria-hidden="true" />
            Registration creates a donor account through the API. Organization membership is added by an administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
