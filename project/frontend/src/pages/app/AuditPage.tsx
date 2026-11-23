import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, humanize } from '@/lib/utils';
import { DataTable, ErrorState, PageHeader, StatusBadge, type DataTableColumn } from '@/components/ui';
import type { PageResponse } from '@/types/api';
import type { AuditLogView } from '@/types/domain';

function toInstant(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function AuditPage() {
  const auth = useAuth();
  const [organizationId, setOrganizationId] = useState('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const auditQuery = useQuery({
    queryKey: ['audit', organizationId, actorId, action, from, to, page],
    queryFn: () => api.get<PageResponse<AuditLogView>>('/audit-logs', {
      query: {
        organizationId: auth.hasRole('PLATFORM_ADMIN') && /^\d+$/.test(organizationId) ? Number(organizationId) : undefined,
        actorId: /^\d+$/.test(actorId) ? Number(actorId) : undefined,
        action: action.trim() || undefined,
        from: toInstant(from),
        to: toInstant(to, true),
        page,
        size: 20,
      },
    }),
  });

  const columns: DataTableColumn<AuditLogView>[] = [
    { key: 'occurredAt', header: 'Time', render: (log) => formatDateTime(log.occurredAt) },
    { key: 'actor', header: 'Actor', render: (log) => log.actorId ? `User #${log.actorId}` : '—' },
    { key: 'action', header: 'Action', render: (log) => <span className="table-cell-strong">{humanize(log.action)}</span> },
    {
      key: 'entity',
      header: 'Target',
      render: (log) => log.targetType
        ? `${humanize(log.targetType)}${log.targetId ? ` · ${log.targetId}` : ''}`
        : '—',
    },
    { key: 'outcome', header: 'Outcome', render: (log) => <StatusBadge status={log.outcome} /> },
    {
      key: 'correlationId',
      header: 'Correlation',
      render: (log) => <span className="mono text-xs" title={log.correlationId}>{log.correlationId ?? '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Audit log"
        description="Recorded actions and outcomes returned by the audit API."
      />

      <DataTable
        ariaLabel="Audit log"
        rowKey={(row) => row.id}
        columns={columns}
        rows={auditQuery.data?.content ?? []}
        loading={auditQuery.isPending}
        page={auditQuery.data?.page ?? page}
        size={auditQuery.data?.size ?? 20}
        totalElements={auditQuery.data?.totalElements}
        onPageChange={setPage}
        emptyTitle="No audit entries"
        emptyDescription="Adjust the filters or check back after actions are recorded."
        toolbar={
          <>
            <div className="table-toolbar-filters">
              {auth.hasRole('PLATFORM_ADMIN') && (
                <>
                  <label className="sr-only" htmlFor="audit-organization">Organization ID</label>
                  <input id="audit-organization" className="input" inputMode="numeric" aria-label="Filter by organization ID" placeholder="Organization ID" value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setPage(0); }} />
                </>
              )}
              <label className="sr-only" htmlFor="audit-actor">Actor ID</label>
              <input id="audit-actor" className="input" inputMode="numeric" aria-label="Filter by actor ID" placeholder="Actor ID" value={actorId} onChange={(event) => { setActorId(event.target.value); setPage(0); }} />
              <label className="sr-only" htmlFor="audit-action">Action</label>
              <input id="audit-action" className="input" aria-label="Filter by action" placeholder="Action" value={action} onChange={(event) => { setAction(event.target.value); setPage(0); }} />
              <label className="sr-only" htmlFor="audit-from">From date</label>
              <input id="audit-from" className="input" type="date" aria-label="From date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} />
              <label className="sr-only" htmlFor="audit-to">To date</label>
              <input id="audit-to" className="input" type="date" aria-label="To date" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} />
            </div>
            <span className="chip"><ScrollText size={12} aria-hidden="true" /> Server records</span>
          </>
        }
      />
      {auditQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}><ErrorState error={auditQuery.error} onRetry={() => void auditQuery.refetch()} /></div>
      )}
    </>
  );
}
