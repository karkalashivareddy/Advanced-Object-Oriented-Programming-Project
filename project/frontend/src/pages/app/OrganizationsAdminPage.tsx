import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ROLES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { humanize } from '@/lib/utils';
import {
  DataTable,
  Drawer,
  ErrorState,
  FormField,
  Modal,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import type { PageResponse } from '@/types/api';
import type { OrganizationView, Role, UserView } from '@/types/domain';

interface MemberView {
  userId: number;
  fullName?: string;
  email?: string;
  role: Role;
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

function normaliseMembers(payload: unknown, organizationId: number | null): MemberView[] {
  // GET /organizations/{id}/members returns UserView records, not membership records.
  const list = Array.isArray(payload) ? payload : [];
  return list.map((entry) => {
    const value = entry as Record<string, unknown>;
    const roles = Array.isArray(value.roles) ? value.roles as Role[] : [];
    const memberships = Array.isArray(value.memberships)
      ? value.memberships as Array<{ organizationId?: number; role?: Role }>
      : [];
    const membership = memberships.find((item) => item.organizationId === organizationId);
    return {
      userId: Number(value.id),
      fullName: typeof value.fullName === 'string' ? value.fullName : undefined,
      email: typeof value.email === 'string' ? value.email : undefined,
      role: membership?.role ?? roles[0] ?? 'MEDICAL_STAFF',
    };
  });
}

export function OrganizationsAdminPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<OrgForm>(EMPTY_ORG);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [member, setMember] = useState({ userId: '', role: 'MEDICAL_STAFF' });

  // The organizations API accepts pagination only; search is applied locally.
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
    queryFn: () => api.get<unknown>(`/organizations/${selectedId}/members`),
    enabled: selectedId !== null,
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'for-members'],
    queryFn: () => api.get<PageResponse<UserView>>('/users', { query: { size: 50 } }),
    enabled: createOpen || selectedId !== null,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    void queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const verify = useMutation({
    mutationFn: (id: number) => api.post(`/organizations/${id}/verify`),
    onSuccess: () => { toast.success('Organization verified'); invalidate(); },
    onError: (error) => toast.error('Could not verify organization', getErrorMessage(error)),
  });

  const createOrg = useMutation({
    mutationFn: () => api.post<OrganizationView>('/organizations', form),
    onSuccess: () => {
      toast.success('Organization created');
      setCreateOpen(false);
      setForm(EMPTY_ORG);
      setErrors({});
      invalidate();
    },
    onError: (error) => toast.error('Could not create organization', getErrorMessage(error)),
  });

  const addMember = useMutation({
    mutationFn: () => api.post(`/organizations/${selectedId}/members`, {
      userId: Number(member.userId),
      role: member.role,
    }),
    onSuccess: () => {
      toast.success('Member added');
      setMember({ userId: '', role: 'MEDICAL_STAFF' });
      void queryClient.invalidateQueries({ queryKey: ['organizations', selectedId, 'members'] });
      invalidate();
    },
    onError: (error) => toast.error('Could not add member', getErrorMessage(error)),
  });

  const submitOrg = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    if (!form.registrationCode.trim()) next.registrationCode = 'Registration code is required.';
    if (!form.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      next.contactEmail = 'Enter a valid contact email.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) createOrg.mutate();
  };

  const detail = detailQuery.data;
  const members = normaliseMembers(membersQuery.data, selectedId);

  const allOrganizations = orgsQuery.data?.content ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const organizations = term
    ? allOrganizations.filter((org) =>
        `${org.name} ${org.registrationCode} ${org.city ?? ''} ${org.state ?? ''}`.toLowerCase().includes(term))
    : allOrganizations;

  const columns: DataTableColumn<OrganizationView>[] = [
    {
      key: 'name',
      header: 'Organization',
      render: (org) => (
        <div>
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
          {auth.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE) && !org.verified && (
            <button type="button" className="btn btn-primary btn-sm" disabled={verify.isPending} onClick={() => verify.mutate(org.id)}>
              <ShieldCheck size={13} aria-hidden="true" /> Verify
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Organizations"
        description="Onboard blood banks and hospitals, verify them, and manage memberships."
        actions={
          auth.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE) ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden="true" /> New organization
            </button>
          ) : undefined
        }
      />

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
        emptyDescription="Create an organization or adjust your search."
        toolbar={
          <div className="search-input-wrap">
            <Search size={15} aria-hidden="true" />
            <input className="input" type="search" aria-label="Search organizations" placeholder="Search organizations…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
          </div>
        }
      />
      {orgsQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}><ErrorState error={orgsQuery.error} onRetry={() => void orgsQuery.refetch()} /></div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail?.name ?? 'Organization'}
        description={detail ? `${humanize(detail.type)} · ${detail.registrationCode}` : undefined}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /></div>}
        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}
        {detail && (
          <>
            <dl className="detail-grid">
              <div className="detail-item"><dt>City</dt><dd>{detail.city || '—'}</dd></div>
              <div className="detail-item"><dt>State</dt><dd>{detail.state || '—'}</dd></div>
              <div className="detail-item"><dt>Contact email</dt><dd>{detail.contactEmail}</dd></div>
              <div className="detail-item"><dt>Phone</dt><dd>{detail.phone || '—'}</dd></div>
              <div className="detail-item"><dt>Service area</dt><dd>{detail.serviceArea || '—'}</dd></div>
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={detail.verified ? 'VERIFIED' : 'PENDING_VERIFICATION'} /></dd></div>
            </dl>
            {auth.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE) && !detail.verified && (
              <div className="action-row">
                <button type="button" className="btn btn-primary" disabled={verify.isPending} onClick={() => verify.mutate(detail.id)}>
                  <ShieldCheck size={15} aria-hidden="true" /> Verify organization
                </button>
              </div>
            )}

            <hr className="divider" />
            <h3>Members</h3>
            {membersQuery.isPending && <Skeleton height={50} />}
            {membersQuery.isError && <ErrorState error={membersQuery.error} />}
            {membersQuery.isSuccess && members.length === 0 && <p className="text-sm text-muted">No members returned.</p>}
            {members.map((item, index) => (
              <div className="item-header" key={item.userId ?? index}>
                <div>
                  <strong>{item.fullName ?? `User #${item.userId}`}</strong>
                  <div className="text-xs text-muted">{item.email ?? '—'}</div>
                </div>
                <span className="chip">{humanize(item.role)}</span>
              </div>
            ))}
            {auth.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE) && (
              <div className="inline-form" style={{ marginTop: 12 }}>
                <FormField label="User ID" required full>
                  <input className="input" inputMode="numeric" value={member.userId} onChange={(event) => setMember({ ...member, userId: event.target.value })} />
                </FormField>
                <FormField label="Role" required full>
                  <select className="select" value={member.role} onChange={(event) => setMember({ ...member, role: event.target.value })}>
                    {ROLES.map((role) => <option key={role} value={role}>{humanize(role)}</option>)}
                  </select>
                </FormField>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={addMember.isPending || !/^\d+$/.test(member.userId)}
                  onClick={() => addMember.mutate()}
                >
                  Add member
                </button>
                {usersQuery.data && usersQuery.data.content.length > 0 && (
                  <p className="text-xs text-subtle">
                    Available users: {usersQuery.data.content.slice(0, 5).map((user) => `${user.id} ${user.fullName}`).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New organization"
        description="Creates an organization through the organizations API."
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={createOrg.isPending} onClick={submitOrg}>Create organization</button>
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
        </div>
      </Modal>
    </>
  );
}
