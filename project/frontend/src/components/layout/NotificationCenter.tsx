import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/ui';
import type { NotificationView } from '@/types/domain';
import type { PageResponse } from '@/types/api';

function unreadFrom(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const candidate = value as { count?: unknown; unreadCount?: unknown };
    const raw = candidate.count ?? candidate.unreadCount;
    if (typeof raw === 'number') return raw;
  }
  return 0;
}

export function NotificationCenter() {
  const auth = useAuth();
  const canRead = auth.canAccess({ permissions: [PERMISSIONS.NOTIFICATION_READ] });
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const countQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<unknown>('/notifications/unread-count'),
    enabled: canRead,
    refetchInterval: canRead ? 60_000 : false,
  });

  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get<PageResponse<NotificationView>>('/notifications', { query: { size: 8 } }),
    enabled: open && canRead,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post<void>(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error('Could not update notification', getErrorMessage(error)),
  });

  const closePopover = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) closePopover();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopover(true);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const unread = unreadFrom(countQuery.data);
  const notifications = listQuery.data?.content ?? [];

  if (!canRead) return null;

  return (
    <div className="menu-anchor" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="badge badge-danger" style={{ padding: '0 5px' }}>{unread}</span>}
      </button>
      {open && (
        <div
          className="popover"
          role="dialog"
          aria-label="Notifications"
          onBlur={(event) => {
            // Tab is left to the browser. Closing when focus leaves the dialog
            // keeps it from trapping keyboard users in the popover.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <div className="popover-header">
            <span>Notifications</span>
            <span className="text-muted text-xs">{unread} unread</span>
          </div>
          <div className="popover-list">
            {listQuery.isPending && <p className="card-pad text-muted text-sm">Loading notifications…</p>}
            {listQuery.isError && <p className="card-pad text-accent text-sm">{getErrorMessage(listQuery.error)}</p>}
            {listQuery.isSuccess && notifications.length === 0 && (
              <p className="card-pad text-muted text-sm">You are all caught up.</p>
            )}
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className="popover-item"
                disabled={notification.read || markRead.isPending}
                onClick={() => markRead.mutate(notification.id)}
              >
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
                <span className="text-subtle">{formatDateTime(notification.createdAt)}</span>
              </button>
            ))}
          </div>
          <div className="popover-footer">
            <Link className="btn btn-ghost btn-sm" to="/app/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function MarkAllReadButton({ notifications }: { notifications: NotificationView[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        notifications.filter((item) => !item.read).map((item) => api.post<void>(`/notifications/${item.id}/read`)),
      );
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error) => toast.error('Could not update notifications', getErrorMessage(error)),
  });

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      disabled={mutation.isPending || notifications.every((item) => item.read)}
      onClick={() => mutation.mutate()}
    >
      <CheckCheck size={14} aria-hidden="true" /> Mark all read
    </button>
  );
}
