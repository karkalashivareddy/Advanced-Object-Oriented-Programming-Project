import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/utils';
import { DataTable, ErrorState, PageHeader, StatusBadge, useToast, type DataTableColumn } from '@/components/ui';
import { MarkAllReadButton } from '@/components/layout/NotificationCenter';
import type { PageResponse } from '@/types/api';
import type { NotificationView } from '@/types/domain';

export function NotificationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'list-page'],
    queryFn: () => api.get<PageResponse<NotificationView>>('/notifications', {
      query: { size: 200 },
    }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      toast.success('Notification marked as read');
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error('Could not update notification', getErrorMessage(error)),
  });

  const columns: DataTableColumn<NotificationView>[] = [
    {
      key: 'title',
      header: 'Notification',
      render: (notification) => (
        <div>
          <div className="table-cell-strong">{notification.title}</div>
          <div className="text-xs text-muted">{notification.body}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (notification) => notification.type ? humanize(notification.type) : '—' },
    { key: 'createdAt', header: 'Received', render: (notification) => formatDateTime(notification.createdAt) },
    { key: 'read', header: 'State', render: (notification) => <StatusBadge status={notification.read ? 'APPROVED' : 'PENDING'} label={notification.read ? 'Read' : 'Unread'} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (notification) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={notification.read || markRead.isPending}
          onClick={() => markRead.mutate(notification.id)}
        >
          <Check size={13} aria-hidden="true" /> Mark read
        </button>
      ),
    },
  ];

  const allNotifications = notificationsQuery.data?.content ?? [];
  const notifications =
    filter === 'UNREAD'
      ? allNotifications.filter((item) => !item.read)
      : filter === 'READ'
        ? allNotifications.filter((item) => item.read)
        : allNotifications;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="Notifications delivered to your account by the API."
        actions={<MarkAllReadButton notifications={notifications.filter((item) => !item.read)} />}
      />

      <DataTable
        ariaLabel="Notification list"
        rowKey={(row) => row.id}
        columns={columns}
        rows={notifications}
        loading={notificationsQuery.isPending}
        emptyTitle="No notifications"
        emptyDescription="You are all caught up for the current filter."
        toolbar={
          <>
            <label className="sr-only" htmlFor="notification-filter">Notification filter</label>
            <select id="notification-filter" className="select" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">All notifications</option>
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
            </select>
            <span className="chip"><Bell size={12} aria-hidden="true" /> API-backed</span>
          </>
        }
      />
      {notificationsQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}>
          <ErrorState error={notificationsQuery.error} onRetry={() => void notificationsQuery.refetch()} />
        </div>
      )}
    </>
  );
}
