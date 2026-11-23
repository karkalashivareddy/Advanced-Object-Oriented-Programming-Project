import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Copy, RefreshCw, ScrollText, X } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { auditKeys } from '@/lib/queryCache';
import { formatDateTime, humanize } from '@/lib/utils';
import { DataTable, ErrorState, FreshnessIndicator, PageHeader, StatusBadge, useToast, type DataTableColumn } from '@/components/ui';
import type { PageResponse } from '@/types/api';
import type { AuditLogView, UserView } from '@/types/domain';

const PAGE_SIZE = 20;

function toInstant(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function AuditPage() {
  const auth = useAuth();
  const toast = useToast();
  const [organizationId, setOrganizationId] = useState('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(0);

  const auditQuery = useQuery({
    queryKey: auditKeys.page(organizationId, actorId, action, from, to, page),
    queryFn: () => api.get<PageResponse<AuditLogView>>('/audit-logs', {
      query: {
        organizationId: auth.hasRole('PLATFORM_ADMIN') && /^\d+$/.test(organizationId) ? Number(organizationId) : undefined,
        actorId: /^\d+$/.test(actorId) ? Number(actorId) : undefined,
        action: action.trim() || undefined,
        from: toInstant(from),
        to: toInstant(to, true),
        page,
        size: PAGE_SIZE,
      },
    }),
  });

  // The audit endpoint has no outcome parameter, so outcome is an explicitly
  // page-scoped filter. The other filters above remain real server filters.
  const serverLogs = auditQuery.data?.content ?? [];
  const logs = useMemo(
    () => serverLogs.filter((log) => outcome === '' || log.outcome === outcome),
    [serverLogs, outcome],
  );
  const outcomeOptions = useMemo(
    () => Array.from(new Set(serverLogs.map((log) => log.outcome).filter(Boolean))).sort(),
    [serverLogs],
  );
  const hasFilters = Boolean(organizationId || actorId || action || from || to || outcome);

  // /users can search by name or email but not by ID, so we resolve actor IDs
  // from the paged directory when the caller has USER_READ.
  const unresolvedActorIds = useMemo(() => {
    const ids = serverLogs
      .map((log) => log.actorId)
      .filter((id): id is number => typeof id === 'number' && id !== auth.user?.id);
    return Array.from(new Set(ids)).sort((left, right) => left - right);
  }, [serverLogs, auth.user?.id]);
  const canResolveActors = auth.hasPermission(PERMISSIONS.USER_READ) && unresolvedActorIds.length > 0;

  const directoryQuery = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => api.get<PageResponse<UserView>>('/users', { query: { page: 0, size: 100 } }),
    enabled: canResolveActors,
  });
  const extraDirectoryPages = useQueries({
    queries: Array.from({ length: Math.max(0, (directoryQuery.data?.totalPages ?? 0) - 1) }, (_, index) => ({
      queryKey: ['users', 'directory', index + 1],
      queryFn: () => api.get<PageResponse<UserView>>('/users', { query: { page: index + 1, size: 100 } }),
      enabled: canResolveActors,
    })),
  });
  const actorNames = useMemo(() => {
    const names = new Map<number, string>();
    if (auth.user) names.set(auth.user.id, auth.user.fullName);
    [directoryQuery.data, ...extraDirectoryPages.map((entry) => entry.data)]
      .filter((page): page is PageResponse<UserView> => Boolean(page))
      .forEach((page) => page.content.forEach((user) => names.set(user.id, user.fullName)));
    return names;
  }, [auth.user, directoryQuery.data, extraDirectoryPages]);
  const actorResolutionError = directoryQuery.error ?? extraDirectoryPages.find((entry) => entry.isError)?.error;
  const actorResolutionFailed = canResolveActors && Boolean(actorResolutionError);

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

  const clearFilters = () => {
    setOrganizationId('');
    setActorId('');
    setAction('');
    setFrom('');
    setTo('');
    setOutcome('');
    setPage(0);
  };

  const columns: DataTableColumn<AuditLogView>[] = [
    {
      key: 'occurredAt',
      header: 'Time',
      render: (log) => (
        <time dateTime={log.occurredAt} title={log.occurredAt}>{formatDateTime(log.occurredAt)}</time>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (log) => {
        if (!log.actorId) return <span className="text-subtle">System</span>;
        const name = actorNames.get(log.actorId);
        return (
          <div className="stack" style={{ gap: 2 }}>
            <span className="table-cell-strong">{name ?? `User #${log.actorId}`}</span>
            <span className="mono text-xs text-subtle">ID {log.actorId}</span>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (log) => <span className="table-cell-strong">{humanize(log.action)}</span>,
    },
    {
      key: 'entity',
      header: 'Target',
      render: (log) => (
        <div className="stack" style={{ gap: 2 }}>
          <span>{log.targetType ? humanize(log.targetType) : '—'}</span>
          {log.targetId && <span className="mono text-xs text-subtle" title={log.targetId}>{log.targetId}</span>}
          {log.organizationId !== undefined && (
            <span className="text-xs text-subtle">Org #{log.organizationId}</span>
          )}
        </div>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (log) => <StatusBadge status={log.outcome} />,
    },
    {
      key: 'metadata',
      header: 'Metadata',
      render: (log) => log.metadata
        ? (
          <details>
            <summary className="text-xs">Details</summary>
            <code className="mono text-xs">{log.metadata}</code>
          </details>
        )
        : <span className="text-subtle">—</span>,
    },
    {
      key: 'correlationId',
      header: 'Correlation',
      align: 'right',
      render: (log) => log.correlationId
        ? (
          <div className="cluster" style={{ justifyContent: 'flex-end', gap: 4 }}>
            <span className="mono text-xs" title={log.correlationId}>{log.correlationId.slice(0, 12)}…</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={`Copy correlation ID ${log.correlationId}`}
              title="Copy full correlation ID"
              onClick={() => void copyValue(log.correlationId ?? '', 'Correlation ID')}
            >
              <Copy size={13} aria-hidden="true" />
            </button>
          </div>
        )
        : <span className="text-subtle">—</span>,
    },
  ];

  return (
    <div className="app-page page-enter">
      <PageHeader
        eyebrow="Insights"
        title="Audit log"
        description="Recorded actions and outcomes returned by the audit API. Read-only; no export endpoint is exposed."
        actions={
          <div className="section-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={auditQuery.isFetching}
              onClick={() => void auditQuery.refetch()}
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
            {hasFilters && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                <X size={14} aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>
        }
      />

      <FreshnessIndicator
        className="stagger-1"
        updatedAt={auditQuery.dataUpdatedAt || undefined}
        refreshing={auditQuery.isFetching && !auditQuery.isPending}
        onRefresh={() => { void auditQuery.refetch(); }}
        refetchOnVisible
        label="Server records"
      />

      <p className="sr-only" id="audit-results-help">
        Organization, actor, action and date filters are applied by the server. Outcome filtering only applies to the current page because the audit API has no outcome parameter.
      </p>

      {auditQuery.isError ? (
        <section className="surface surface-glass stagger-2" aria-describedby="audit-results-help">
          <ErrorState
            title="Audit records could not be loaded"
            error={auditQuery.error}
            onRetry={() => void auditQuery.refetch()}
          />
        </section>
      ) : (
        <div className="stagger-2" aria-describedby="audit-results-help">
          <output className="sr-only" aria-live="polite">
            {auditQuery.isPending ? 'Loading audit records' : `${logs.length} entries shown on this page`}
          </output>
          <DataTable
            ariaLabel="Audit log"
            rowKey={(row) => row.id}
            columns={columns}
            rows={logs}
            loading={auditQuery.isPending}
            page={auditQuery.data?.page ?? page}
            size={auditQuery.data?.size ?? PAGE_SIZE}
            totalElements={auditQuery.data?.totalElements}
            onPageChange={setPage}
            emptyTitle={hasFilters ? 'No matching entries on this page' : 'No audit entries'}
            emptyDescription={hasFilters
              ? 'Adjust or clear the filters to see more records.'
              : 'Adjust the filters or check back after actions are recorded.'}
            emptyAction={hasFilters ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>
            ) : undefined}
            toolbar={
              <div className="toolbar">
                <div className="filter-grid">
                  {auth.hasRole('PLATFORM_ADMIN') && (
                    <div className="filter-field">
                      <label className="sr-only" htmlFor="audit-organization">Organization ID</label>
                      <input
                        id="audit-organization"
                        className="input"
                        inputMode="numeric"
                        aria-label="Filter by organization ID"
                        placeholder="Organization ID"
                        value={organizationId}
                        onChange={(event) => { setOrganizationId(event.target.value); setPage(0); }}
                      />
                    </div>
                  )}
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="audit-actor">Actor ID</label>
                    <input
                      id="audit-actor"
                      className="input"
                      inputMode="numeric"
                      aria-label="Filter by actor ID"
                      placeholder="Actor ID"
                      value={actorId}
                      onChange={(event) => { setActorId(event.target.value); setPage(0); }}
                    />
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="audit-action">Action</label>
                    <input
                      id="audit-action"
                      className="input"
                      aria-label="Filter by action"
                      placeholder="Action"
                      value={action}
                      onChange={(event) => { setAction(event.target.value); setPage(0); }}
                    />
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="audit-outcome">Outcome on this page</label>
                    <select
                      id="audit-outcome"
                      className="select"
                      value={outcome}
                      onChange={(event) => setOutcome(event.target.value)}
                      title="The audit API does not accept an outcome parameter; this filters the current page"
                    >
                      <option value="">All outcomes</option>
                      {outcomeOptions.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="audit-from">From date</label>
                    <input
                      id="audit-from"
                      className="input"
                      type="date"
                      aria-label="From date"
                      value={from}
                      onChange={(event) => { setFrom(event.target.value); setPage(0); }}
                    />
                  </div>
                  <div className="filter-field">
                    <label className="sr-only" htmlFor="audit-to">To date</label>
                    <input
                      id="audit-to"
                      className="input"
                      type="date"
                      aria-label="To date"
                      value={to}
                      onChange={(event) => { setTo(event.target.value); setPage(0); }}
                    />
                  </div>
                </div>
                <div className="section-actions">
                  {actorResolutionFailed && (
                    <span className="status-chip" title={getErrorMessage(actorResolutionError)}>
                      Actor names unavailable
                    </span>
                  )}
                  <span className="chip"><ScrollText size={12} aria-hidden="true" /> {logs.length} shown</span>
                </div>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
