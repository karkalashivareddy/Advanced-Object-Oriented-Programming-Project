import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, RefreshCw, Search, ShieldAlert, UserCog, X } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PERMISSIONS } from '@/lib/permissions';
import { useInvalidateDomains } from '@/lib/queryCache';
import { ROLES, USER_STATUSES } from '@/lib/constants';
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
  Select,
  StatCard,
  StatusBadge,
  Surface,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { PageResponse } from '@/types/api';
import type { Role, UserStatus, UserView } from '@/types/domain';

const PAGE_SIZE = 20;

function statusActionLabel(status: UserStatus): string {
  if (status === 'LOCKED') return 'Lock account';
  if (status === 'DISABLED') return 'Disable account';
  return 'Save status';
}

export function UsersAdminPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [target, setTarget] = useState<UserView | null>(null);
  const [nextStatus, setNextStatus] = useState<UserStatus>('ACTIVE');
  const [confirmText, setConfirmText] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [detail, setDetail] = useState<UserView | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', debouncedSearch, page, PAGE_SIZE],
    queryFn: () => api.get<PageResponse<UserView>>('/users', {
      query: { search: debouncedSearch || undefined, page, size: PAGE_SIZE },
    }),
  });

  const canManage = auth.hasPermission(PERMISSIONS.USER_MANAGE);
  const isSelf = target?.id === auth.user?.id;
  const isRestrictiveChange = nextStatus === 'LOCKED' || nextStatus === 'DISABLED';
  const selfBlocked = Boolean(isSelf && nextStatus !== 'ACTIVE');
  const confirmationComplete = !isRestrictiveChange || confirmText.trim() === target?.email;

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: UserStatus }) =>
      api.patch<UserView>(`/users/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Account status updated');
      setTarget(null);
      setConfirmText('');
      setMutationError('');
      invalidateDomains(['users', 'audit']);
    },
    onError: (error) => {
      setMutationError(getErrorMessage(error));
      toast.error('Could not update account', getErrorMessage(error));
    },
  });

  const copyValue = async (value: string, label: string) => {
    if (!navigator.clipboard) {
      toast.error('Clipboard is not available in this browser');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`, value);
    } catch {
      toast.error(`Could not copy the ${label.toLowerCase()}`);
    }
  };

  const allUsers = usersQuery.data?.content ?? [];
  const organizationOptions = useMemo(() => {
    const options = new Map<number, string>();
    allUsers.forEach((user) => user.memberships.forEach((membership) => {
      options.set(membership.organizationId, membership.organizationName);
    }));
    return Array.from(options.entries()).sort((left, right) => left[1].localeCompare(right[1]));
  }, [allUsers]);
  const users = useMemo(() => allUsers.filter((user) => {
    if (statusFilter && user.status !== statusFilter) return false;
    if (roleFilter && !user.roles.includes(roleFilter as Role)) return false;
    if (organizationFilter && !user.memberships.some((membership) => String(membership.organizationId) === organizationFilter)) return false;
    return true;
  }), [allUsers, statusFilter, roleFilter, organizationFilter]);
  const hasFilters = Boolean(statusFilter || roleFilter || organizationFilter);

  const clearFilters = () => {
    setStatusFilter('');
    setRoleFilter('');
    setOrganizationFilter('');
  };

  const openStatusDialog = (user: UserView) => {
    setDetail(null);
    setTarget(user);
    setNextStatus(user.status);
    setConfirmText('');
    setMutationError('');
  };

  const submitStatus = () => {
    if (!target || selfBlocked || !confirmationComplete || nextStatus === target.status) return;
    update.mutate({ id: target.id, status: nextStatus });
  };

  const columns: DataTableColumn<UserView>[] = [
    {
      key: 'fullName',
      header: 'User',
      render: (user) => (
        <div className="stack" style={{ gap: 2 }}>
          <div className="table-cell-strong">{user.fullName}</div>
          <div className="text-xs text-subtle">{user.email}</div>
        </div>
      ),
    },
    { key: 'publicId', header: 'Public ID', render: (user) => <span className="mono text-xs">{user.publicId}</span> },
    {
      key: 'roles',
      header: 'Roles',
      render: (user) => (
        <div className="cluster">
          {user.roles.map((role) => <span className="chip" key={role}>{humanize(role)}</span>)}
        </div>
      ),
    },
    {
      key: 'memberships',
      header: 'Organizations',
      render: (user) => user.memberships.length
        ? (
          <div className="stack" style={{ gap: 2 }}>
            {user.memberships.map((membership) => (
              <span key={membership.organizationId} className="text-xs">
                {membership.organizationName} <span className="text-subtle">· {humanize(membership.role)}</span>
              </span>
            ))}
          </div>
        )
        : <span className="text-subtle">—</span>,
    },
    { key: 'status', header: 'Status', render: (user) => <StatusBadge status={user.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (user) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(user)}>View</button>
          {canManage && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openStatusDialog(user)}>
              Change status
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
        title="Users"
        description="Review accounts and change account status through the user administration API."
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={usersQuery.isFetching}
            onClick={() => void usersQuery.refetch()}
          >
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {!usersQuery.isError && (
        <section className="stagger-1" aria-label="User summary">
          <Grid columns="stats">
            <StatCard
              label="Accounts (server total)"
              value={usersQuery.data?.totalElements ?? '—'}
              hint="From /users pagination"
            />
            <StatCard
              label="On this page"
              value={usersQuery.data ? allUsers.length : '—'}
              hint={`Page ${usersQuery.data?.page !== undefined ? usersQuery.data.page + 1 : '—'} of ${usersQuery.data?.totalPages ?? '—'}`}
            />
            <StatCard
              label="Shown after filters"
              value={usersQuery.data ? users.length : '—'}
              hint={hasFilters ? 'Page-scoped filters active' : 'No filters active'}
            />
          </Grid>
        </section>
      )}

      <div className="stagger-2" style={{ margin: '16px 0' }}>
        <FreshnessIndicator
          updatedAt={usersQuery.dataUpdatedAt || undefined}
          refreshing={usersQuery.isFetching && !usersQuery.isPending}
          onRefresh={() => { void usersQuery.refetch(); }}
          refetchOnVisible
          label="User directory"
        />
        <p className="text-xs text-subtle" style={{ marginTop: 8 }}>
          <span className="status-chip">Page-scoped filters</span> Status, role and organization filters apply to the current page because /users only supports search and pagination.
        </p>
      </div>

      {usersQuery.isError ? (
        <Surface as="section" variant="glass" padding="md" className="stagger-2">
          <ErrorState
            title="Users could not be loaded"
            error={usersQuery.error}
            onRetry={() => void usersQuery.refetch()}
          />
        </Surface>
      ) : (
        <div className="stagger-2">
          <DataTable
            ariaLabel="User accounts"
            rowKey={(row) => row.id}
            columns={columns}
            rows={users}
            loading={usersQuery.isPending}
            page={usersQuery.data?.page ?? page}
            size={usersQuery.data?.size ?? PAGE_SIZE}
            totalElements={usersQuery.data?.totalElements}
            onPageChange={setPage}
            onRowClick={(user) => setDetail(user)}
            emptyTitle={hasFilters ? 'No users on this page match those filters' : 'No users found'}
            emptyDescription={hasFilters ? 'Clear the filters or move to another page.' : 'Try a different search term.'}
            emptyAction={hasFilters ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>
            ) : undefined}
            toolbar={
              <div className="toolbar">
                <div className="filter-grid">
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="users-search">Search users</label>
                    <div className="search-input-wrap">
                      <Search size={15} aria-hidden="true" />
                      <Input
                        id="users-search"
                        type="search"
                        placeholder="Search name or email…"
                        value={search}
                        onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                      />
                    </div>
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="users-status-filter">Status on this page</label>
                    <Select
                      id="users-status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="">All statuses</option>
                      {USER_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                    </Select>
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="users-role-filter">Role on this page</label>
                    <Select
                      id="users-role-filter"
                      value={roleFilter}
                      onChange={(event) => setRoleFilter(event.target.value)}
                    >
                      <option value="">All roles</option>
                      {ROLES.map((role) => <option key={role} value={role}>{humanize(role)}</option>)}
                    </Select>
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="users-org-filter">Organization on this page</label>
                    <Select
                      id="users-org-filter"
                      value={organizationFilter}
                      onChange={(event) => setOrganizationFilter(event.target.value)}
                    >
                      <option value="">All organizations</option>
                      {organizationOptions.map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="section-actions">
                  {hasFilters && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                      <X size={14} aria-hidden="true" /> Clear filters
                    </button>
                  )}
                  <span className="chip"><UserCog size={12} aria-hidden="true" /> {users.length} shown</span>
                </div>
              </div>
            }
          />
        </div>
      )}

      <Drawer
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.fullName ?? 'User'}
        description={detail ? `${detail.email} · ${humanize(detail.status)}` : undefined}
        footer={detail && canManage ? (
          <button type="button" className="btn btn-primary" onClick={() => openStatusDialog(detail)}>
            Change status
          </button>
        ) : undefined}
      >
        {detail && (
          <>
            <dl className="detail-grid">
              <div className="detail-item"><dt>Status</dt><dd><StatusBadge status={detail.status} /></dd></div>
              <div className="detail-item"><dt>User ID</dt><dd className="mono">{detail.id}</dd></div>
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{detail.publicId}</dd></div>
              <div className="detail-item"><dt>Email</dt><dd>{detail.email}</dd></div>
            </dl>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => void copyValue(detail.publicId, 'Public ID')}
            >
              <Copy size={13} aria-hidden="true" /> Copy public ID
            </button>

            <h3 style={{ marginTop: 20 }}>Global roles</h3>
            <div className="cluster" style={{ marginTop: 8 }}>
              {detail.roles.length
                ? detail.roles.map((role) => <span className="chip" key={role}>{humanize(role)}</span>)
                : <span className="text-muted">No roles returned</span>}
            </div>
            <p className="text-xs text-subtle" style={{ marginTop: 8 }}>
              Role assignment is not available in this API. Only account status can be changed here.
            </p>

            <h3 style={{ marginTop: 20 }}>Effective permissions</h3>
            <div className="cluster" style={{ marginTop: 8 }}>
              {detail.permissions.length
                ? detail.permissions.map((permission) => <span className="status-chip" key={permission}>{humanize(permission)}</span>)
                : <span className="text-muted">No explicit permissions returned</span>}
            </div>

            <h3 style={{ marginTop: 20 }}>Organization memberships</h3>
            {detail.memberships.length === 0 && <p className="text-sm text-muted">No memberships returned.</p>}
            <div className="stack" style={{ marginTop: 8 }}>
              {detail.memberships.map((membership) => (
                <div className="item-header" key={membership.organizationId}>
                  <div>
                    <strong>{membership.organizationName}</strong>
                    <div className="text-xs text-subtle">Organization #{membership.organizationId}</div>
                  </div>
                  <span className="chip">{humanize(membership.role)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-subtle" style={{ marginTop: 12 }}>
              Details come from the /users list record; the API does not expose a single-user endpoint.
            </p>
          </>
        )}
      </Drawer>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={isRestrictiveChange ? statusActionLabel(nextStatus) : 'Change account status'}
        description={target ? `${target.fullName} · ${target.email}` : undefined}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
            <button
              type="button"
              className={isRestrictiveChange ? 'btn btn-danger' : 'btn btn-primary'}
              disabled={update.isPending || !target || nextStatus === target.status || selfBlocked || !confirmationComplete}
              onClick={submitStatus}
            >
              {update.isPending ? 'Saving…' : statusActionLabel(nextStatus)}
            </button>
          </>
        }
      >
        {target && (
          <>
            <div className="form-grid">
              <div className="form-field form-field-full">
                <span className="field-label">Current status</span>
                <div><StatusBadge status={target.status} /></div>
                <span className="field-hint">Read from the user record.</span>
              </div>
              <FormField label="New status" required full>
                <select
                  className="select"
                  value={nextStatus}
                  onChange={(event) => { setNextStatus(event.target.value as UserStatus); setConfirmText(''); setMutationError(''); }}
                >
                  {USER_STATUSES.map((item) => (
                    <option key={item} value={item} disabled={isSelf && item !== 'ACTIVE'}>
                      {humanize(item)}{isSelf && item !== 'ACTIVE' ? ' (not available for your own account)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {selfBlocked && (
              <div className="alert alert-warning form-error-banner" style={{ marginTop: 16 }} role="alert">
                <ShieldAlert size={17} aria-hidden="true" />
                <span>You cannot lock, disable or deactivate your own account from this page.</span>
              </div>
            )}

            {isRestrictiveChange && !selfBlocked && (
              <div className="danger-zone" style={{ marginTop: 16 }}>
                <div className="alert alert-danger" role="alert">
                  <ShieldAlert size={17} aria-hidden="true" />
                  <span>
                    {nextStatus === 'LOCKED'
                      ? 'Locking revokes all active refresh sessions for this user.'
                      : 'Disabling revokes all active refresh sessions and blocks sign-in.'}
                  </span>
                </div>
                <FormField
                  label={`Type ${target.email} to confirm`}
                  required
                  full
                  error={confirmText.length > 0 && !confirmationComplete ? 'The email does not match.' : undefined}
                >
                  <input
                    className="input"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    autoComplete="off"
                  />
                </FormField>
              </div>
            )}

            {mutationError && (
              <div className="alert alert-danger form-error-banner" style={{ marginTop: 16 }} role="alert">
                <ShieldAlert size={17} aria-hidden="true" /> <span>{mutationError}</span>
              </div>
            )}

            <p className="text-xs text-subtle" style={{ marginTop: 16 }}>
              <UserCog size={13} aria-hidden="true" /> Known roles in this build: {ROLES.map(humanize).join(', ')}. Role editing is not available through the API.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}
