import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { humanize, initials } from '@/lib/utils';
import { ErrorState, FormField, PageHeader, StatusBadge, useToast } from '@/components/ui';

interface Errors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

type VisibleFields = { current: boolean; next: boolean; confirm: boolean };

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e'];
// Mirrors the backend ChangePasswordRequest pattern.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/;

function passwordStrength(value: string): number {
  if (!value || value.length < 10) return 0;
  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, Math.max(1, score));
}

export function ProfilePage() {
  const auth = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState<VisibleFields>({ current: false, next: false, confirm: false });

  const changePassword = useMutation({
    mutationFn: () => auth.changePassword(form.currentPassword, form.newPassword),
    onSuccess: () => {
      setDone(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setErrors({});
      setFormError('');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setFormError(message);
      if (/current password/i.test(message)) {
        setErrors((current) => ({ ...current, currentPassword: message }));
      }
    },
  });

  const strength = passwordStrength(form.newPassword);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setDone(false);
    setFormError('');
    const next: Errors = {};
    if (!form.currentPassword) next.currentPassword = 'Current password is required.';
    if (!form.newPassword) {
      next.newPassword = 'New password is required.';
    } else if (form.newPassword.length < 10) {
      next.newPassword = 'Use at least 10 characters.';
    } else if (form.newPassword.length > 72) {
      next.newPassword = 'Use no more than 72 characters.';
    } else if (!PASSWORD_PATTERN.test(form.newPassword)) {
      next.newPassword = 'Include upper case, lower case, a number and a symbol.';
    } else if (form.newPassword === form.currentPassword) {
      next.newPassword = 'New password must differ from the current password.';
    }
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length === 0) changePassword.mutate();
  };

  const toggleVisibility = (field: keyof VisibleFields) => {
    setVisible((current) => ({ ...current, [field]: !current[field] }));
  };

  const copyPublicId = async (value: string) => {
    if (!navigator.clipboard) {
      toast.error('Clipboard is not available in this browser');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Public ID copied', value);
    } catch {
      toast.error('Could not copy the public ID');
    }
  };

  if (!auth.user) {
    return (
      <div className="app-page page-enter">
        <ErrorState error="No signed-in user." />
      </div>
    );
  }

  const user = auth.user;
  const activeMembership = user.memberships.find(
    (membership) => membership.organizationId === auth.organizationId,
  );

  return (
    <div className="app-page page-enter">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Your identity, effective access, and organization memberships as returned by the API."
        actions={
          <span className="live-pill">
            <span className="live-dot" aria-hidden="true" /> Signed in as {user.fullName}
          </span>
        }
      />

      <div className="split-layout stagger-1">
        <section className="surface surface-glass" aria-labelledby="profile-identity-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Identity</span>
              <h2 id="profile-identity-title">{user.fullName}</h2>
              <p className="page-subtitle">{user.email}</p>
            </div>
            <div className="section-actions">
              <StatusBadge status={user.status} />
              <span
                className="avatar"
                style={{ width: 44, height: 44, fontSize: 'var(--text-sm)' }}
                aria-hidden="true"
              >
                {initials(user.fullName)}
              </span>
            </div>
          </div>
          <dl className="detail-grid">
            <div className="detail-item"><dt>Full name</dt><dd>{user.fullName}</dd></div>
            <div className="detail-item"><dt>Email</dt><dd>{user.email}</dd></div>
            <div className="detail-item"><dt>User ID</dt><dd className="mono">{user.id}</dd></div>
            <div className="detail-item">
              <dt>Public ID</dt>
              <dd className="cluster">
                <span className="mono">{user.publicId}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  aria-label="Copy public ID"
                  onClick={() => void copyPublicId(user.publicId)}
                >
                  <Copy size={13} aria-hidden="true" />
                </button>
              </dd>
            </div>
          </dl>

          <hr className="divider" />
          <h3>Global roles</h3>
          <div className="cluster" style={{ marginTop: 8 }}>
            {user.roles.length
              ? user.roles.map((role) => <span className="status-chip" key={role}>{humanize(role)}</span>)
              : <span className="text-muted">No roles returned</span>}
          </div>

          <h3 style={{ marginTop: 20 }}>Effective permissions</h3>
          <div className="cluster" style={{ marginTop: 8 }}>
            {user.permissions.length
              ? user.permissions.map((permission) => <span className="chip" key={permission}>{humanize(permission)}</span>)
              : <span className="text-muted">No explicit permissions returned; roles determine access.</span>}
          </div>
          <p className="text-xs text-subtle" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={13} aria-hidden="true" /> Permissions displayed here are advisory; the API enforces access.
          </p>
        </section>

        <section className="surface surface-raised" aria-labelledby="profile-access-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Access snapshot</span>
              <h2 id="profile-access-title">Access</h2>
              <p className="page-subtitle">Counts are from your authenticated user record.</p>
            </div>
          </div>
          <div className="metric-grid">
            <article className="metric-card">
              <span className="metric-label">Roles</span>
              <strong className="metric-value">{user.roles.length}</strong>
            </article>
            <article className="metric-card">
              <span className="metric-label">Permissions</span>
              <strong className="metric-value">{user.permissions.length}</strong>
            </article>
            <article className="metric-card">
              <span className="metric-label">Memberships</span>
              <strong className="metric-value">{user.memberships.length}</strong>
            </article>
          </div>
          <div className="item-header" style={{ marginTop: 16 }}>
            <div>
              <strong>Active organization</strong>
              <div className="text-xs text-subtle">
                {activeMembership
                  ? `${activeMembership.organizationName} · ${humanize(activeMembership.role)}`
                  : auth.hasRole('PLATFORM_ADMIN') ? 'Platform admin context' : 'No active organization'}
              </div>
            </div>
            <span className="live-pill"><span className="live-dot" aria-hidden="true" /> Current</span>
          </div>
          <p className="text-xs text-subtle" style={{ marginTop: 12 }}>
            Switch the active organization from the top bar when you belong to more than one.
          </p>
        </section>
      </div>

      <section className="stagger-2" style={{ marginTop: 24 }} aria-labelledby="profile-memberships-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Tenancy</span>
            <h2 id="profile-memberships-title">Memberships</h2>
            <p className="page-subtitle">Organization-scoped roles can be switched from here.</p>
          </div>
        </div>
        {user.memberships.length === 0 && (
          <div className="surface surface-glass">
            <p className="text-sm text-muted">No organization memberships yet.</p>
          </div>
        )}
        <div className="task-grid">
          {user.memberships.map((membership) => {
            const isActive = membership.organizationId === auth.organizationId;
            return (
              <article className={`task-card${isActive ? ' surface-interactive' : ''}`} key={membership.organizationId}>
                <div className="task-icon"><Building2 size={18} aria-hidden="true" /></div>
                <div className="task-title">{membership.organizationName}</div>
                <div className="task-meta">
                  Organization #{membership.organizationId} · {humanize(membership.role)}
                </div>
                {isActive ? (
                  <span className="status-chip" style={{ marginTop: 12 }}>
                    <span className="live-dot" aria-hidden="true" /> Active organization
                  </span>
                ) : (
                  <button
                    type="button"
                    className="task-cta"
                    onClick={() => {
                      auth.selectOrganization(membership.organizationId);
                      toast.success('Active organization changed', membership.organizationName);
                    }}
                  >
                    Switch to this organization
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="danger-zone stagger-3" style={{ marginTop: 24 }} aria-labelledby="password-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Security</span>
            <h2 id="password-title">Change password</h2>
            <p className="page-subtitle">Submitted to /auth/change-password. A successful change revokes active refresh tokens.</p>
          </div>
        </div>

        {formError && (
          <div className="alert alert-danger form-error-banner" style={{ marginBottom: 16 }} role="alert">
            <AlertTriangle size={17} aria-hidden="true" /> <span>{formError}</span>
          </div>
        )}
        {done && (
          <div className="alert alert-success form-error-banner" style={{ marginBottom: 16 }} role="status" aria-live="polite">
            <CheckCircle2 size={17} aria-hidden="true" /> <span>Password changed successfully. Sign in again on other devices.</span>
          </div>
        )}

        <form onSubmit={submit} noValidate className="form-grid" style={{ maxWidth: 680 }}>
          <div style={{ position: 'relative' }}>
            <FormField label="Current password" error={errors.currentPassword} required full>
              <input
                className="input"
                style={{ paddingRight: 44 }}
                type={visible.current ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
              />
            </FormField>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              style={{ position: 'absolute', right: 4, top: 28 }}
              aria-label={visible.current ? 'Hide current password' : 'Show current password'}
              aria-pressed={visible.current}
              onClick={() => toggleVisibility('current')}
            >
              {visible.current ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <FormField label="New password" error={errors.newPassword} required>
              <input
                className="input"
                style={{ paddingRight: 44 }}
                type={visible.next ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
              />
            </FormField>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              style={{ position: 'absolute', right: 4, top: 28 }}
              aria-label={visible.next ? 'Hide new password' : 'Show new password'}
              aria-pressed={visible.next}
              onClick={() => toggleVisibility('next')}
            >
              {visible.next ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <FormField label="Confirm new password" error={errors.confirmPassword} required>
              <input
                className="input"
                style={{ paddingRight: 44 }}
                type={visible.confirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              />
            </FormField>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              style={{ position: 'absolute', right: 4, top: 28 }}
              aria-label={visible.confirm ? 'Hide confirmation password' : 'Show confirmation password'}
              aria-pressed={visible.confirm}
              onClick={() => toggleVisibility('confirm')}
            >
              {visible.confirm ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>

          <div className="form-field-full">
            <div
              role="progressbar"
              aria-label="Password strength"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={strength}
              style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}
            >
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  style={{
                    height: 5,
                    flex: 1,
                    borderRadius: 99,
                    background: index < strength ? STRENGTH_COLORS[strength - 1] : 'var(--color-border-strong)',
                  }}
                />
              ))}
              <strong style={{ fontSize: 'var(--text-xs)', minWidth: 56 }}>{STRENGTH_LABELS[strength]}</strong>
            </div>
            <span className="field-hint">Use 10–72 characters with mixed case, numbers and symbols for a strong password.</span>
          </div>

          <div className="form-actions form-field-full" style={{ marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={changePassword.isPending}>
              <KeyRound size={15} aria-hidden="true" /> {changePassword.isPending ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>

      <section className="surface surface-glass stagger-3" style={{ marginTop: 24 }} aria-labelledby="profile-limits-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">API scope</span>
            <h2 id="profile-limits-title">What this page can and cannot change</h2>
          </div>
        </div>
        <p className="text-sm text-muted" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={16} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
          Profile fields are read-only in this build: the API exposes no profile-edit endpoint. There is also no endpoint to list or revoke individual sessions; a password change revokes refresh tokens, and signing out ends the current session.
        </p>
      </section>
    </div>
  );
}
