import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserCog } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PERMISSIONS } from '@/lib/permissions';
import { ROLES, USER_STATUSES } from '@/lib/constants';
import { humanize } from '@/lib/utils';
import { DataTable, ErrorState, FormField, Modal, PageHeader, StatusBadge, useToast, type DataTableColumn } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { PageResponse } from '@/types/api';
import type { UserView } from '@/types/domain';

export function UsersAdminPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<UserView | null>(null);
  const [status, setStatus] = useState('ACTIVE');

  const usersQuery = useQuery({
    queryKey: ['users', debouncedSearch, page],
    queryFn: () => api.get<PageResponse<UserView>>('/users', {
      query: { search: debouncedSearch || undefined, page, size: 20 },
    }),
  });

  const update = useMutation({
    mutationFn: () => api.patch<UserView>(`/users/${target?.id}/status`, { status }),
    onSuccess: () => {
      toast.success('Account status updated');
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error('Could not update account', getErrorMessage(error)),
  });

  const columns: DataTableColumn<UserView>[] = [
    {
      key: 'fullName',
      header: 'User',
      render: (user) => (
        <div>
          <div className="table-cell-strong">{user.fullName}</div>
          <div className="text-xs text-subtle">{user.email}</div>
        </div>
      ),
    },
    { key: 'publicId', header: 'Public ID', render: (user) => <span className="mono text-xs">{user.publicId}</span> },
    { key: 'roles', header: 'Roles', render: (user) => <div className="cluster">{user.roles.map((role) => <span className="chip" key={role}>{humanize(role)}</span>)}</div> },
    { key: 'memberships', header: 'Organizations', render: (user) => user.memberships.map((membership) => membership.organizationName).join(', ') || '—' },
    { key: 'status', header: 'Status', render: (user) => <StatusBadge status={user.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (user) => (
        auth.hasPermission(PERMISSIONS.USER_MANAGE) ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => { setTarget(user); setStatus(user.status); }}
          >
            Change status
          </button>
        ) : '—'
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Review accounts and change account status through the user administration API."
      />

      <DataTable
        ariaLabel="User accounts"
        rowKey={(row) => row.id}
        columns={columns}
        rows={usersQuery.data?.content ?? []}
        loading={usersQuery.isPending}
        page={usersQuery.data?.page ?? page}
        size={usersQuery.data?.size ?? 20}
        totalElements={usersQuery.data?.totalElements}
        onPageChange={setPage}
        emptyTitle="No users found"
        emptyDescription="Try a different search term."
        toolbar={
          <div className="search-input-wrap">
            <Search size={15} aria-hidden="true" />
            <input className="input" type="search" aria-label="Search users" placeholder="Search name or email…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
          </div>
        }
      />
      {usersQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}><ErrorState error={usersQuery.error} onRetry={() => void usersQuery.refetch()} /></div>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Change account status"
        description={target ? `${target.fullName} · ${target.email}` : undefined}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={update.isPending || status === target?.status} onClick={() => update.mutate()}>Save status</button>
          </>
        }
      >
        <div className="form-grid">
          <FormField label="New status" required full>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
              {USER_STATUSES.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
          </FormField>
        </div>
        <p className="text-xs text-subtle" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserCog size={13} aria-hidden="true" /> Known roles in this build: {ROLES.map(humanize).join(', ')}.
        </p>
      </Modal>
    </>
  );
}
