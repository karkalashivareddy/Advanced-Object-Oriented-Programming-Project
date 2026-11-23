import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { humanize } from '@/lib/utils';
import { ErrorState, FormField, PageHeader, StatusBadge } from '@/components/ui';

interface Errors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function ProfilePage() {
  const auth = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState(false);

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/change-password', {
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    }),
    onSuccess: () => {
      setDone(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setErrors({});
      setFormError('');
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setDone(false);
    setFormError('');
    const next: Errors = {};
    if (!form.currentPassword) next.currentPassword = 'Current password is required.';
    if (form.newPassword.length < 10) next.newPassword = 'Use at least 10 characters.';
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length === 0) changePassword.mutate();
  };

  if (!auth.user) return <ErrorState error="No signed-in user." />;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Your identity, access, and organization memberships."
      />

      <div className="dashboard-grid">
        <section className="card" aria-labelledby="profile-identity-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="profile-identity-title">Identity</h2>
              <p className="card-subtitle">Loaded from the authenticated user record.</p>
            </div>
            <StatusBadge status={auth.user.status} />
          </div>
          <div className="card-body">
            <dl className="detail-grid">
              <div className="detail-item"><dt>Full name</dt><dd>{auth.user.fullName}</dd></div>
              <div className="detail-item"><dt>Email</dt><dd>{auth.user.email}</dd></div>
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{auth.user.publicId}</dd></div>
              <div className="detail-item"><dt>User ID</dt><dd className="mono">{auth.user.id}</dd></div>
            </dl>
            <hr className="divider" />
            <h3>Roles</h3>
            <div className="cluster" style={{ marginTop: 8 }}>
              {auth.user.roles.map((role) => <span className="badge badge-info" key={role}>{humanize(role)}</span>)}
            </div>
            <h3 style={{ marginTop: 20 }}>Permissions</h3>
            <div className="cluster" style={{ marginTop: 8 }}>
              {auth.user.permissions.length === 0
                ? <span className="text-muted">No explicit permissions returned; roles determine access.</span>
                : auth.user.permissions.map((permission) => <span className="chip" key={permission}>{humanize(permission)}</span>)}
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="profile-memberships-title">
          <div className="card-header">
            <div>
              <h2 className="card-title" id="profile-memberships-title">Memberships</h2>
              <p className="card-subtitle">Switch organizations from the top bar.</p>
            </div>
          </div>
          <div className="card-body">
            {auth.user.memberships.length === 0 && <p className="text-sm text-muted">No organization memberships yet.</p>}
            <div className="stack">
              {auth.user.memberships.map((membership) => (
                <div className="item-header" key={membership.organizationId}>
                  <div>
                    <strong>{membership.organizationName}</strong>
                    <div className="text-xs text-muted">Organization #{membership.organizationId}</div>
                  </div>
                  <span className="chip">{humanize(membership.role)}</span>
                </div>
              ))}
            </div>
            <hr className="divider" />
            <p className="text-xs text-subtle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={13} aria-hidden="true" /> Permissions displayed here are advisory; the API enforces access.
            </p>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="password-title">
        <div className="card-header">
          <div>
            <h2 className="card-title" id="password-title">Change password</h2>
            <p className="card-subtitle">Submitted to /auth/change-password.</p>
          </div>
        </div>
        <div className="card-body">
          {formError && (
            <div className="alert alert-danger form-error-banner" style={{ marginBottom: 16 }} role="alert">
              <AlertTriangle size={17} aria-hidden="true" /> <span>{formError}</span>
            </div>
          )}
          {done && (
            <div className="alert alert-success form-error-banner" style={{ marginBottom: 16 }} role="status">
              <CheckCircle2 size={17} aria-hidden="true" /> <span>Password changed successfully.</span>
            </div>
          )}
          <form onSubmit={submit} noValidate className="form-grid" style={{ maxWidth: 640 }}>
            <FormField label="Current password" error={errors.currentPassword} required full>
              <input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} />
            </FormField>
            <FormField label="New password" error={errors.newPassword} required>
              <input className="input" type="password" autoComplete="new-password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
            </FormField>
            <FormField label="Confirm new password" error={errors.confirmPassword} required>
              <input className="input" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
            </FormField>
            <div className="form-field-full">
              <button type="submit" className="btn btn-primary" disabled={changePassword.isPending}>
                <KeyRound size={15} aria-hidden="true" /> Update password
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
