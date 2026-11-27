import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Copy, RefreshCw, X } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/utils';
import {
  DataTable,
  ErrorState,
  FreshnessIndicator,
  Grid,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  Surface,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import { MarkAllReadButton } from '@/components/layout/NotificationCenter';
import type { PageResponse } from '@/types/api';
import type { NotificationView } from '@/types/domain';

const PAGE_SIZE = 12;

export function NotificationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [readFilter, setReadFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(0);
  const [live, setLive] = useState(false);

  // The API exposes Spring Data pagination only; there is no type/read query parameter.
  // Those filters therefore operate on the current page and are labelled as such in the UI.
  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'list-page', page],
    queryFn: () => api.get<PageResponse<NotificationView>>('/notifications', {
      query: { page, size: PAGE_SIZE },
    }),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 30_000 : false,
  });

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count?: number; unreadCount?: number }>('/notifications/unread-count'),
    refetchInterval: live ? 30_000 : false,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post<void>(`/notifications/${id}/read`),
    onSuccess: () => {
      toast.success('Notification marked as read');
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error('Could not update notification', getErrorMessage(error)),
  });

  const copyReference = async (value: string) => {
    if (!navigator.clipboard) {
      toast.error('Clipboard is not available in this browser');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Notification reference copied', value);
    } catch {
      toast.error('Could not copy the reference');
    }
  };

  const allNotifications = notificationsQuery.data?.content ?? [];
  const typeOptions = useMemo(
    () => Array.from(new Set(allNotifications.map((item) => item.type).filter(Boolean))).sort(),
    [allNotifications],
  );
  const notifications = useMemo(
    () => allNotifications.filter((item) => {
      const matchesRead = readFilter === '' || (readFilter === 'READ' ? item.read : !item.read);
      const matchesType = typeFilter === '' || item.type === typeFilter;
      return matchesRead && matchesType;
    }),
    [allNotifications, readFilter, typeFilter],
  );
  const hasFilters = readFilter !== '' || typeFilter !== '';
  const unreadTotal = typeof unreadQuery.data?.count === 'number'
    ? unreadQuery.data.count
    : typeof unreadQuery.data?.unreadCount === 'number'
      ? unreadQuery.data.unreadCount
      : undefined;

  const columns: DataTableColumn<NotificationView>[] = [
    {
      key: 'title',
      header: 'Notification',
      render: (notification) => (
        <div className="stack" style={{ gap: 4 }}>
          <div className="table-cell-strong">{notification.title}</div>
          <div className="text-xs text-muted">{notification.body}</div>
          <div className="cluster" style={{ gap: 6 }}>
            <span className="mono text-xs text-subtle">Ref: {notification.publicId}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={`Copy reference ${notification.publicId}`}
              title="Copy reference"
              onClick={() => void copyReference(notification.publicId)}
            >
              <Copy size={12} aria-hidden="true" />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (notification) => (
        <div className="stack" style={{ gap: 6 }}>
          <span className="chip">{humanize(notification.type)}</span>
          <span className="text-xs text-subtle">Channel: {humanize(notification.channel)}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Received',
      render: (notification) => (
        <time dateTime={notification.createdAt} title={notification.createdAt}>
          {formatDateTime(notification.createdAt)}
        </time>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (notification) => (
        <div className="cluster" style={{ gap: 6 }}>
          <StatusBadge status={notification.read ? 'APPROVED' : 'PENDING'} label={notification.read ? 'Read' : 'Unread'} />
          <StatusBadge status={notification.status} label={`Delivery: ${humanize(notification.status)}`} />
        </div>
      ),
    },
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

  const clearFilters = () => {
    setReadFilter('');
    setTypeFilter('');
  };

  return (
    <div className="app-page page-enter">
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="Notifications delivered to your account by the API, with server-backed pagination."
        actions={
          <div className="section-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-pressed={live}
              onClick={() => setLive((current) => !current)}
            >
              <span className="live-pill">
                <span className="live-dot" style={live ? undefined : { opacity: 0.4 }} aria-hidden="true" />
                {live ? 'Live updates on' : 'Live updates off'}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={notificationsQuery.isFetching}
              onClick={() => void notificationsQuery.refetch()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>
            <MarkAllReadButton notifications={allNotifications.filter((item) => !item.read)} />
          </div>
        }
      />

      {!notificationsQuery.isError && (
        <section className="stagger-1" aria-label="Notification summary">
          <Grid columns="stats">
            <StatCard
              label="Total notifications"
              value={notificationsQuery.data?.totalElements ?? '—'}
              hint="From the paged API response"
            />
            <StatCard
              label="Unread (account total)"
              value={unreadQuery.data ? (unreadTotal ?? '—') : '—'}
              hint={unreadQuery.isError ? 'Unread count unavailable' : 'From /notifications/unread-count'}
            />
            <StatCard
              label="On this page"
              value={notificationsQuery.data ? notifications.length : '—'}
              hint={hasFilters ? 'After page filters' : `Page ${page + 1} of ${notificationsQuery.data?.totalPages ?? '—'}`}
            />
          </Grid>
        </section>
      )}

      <div className="stagger-2" style={{ margin: '16px 0' }}>
        <FreshnessIndicator
          updatedAt={notificationsQuery.dataUpdatedAt || undefined}
          refreshing={notificationsQuery.isFetching && !notificationsQuery.isPending}
          onRefresh={() => { void notificationsQuery.refetch(); }}
          refetchOnVisible
          label={live ? 'Live notifications' : 'Notifications'}
        />
        <p className="text-xs text-subtle" style={{ marginTop: 8 }}>
          Type and read filters, and “Mark all read”, apply to the current page; the API exposes pagination only.
        </p>
      </div>

      {notificationsQuery.isError ? (
        <Surface as="section" variant="glass" padding="md" className="stagger-2">
          <ErrorState
            title="Notifications could not be loaded"
            error={notificationsQuery.error}
            onRetry={() => void notificationsQuery.refetch()}
          />
        </Surface>
      ) : (
        <div className="stagger-2">
          <DataTable
            ariaLabel="Notification list"
            rowKey={(row) => row.id}
            columns={columns}
            rows={notifications}
            loading={notificationsQuery.isPending}
            page={notificationsQuery.data?.page ?? page}
            size={notificationsQuery.data?.size ?? PAGE_SIZE}
            totalElements={notificationsQuery.data?.totalElements}
            onPageChange={(next) => { setPage(next); setReadFilter(''); setTypeFilter(''); }}
            emptyTitle={hasFilters ? 'No matching notifications on this page' : 'No notifications'}
            emptyDescription={hasFilters
              ? 'Try another page or clear the page filters.'
              : 'You are all caught up for this page.'}
            emptyAction={hasFilters ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                <X size={14} aria-hidden="true" /> Clear filters
              </button>
            ) : undefined}
            toolbar={
              <div className="toolbar">
                <div className="filter-grid">
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="notification-read-filter">Read state on this page</label>
                    <Select
                      id="notification-read-filter"
                      value={readFilter}
                      onChange={(event) => { setReadFilter(event.target.value); setPage(0); }}
                      title="Filters the current page; the API has no read query parameter"
                    >
                      <option value="">All read states</option>
                      <option value="UNREAD">Unread</option>
                      <option value="READ">Read</option>
                    </Select>
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="notification-type-filter">Notification type on this page</label>
                    <Select
                      id="notification-type-filter"
                      value={typeFilter}
                      onChange={(event) => { setTypeFilter(event.target.value); setPage(0); }}
                      title="Filters the current page; the API has no type query parameter"
                    >
                      <option value="">All types</option>
                      {typeOptions.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="section-actions">
                  {hasFilters && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                      <X size={14} aria-hidden="true" /> Clear filters
                    </button>
                  )}
                  <span className="chip"><Bell size={12} aria-hidden="true" /> {notifications.length} shown</span>
                </div>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
