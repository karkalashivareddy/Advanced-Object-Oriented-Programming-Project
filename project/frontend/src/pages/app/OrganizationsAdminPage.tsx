import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Info, Pencil, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ROLES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { useInvalidateDomains } from '@/lib/queryCache';
import { humanize } from '@/lib/utils';
import {
  DataTable,
  Drawer,
  ErrorState,
  FormField,
  FreshnessIndicator,
  Grid,
  Input,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  Surface,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import type { PageResponse } from '@/types/api';
import type { OrganizationView, Role, UserView } from '@/types/domain';

interface MemberView {
  userId: number;
  fullName?: string;
  email?: string;
  /** The organization-scoped membership role, never inferred from global roles. */
  role?: Role;
}

interface OrgForm {
  name: string;
  type: 'BLOOD_BANK' | 'HOSPITAL';
  registrationCode: string;
  city: string;
  state: string;
  contactEmail: string;
  phone: string;
  serviceArea: string;
}

interface OrgEditForm {
  name: string;
  city: string;
  state: string;
  contactEmail: string;
  phone: string;
  serviceArea: string;
}

const EMPTY_ORG: OrgForm = {
  name: '',
  type: 'BLOOD_BANK',
  registrationCode: '',
  city: '',
  state: '',
  contactEmail: '',
  phone: '',
  serviceArea: '',
};

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** GET /organizations/{id}/members returns UserView records, whose memberships
 *  carry the actual organization-scoped role. Never fall back to a global role. */
function normaliseMembers(users: UserView[] | undefined, organizationId: number | null): MemberView[] {
  return (users ?? []).map((user) => {
    const membership = user.memberships?.find((item) => item.organizationId === organizationId);
    return {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: membership && isRole(membership.role) ? membership.role : undefined,
    };
  });
}

function editFormFrom(org: OrganizationView): OrgEditForm {
  return {
    name: org.name,
    city: org.city ?? '',
    state: org.state ?? '',
    contactEmail: org.contactEmail,
    phone: org.phone ?? '',
    serviceArea: org.serviceArea ?? '',
  };
}

export function OrganizationsAdminPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<OrgForm>(EMPTY_ORG);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState('');
  const [verifyTarget, setVerifyTarget] = useState<OrganizationView | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<OrgEditForm | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const debouncedMemberSearch = useDebouncedValue(memberSearch);
  const [pickedUser, setPickedUser] = useState<UserView | null>(null);
  const [memberRole, setMemberRole] = useState<Role>('MEDICAL_STAFF');
  const [memberError, setMemberError] = useState('');

  const isPlatformAdmin = auth.hasRole('PLATFORM_ADMIN');
  const canManage = auth.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE);
  const canLookUpUsers = auth.hasPermission(PERMISSIONS.USER_READ);
  const activeMembership = auth.user?.memberships.find(
    (membership) => membership.organizationId === auth.organizationId,
  );

  // The organizations endpoint accepts pagination only; search is page-scoped.
  const orgsQuery = useQuery({
    queryKey: ['organizations', page],
    queryFn: () => api.get<PageResponse<OrganizationView>>('/organizations', {
      query: { page, size: 20 },
    }),
  });

  const detailQuery = useQuery({
    queryKey: ['organizations', 'detail', selectedId],
    queryFn: () => api.get<OrganizationView>(`/organizations/${selectedId}`),
    enabled: selectedId !== null,
  });

  const membersQuery = useQuery({
    queryKey: ['organizations', selectedId, 'members'],
    queryFn: () => api.get<UserView[]>(`/organizations/${selectedId}/members`),
    enabled: selectedId !== null,
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'picker', debouncedMemberSearch],
    queryFn: () => api.get<PageResponse<UserView>>('/users', {
      query: { search: debouncedMemberSearch || undefined, size: 12 },
    }),
    enabled: selectedId !== null && canManage && canLookUpUsers && pickedUser === null,
  });

  const invalidate = () => invalidateDomains(['organizations', 'users', 'dashboard']);

  const verify = useMutation({
    mutationFn: (id: number) => api.post<OrganizationView>(`/organizations/${id}/verify`),
    onSuccess: () => {
      toast.success('Organization verified');
      setVerifyTarget(null);
      invalidate();
    },
    onError: (error) => toast.error('Could not verify organization', getErrorMessage(error)),
  });

  const createOrg = useMutation({
    mutationFn: () => api.post<OrganizationView>('/organizations', form),
    onSuccess: () => {
      toast.success('Organization created');
      setCreateOpen(false);
      setForm(EMPTY_ORG);
      setErrors({});
      setCreateError('');
      invalidate();
    },
    onError: (error) => {
      setCreateError(getErrorMessage(error));
      toast.error('Could not create organization', getErrorMessage(error));
    },
  });

  const updateOrg = useMutation({
    mutationFn: () => api.patch<OrganizationView>(`/organizations/${editingId}`, editForm),
    onSuccess: () => {
      toast.success('Organization details updated');
      setEditError('');
      setEditingId(null);
      setEditForm(null);
      invalidate();
    },
    onError: (error) => {
      setEditError(getErrorMessage(error));
      toast.error('Could not update organization', getErrorMessage(error));
    },
  });

  const addMember = useMutation({
    mutationFn: () => api.post<void>(`/organizations/${selectedId}/members`, {
      userId: pickedUser?.id,
      role: memberRole,
    }),
    onSuccess: () => {
      toast.success('Member added');
      setPickedUser(null);
      setMemberSearch('');
      setMemberRole('MEDICAL_STAFF');
      setMemberError('');
      invalidateDomains(['organizations', 'users', 'dashboard']);
    },
    onError: (error) => {
      setMemberError(getErrorMessage(error));
      toast.error('Could not add member', getErrorMessage(error));
    },
  });

  const submitOrg = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    if (!form.registrationCode.trim()) next.registrationCode = 'Registration code is required.';
    if (!form.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      next.contactEmail = 'Enter a valid contact email.';
    }
    setErrors(next);
    setCreateError('');
    if (Object.keys(next).length === 0) createOrg.mutate();
  };

  const submitEdit = () => {
    if (!editForm) return;
    const next: Record<string, string> = {};
    if (!editForm.name.trim()) next.name = 'Name is required.';
    if (!editForm.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.contactEmail.trim())) {
      next.contactEmail = 'Enter a valid contact email.';
    }
    setEditErrors(next);
    setEditError('');
    if (Object.keys(next).length === 0) updateOrg.mutate();
  };

  const detail = detailQuery.data;
  const members = normaliseMembers(membersQuery.data, selectedId);
  const memberIds = new Set(members.map((member) => member.userId));
  const allOrganizations = orgsQuery.data?.content ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const organizations = term
    ? allOrganizations.filter((org) =>
        `${org.name} ${org.registrationCode} ${org.city ?? ''} ${org.state ?? ''}`.toLowerCase().includes(term))
    : allOrganizations;
  const verifiedOnPage = allOrganizations.filter((org) => org.verified).length;

  const columns: DataTableColumn<OrganizationView>[] = [
    {
      key: 'name',
      header: 'Organization',
      render: (org) => (
        <div className="stack" style={{ gap: 2 }}>
          <div className="table-cell-strong">{org.name}</div>
          <div className="text-xs text-subtle mono">{org.registrationCode}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (org) => humanize(org.type) },
    { key: 'location', header: 'Location', render: (org) => [org.city, org.state].filter(Boolean).join(', ') || '—' },
    { key: 'contactEmail', header: 'Contact', render: (org) => org.contactEmail },
    { key: 'verified', header: 'Verified', render: (org) => <StatusBadge status={org.verified ? 'VERIFIED' : 'PENDING_VERIFICATION'} /> },
    { key: 'active', header: 'Active', render: (org) => <StatusBadge status={org.active ? 'ACTIVE' : 'DISABLED'} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (org) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(org.id)}>View</button>
          {isPlatformAdmin && !org.verified && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { verify.reset(); setVerifyTarget(org); }}>
              <ShieldCheck size={13} aria-hidden="true" /> Verify
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="app-page page-enter">
      <PageHeader
        eyebrow="Administration"
        title="Organizations"
        description="Onboard blood banks and hospitals, verify them, and manage memberships through the organizations API."
        actions={
          <div className="section-actions">
            <span className="live-pill" title={auth.organizationId ? `Organization #${auth.organizationId}` : 'No active organization'}>
              <span className="live-dot" aria-hidden="true" />
              {activeMembership ? `Active: ${activeMembership.organizationName}` : isPlatformAdmin ? 'Platform admin context' : 'No active organization'}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={orgsQuery.isFetching}
              onClick={() => void orgsQuery.refetch()}
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
            {isPlatformAdmin && (
              <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={16} aria-hidden="true" /> New organization
              </button>
            )}
          </div>
        }
      />

      {!orgsQuery.isError && (
        <section className="stagger-1" aria-label="Organization summary">
          <Grid columns="stats">
            <StatCard
              label="Organizations (server total)"
              value={orgsQuery.data?.totalElements ?? '—'}
              hint="From /organizations pagination"
            />
            <StatCard
              label="Verified on this page"
              value={orgsQuery.data ? verifiedOnPage : '—'}
              hint="Page-scoped count"
            />
            <StatCard
              label="Active context"
              value={
                <span style={{ fontSize: 'var(--text-base)' }}>
                  {activeMembership?.organizationName ?? (isPlatformAdmin ? 'Platform admin' : 'None')}
                </span>
              }
              hint="Selected from the top bar"
            />
          </Grid>
        </section>
      )}

      <div className="stagger-2" style={{ margin: '16px 0' }}>
        <FreshnessIndicator
          updatedAt={orgsQuery.dataUpdatedAt || undefined}
          refreshing={orgsQuery.isFetching && !orgsQuery.isPending}
          onRefresh={() => { void orgsQuery.refetch(); }}
          refetchOnVisible
          label="Organizations"
        />
        <p className="text-xs text-subtle" style={{ marginTop: 8 }}>
          <span className="status-chip">Page-scoped search</span> The organizations API has no search parameter; this field filters the loaded page. Creating and verifying organizations requires platform admin access.
        </p>
      </div>

      {orgsQuery.isError ? (
        <Surface as="section" variant="glass" padding="md" className="stagger-2">
          <ErrorState
            title="Organizations could not be loaded"
            error={orgsQuery.error}
            onRetry={() => void orgsQuery.refetch()}
          />
        </Surface>
      ) : (
        <div className="stagger-2">
          <DataTable
            ariaLabel="Organization list"
            rowKey={(row) => row.id}
            columns={columns}
            rows={organizations}
            loading={orgsQuery.isPending}
            page={orgsQuery.data?.page ?? page}
            size={orgsQuery.data?.size ?? 20}
            totalElements={orgsQuery.data?.totalElements}
            onPageChange={setPage}
            onRowClick={(org) => setSelectedId(org.id)}
            emptyTitle="No organizations"
            emptyDescription="Create an organization or adjust your page search."
            toolbar={
              <div className="toolbar">
                <div className="filter-grid">
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="organizations-search">Search organizations on this page</label>
                    <div className="search-input-wrap">
                      <Search size={15} aria-hidden="true" />
                      <Input
                        id="organizations-search"
                        type="search"
                        placeholder="Search organizations…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="section-actions">
                  <span className="chip">{organizations.length} shown on this page</span>
                </div>
              </div>
            }
          />
        </div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail?.name ?? 'Organization'}
        description={detail ? `${humanize(detail.type)} · ${detail.registrationCode}` : undefined}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><div className="skeleton" style={{ height: 18 }} /><div className="skeleton" style={{ height: 18 }} /></div>}
        {detailQuery.isError && (
          <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        )}
        {detail && (
          <>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{detail.publicId}</dd></div>
              <div className="detail-item"><dt>Type</dt><dd>{humanize(detail.type)}</dd></div>
              <div className="detail-item"><dt>City</dt><dd>{detail.city || '—'}</dd></div>
              <div className="detail-item"><dt>State</dt><dd>{detail.state || '—'}</dd></div>
              <div className="detail-item"><dt>Contact email</dt><dd>{detail.contactEmail}</dd></div>
              <div className="detail-item"><dt>Phone</dt><dd>{detail.phone || '—'}</dd></div>
              <div className="detail-item"><dt>Service area</dt><dd>{detail.serviceArea || '—'}</dd></div>
              <div className="detail-item"><dt>Verification</dt><dd><StatusBadge status={detail.verified ? 'VERIFIED' : 'PENDING_VERIFICATION'} /></dd></div>
              <div className="detail-item"><dt>Active</dt><dd><StatusBadge status={detail.active ? 'ACTIVE' : 'DISABLED'} /></dd></div>
            </dl>
            <div className="section-actions" style={{ marginTop: 16 }}>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingId(detail.id);
                    setEditForm(editFormFrom(detail));
                    setEditErrors({});
                    setEditError('');
                    setSelectedId(null);
                  }}
                >
                  <Pencil size={14} aria-hidden="true" /> Edit details
                </button>
              )}
              {isPlatformAdmin && !detail.verified && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                  verify.reset();
                  setSelectedId(null);
                  setVerifyTarget(detail);
                }}>
                  <ShieldCheck size={15} aria-hidden="true" /> Verify organization
                </button>
              )}
            </div>

            <hr className="divider" />
            <div className="section-heading">
              <div>
                <h3>Members</h3>
                <p className="text-xs text-subtle">Roles are organization-scoped membership roles returned by the API.</p>
              </div>
            </div>
            {membersQuery.isPending && <div className="skeleton" style={{ height: 50 }} />}
            {membersQuery.isError && (
              <ErrorState error={membersQuery.error} title="Member list unavailable" onRetry={() => void membersQuery.refetch()} />
            )}
            {membersQuery.isSuccess && members.length === 0 && <p className="text-sm text-muted">No members returned.</p>}
            <div className="stack" style={{ marginTop: 8 }}>
              {members.map((member) => (
                <div className="item-header" key={member.userId}>
                  <div>
                    <strong>{member.fullName ?? `User #${member.userId}`}</strong>
                    <div className="text-xs text-muted">{member.email ?? '—'} · ID {member.userId}</div>
                  </div>
                  {member.role
                    ? <span className="chip">{humanize(member.role)}</span>
                    : <span className="status-chip">Role not returned</span>}
                </div>
              ))}
            </div>

            {canManage && (
              <Surface as="section" variant="raised" padding="md" style={{ marginTop: 16 }}>
                <h3>Add a member</h3>
                <p className="text-xs text-subtle" style={{ marginBottom: 12 }}>
                  Search the user directory; the backend only supports creating memberships. Removal and role changes are not exposed by the API.
                </p>
                <div className="form-grid">
                  <FormField label="User" required full error={memberError}>
                    {pickedUser ? (
                      <div className="item-header">
                        <div>
                          <strong>{pickedUser.fullName}</strong>
                          <div className="text-xs text-subtle">{pickedUser.email} · ID {pickedUser.id}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon"
                          aria-label="Clear selected user"
                          onClick={() => setPickedUser(null)}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="search-input-wrap">
                          <Search size={15} aria-hidden="true" />
                          <input
                            className="input"
                            type="search"
                            aria-label="Search users to add"
                            placeholder="Search name or email…"
                            value={memberSearch}
                            onChange={(event) => setMemberSearch(event.target.value)}
                          />
                        </div>
                        {!canLookUpUsers && (
                          <span className="field-hint">User lookup requires USER_READ permission.</span>
                        )}
                        {canLookUpUsers && usersQuery.isPending && <span className="field-hint">Searching users…</span>}
                        {canLookUpUsers && usersQuery.isError && (
                          <span className="field-error" role="alert">User search failed: {getErrorMessage(usersQuery.error)}</span>
                        )}
                        {canLookUpUsers && usersQuery.data?.content.length === 0 && (
                          <span className="field-hint">No users match this search.</span>
                        )}
                        {canLookUpUsers && usersQuery.data && usersQuery.data.content.length > 0 && (
                          <div className="mobile-card-list" style={{ marginTop: 8 }}>
                            {usersQuery.data.content.map((user) => {
                              const alreadyMember = memberIds.has(user.id);
                              return (
                                <button
                                  type="button"
                                  key={user.id}
                                  className="surface-interactive"
                                  disabled={alreadyMember}
                                  onClick={() => { setPickedUser(user); setMemberSearch(''); setMemberError(''); }}
                                >
                                  <strong>{user.fullName}</strong>
                                  <span className="text-xs text-subtle">{user.email} · ID {user.id}</span>
                                  {alreadyMember && <span className="status-chip">Already a member</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </FormField>
                  <FormField label="Membership role" required full>
                    <select className="select" value={memberRole} onChange={(event) => setMemberRole(event.target.value as Role)}>
                      {ROLES.map((role) => <option key={role} value={role}>{humanize(role)}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="form-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={addMember.isPending || !pickedUser}
                    onClick={() => addMember.mutate()}
                  >
                    {addMember.isPending ? 'Adding…' : 'Add member'}
                  </button>
                </div>
              </Surface>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={verifyTarget !== null}
        onClose={() => setVerifyTarget(null)}
        title="Verify organization"
        description={verifyTarget ? verifyTarget.name : undefined}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setVerifyTarget(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={verify.isPending}
              onClick={() => verifyTarget && verify.mutate(verifyTarget.id)}
            >
              {verify.isPending ? 'Verifying…' : 'Confirm verification'}
            </button>
          </>
        }
      >
        <p>
          Verify <strong>{verifyTarget?.name}</strong>? This calls the verification endpoint and refreshes the cached organization list.
        </p>
        {verify.isError && (
          <div className="alert alert-danger form-error-banner" style={{ marginTop: 12 }} role="alert">
            <ShieldCheck size={17} aria-hidden="true" /> <span>{getErrorMessage(verify.error)}</span>
          </div>
        )}
      </Modal>

      <Modal
        open={editForm !== null}
        onClose={() => { setEditingId(null); setEditForm(null); }}
        title="Edit organization details"
        description="Uses PATCH /organizations/{id}."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setEditForm(null); }}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={updateOrg.isPending} onClick={submitEdit}>
              {updateOrg.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        {editForm && (
          <div className="form-grid">
            <FormField label="Name" error={editErrors.name} required full>
              <input className="input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            </FormField>
            <FormField label="City">
              <input className="input" value={editForm.city} onChange={(event) => setEditForm({ ...editForm, city: event.target.value })} />
            </FormField>
            <FormField label="State">
              <input className="input" value={editForm.state} onChange={(event) => setEditForm({ ...editForm, state: event.target.value })} />
            </FormField>
            <FormField label="Contact email" error={editErrors.contactEmail} required>
              <input className="input" type="email" value={editForm.contactEmail} onChange={(event) => setEditForm({ ...editForm, contactEmail: event.target.value })} />
            </FormField>
            <FormField label="Phone">
              <input className="input" type="tel" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} />
            </FormField>
            <FormField label="Service area" full>
              <input className="input" value={editForm.serviceArea} onChange={(event) => setEditForm({ ...editForm, serviceArea: event.target.value })} />
            </FormField>
            {editError && (
              <div className="alert alert-danger form-error-banner form-field-full" role="alert">
                <ShieldCheck size={17} aria-hidden="true" /> <span>{editError}</span>
              </div>
            )}
            <p className="text-xs text-subtle form-field-full">
              <Info size={13} aria-hidden="true" /> Verification status and registration code cannot be changed through the update endpoint.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateError(''); }}
        title="New organization"
        description="Creates an organization through the organizations API (platform admin only)."
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setCreateOpen(false); setCreateError(''); }}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={createOrg.isPending} onClick={submitOrg}>
              {createOrg.isPending ? 'Creating…' : 'Create organization'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="Name" error={errors.name} required full>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FormField>
          <FormField label="Type" required>
            <select className="select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as OrgForm['type'] })}>
              <option value="BLOOD_BANK">Blood bank</option>
              <option value="HOSPITAL">Hospital</option>
            </select>
          </FormField>
          <FormField label="Registration code" error={errors.registrationCode} required>
            <input className="input" value={form.registrationCode} onChange={(event) => setForm({ ...form, registrationCode: event.target.value })} />
          </FormField>
          <FormField label="City"><input className="input" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></FormField>
          <FormField label="State"><input className="input" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></FormField>
          <FormField label="Contact email" error={errors.contactEmail} required>
            <input className="input" type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
          </FormField>
          <FormField label="Phone"><input className="input" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField>
          <FormField label="Service area" full><input className="input" value={form.serviceArea} onChange={(event) => setForm({ ...form, serviceArea: event.target.value })} /></FormField>
          {createError && (
            <div className="alert alert-danger form-error-banner form-field-full" role="alert">
              <ShieldCheck size={17} aria-hidden="true" /> <span>{createError}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
