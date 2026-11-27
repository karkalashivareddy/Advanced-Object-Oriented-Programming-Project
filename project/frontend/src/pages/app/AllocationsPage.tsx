import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  KeyRound,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { RBC_COMPATIBILITY_NOTE } from '@/lib/bloodCompatibility';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { useInvalidateDomains } from '@/lib/queryCache';
import { formatDate, formatDateTime, humanize } from '@/lib/utils';
import {
  EmptyState,
  ErrorState,
  FormField,
  Grid,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  Surface,
  useToast,
} from '@/components/ui';
import type {
  AllocationCandidateView,
  AllocationSuggestion,
  BloodUnitView,
  EmergencyRequestDetail,
  EmergencyRequestView,
} from '@/types/domain';

interface Candidate extends AllocationCandidateView {
  selected: boolean;
}

type CandidateFilter = 'all' | 'eligible' | 'incompatible';
type CandidateSort = 'rank' | 'expiry' | 'unit';

function normaliseUnit(value: unknown): BloodUnitView | null {
  if (!value || typeof value !== 'object') return null;
  const unit = value as Record<string, unknown>;
  const id = Number(unit.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    publicId: String(unit.publicId ?? ''),
    unitNumber: String(unit.unitNumber ?? `Unit #${id}`),
    bloodGroup: unit.bloodGroup as BloodUnitView['bloodGroup'],
    componentType: unit.componentType as BloodUnitView['componentType'],
    status: unit.status as BloodUnitView['status'],
    released: unit.released === true,
    collectedAt: String(unit.collectedAt ?? ''),
    expiresAt: unit.expiresAt ? String(unit.expiresAt) : undefined,
    storageLocation: String(unit.storageLocation ?? ''),
    organizationId: Number(unit.organizationId ?? 0),
    donationId: unit.donationId === null || unit.donationId === undefined ? undefined : Number(unit.donationId),
    version: Number(unit.version ?? 0),
  };
}

function normaliseSuggestion(payload: unknown): AllocationSuggestion | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const rawCandidates = Array.isArray(value.candidates) ? value.candidates : [];
  const candidates: AllocationCandidateView[] = [];

  for (const entry of rawCandidates) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    const unit = normaliseUnit(candidate.unit);
    if (!unit) continue;
    candidates.push({
      unit,
      eligible: candidate.eligible === true,
      rejectionReasons: Array.isArray(candidate.rejectionReasons)
        ? candidate.rejectionReasons.map(String)
        : [],
      rank: Number(candidate.rank ?? 0),
    });
  }

  return {
    requestId: Number(value.requestId ?? 0),
    ruleVersion: String(value.ruleVersion ?? ''),
    compatibilityRule: String(value.compatibilityRule ?? ''),
    humanApprovalRequired: value.humanApprovalRequired === true,
    feasibility: String(value.feasibility ?? ''),
    candidates,
  };
}

function expiryTime(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

export function AllocationsPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requestId, setRequestId] = useState(searchParams.get('requestId') ?? '');
  const [suggestion, setSuggestion] = useState<AllocationSuggestion | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>('all');
  const [candidateSort, setCandidateSort] = useState<CandidateSort>('rank');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const numericRequestId = /^\d+$/.test(requestId) ? Number(requestId) : null;

  const requestsQuery = useQuery({
    queryKey: ['requests', 'list', ''],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests'),
    enabled: auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const requestQuery = useQuery({
    queryKey: ['requests', 'detail', numericRequestId],
    queryFn: () => api.get<EmergencyRequestDetail>(`/emergency-requests/${numericRequestId}`),
    enabled: numericRequestId !== null && auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

  const request = requestQuery.data?.request;
  const quantity = request?.quantity ?? 0;
  const selectionLimit = quantity > 0 ? quantity : Number.MAX_SAFE_INTEGER;

  const setSelectedRequest = (value: string) => {
    if (value !== requestId) {
      setSuggestion(null);
      setCandidates([]);
    }
    setRequestId(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('requestId', value);
    else next.delete('requestId');
    setSearchParams(next, { replace: true });
  };

  const suggestions = useMutation({
    mutationFn: (id: number) => api.post<unknown>('/allocations/suggestions', { requestId: id }),
    onSuccess: (payload) => {
      const next = normaliseSuggestion(payload);
      setSuggestion(next);
      setCandidates((next?.candidates ?? []).map((candidate) => ({ ...candidate, selected: false })));
      toast.success(next ? 'Suggestions loaded' : 'Suggestions unavailable');
    },
    onError: (error) => toast.error('Could not load suggestions', getErrorMessage(error)),
  });

  const confirm = useMutation({
    mutationFn: () => api.post('/allocations/confirm', {
      requestId: Number(requestId),
      unitIds: candidates
        .filter((candidate) => candidate.selected && candidate.eligible)
        .map((candidate) => candidate.unit.id),
      idempotencyKey,
    }, { idempotencyKey }),
    onSuccess: () => {
      toast.success('Allocation confirmed', 'Reservations were created by the API.');
      setConfirmOpen(false);
      setIdempotencyKey('');
      setSuggestion(null);
      setCandidates([]);
      invalidateDomains(['requests', 'reservations', 'inventory']);
    },
    onError: (error) => {
      toast.error('Could not confirm allocation', getErrorMessage(error));
      // A retry must not replay a stale key with different state.
      setIdempotencyKey(api.createIdempotencyKey());
    },
  });

  const selectedCount = candidates.filter((candidate) => candidate.selected && candidate.eligible).length;
  const eligibleCount = candidates.filter((candidate) => candidate.eligible).length;
  const selectionComplete = quantity > 0 && selectedCount === quantity;

  const visibleCandidates = useMemo(() => {
    const term = candidateSearch.trim().toLowerCase();
    return candidates
      .filter((candidate) => {
        if (candidateFilter === 'eligible' && !candidate.eligible) return false;
        if (candidateFilter === 'incompatible' && candidate.eligible) return false;
        if (!term) return true;
        return `${candidate.unit.unitNumber} ${candidate.unit.publicId} ${candidate.unit.storageLocation} ${humanize(candidate.unit.bloodGroup)}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        if (candidateSort === 'expiry') return expiryTime(a.unit.expiresAt) - expiryTime(b.unit.expiresAt);
        if (candidateSort === 'unit') return a.unit.unitNumber.localeCompare(b.unit.unitNumber);
        return a.rank - b.rank || expiryTime(a.unit.expiresAt) - expiryTime(b.unit.expiresAt);
      });
  }, [candidateFilter, candidateSearch, candidateSort, candidates]);

  const toggleCandidate = (unitId: number, checked: boolean) => {
    if (checked && selectedCount >= selectionLimit) {
      toast.error('Selection limit reached', `At most ${quantity} units can be selected for this request.`);
      return;
    }
    setCandidates((current) =>
      current.map((item) => (item.unit.id === unitId ? { ...item, selected: checked } : item)),
    );
  };

  const selectRecommended = () => {
    if (quantity <= 0) {
      toast.error('Request details unavailable', 'Load a valid request before choosing units.');
      return;
    }
    const recommended = [...candidates]
      .filter((candidate) => candidate.eligible)
      .sort((a, b) => a.rank - b.rank || expiryTime(a.unit.expiresAt) - expiryTime(b.unit.expiresAt))
      .slice(0, quantity);
    if (recommended.length === 0) {
      toast.error('No eligible units', 'The API returned no eligible candidates for this request.');
      return;
    }
    const chosen = new Set(recommended.map((candidate) => candidate.unit.id));
    setCandidates((current) => current.map((candidate) => ({ ...candidate, selected: chosen.has(candidate.unit.id) })));
    toast.success(
      'Recommended units selected',
      `${recommended.length} of ${quantity} required ${quantity === 1 ? 'unit' : 'units'} chosen by server rank.`,
    );
  };

  const openConfirm = () => {
    setIdempotencyKey(api.createIdempotencyKey());
    setConfirmOpen(true);
  };

  return (
    <div className="app-page page-enter">
      <PageHeader
        eyebrow="Operations"
        title="Allocations"
        description="Review candidate units for an emergency request. This screen does not make clinical decisions."
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!auth.hasPermission(PERMISSIONS.REQUEST_READ) || requestsQuery.isFetching}
            onClick={() => void requestsQuery.refetch()}
          >
            <RefreshCw size={15} aria-hidden="true" /> Refresh requests
          </button>
        }
      />

      <div className="notice-banner" role="note">
        <Info size={18} aria-hidden="true" />
        <div>
          <strong>Non-clinical decision support</strong>
          Suggestions are advisory only. Qualified staff must verify compatibility and clinical suitability before any
          allocation is confirmed. The server remains responsible for authorization and invariants.
          <p>{RBC_COMPATIBILITY_NOTE}</p>
        </div>
      </div>

      <Surface as="section" variant="raised" padding="md" style={{ marginTop: 18 }} aria-labelledby="suggestions-form-title">
        <div className="section-heading">
          <div>
            <h2 id="suggestions-form-title">Request to evaluate</h2>
            <p className="text-sm text-muted">Choose a request from the API, then ask for candidate evaluations.</p>
          </div>
          <span className="status-chip">Server advisory</span>
        </div>
        <div className="form-grid">
          <FormField label="Emergency request" hint="Loaded from the emergency requests API" required full>
            <select
              className="select"
              value={requestId}
              onChange={(event) => setSelectedRequest(event.target.value)}
            >
              <option value="">Select a request…</option>
              {(requestsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.requestNumber} · {humanize(item.status)} · {humanize(item.priority)} · {item.quantity} units
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Or enter a request ID"
            hint="Use a request ID supplied by your workflow"
            full
          >
            <input
              className="input"
              inputMode="numeric"
              value={requestId}
              onChange={(event) => setSelectedRequest(event.target.value)}
            />
          </FormField>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={suggestions.isPending || numericRequestId === null}
            onClick={() => numericRequestId !== null && suggestions.mutate(numericRequestId)}
          >
            <Search size={15} aria-hidden="true" /> Get suggestions
          </button>
          {requestsQuery.isError && (
            <span className="field-error">Request list unavailable: {getErrorMessage(requestsQuery.error)}</span>
          )}
        </div>
      </Surface>

      <Grid columns="stats" style={{ marginTop: 18 }}>
        <StatCard
          label="Requested quantity"
          value={quantity || '—'}
          hint={request ? humanize(request.priority) : 'Select a request'}
        />
        <StatCard
          label="Eligible candidates"
          value={eligibleCount}
          hint={`${candidates.length} evaluated by API`}
        />
        <StatCard
          label="Selected units"
          value={`${selectedCount}${quantity ? ` / ${quantity}` : ''}`}
          hint={selectionComplete ? 'Ready to confirm' : 'Exact quantity required'}
        />
        <StatCard
          label="Feasibility"
          value={
            <span style={{ fontSize: 'var(--font-size-lg, 1.1rem)' }}>
              {suggestion ? humanize(suggestion.feasibility) : '—'}
            </span>
          }
          hint={suggestion?.ruleVersion || 'Awaiting evaluation'}
        />
      </Grid>

      <div className="split-layout" style={{ marginTop: 18 }}>
        <Surface as="section" variant="glass" padding="md" aria-labelledby="request-context-title">
          <div className="section-heading">
            <h2 id="request-context-title">Request detail</h2>
            {request && <StatusBadge status={request.status} />}
          </div>
          {requestQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /></div>}
          {requestQuery.isError && <ErrorState error={requestQuery.error} onRetry={() => void requestQuery.refetch()} />}
          {request ? (
            <>
              <dl className="detail-grid">
                <div className="detail-item"><dt>Request</dt><dd className="mono">{request.requestNumber}</dd></div>
                <div className="detail-item"><dt>Urgency</dt><dd><StatusBadge status={request.priority} /></dd></div>
                <div className="detail-item"><dt>Quantity</dt><dd>{request.quantity} unit{request.quantity === 1 ? '' : 's'}</dd></div>
                <div className="detail-item"><dt>Required by</dt><dd>{formatDateTime(request.requiredBy)}</dd></div>
                <div className="detail-item">
                  <dt>Requirement</dt>
                  <dd>{humanize(request.bloodGroup)} · {humanize(request.componentType)}</dd>
                </div>
                <div className="detail-item">
                  <dt>Requesting organization</dt>
                  <dd>{request.organizationName ?? `Organization #${request.organizationId}`}</dd>
                </div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <dt>Reason</dt>
                  <dd>{request.reason ?? '—'}</dd>
                </div>
              </dl>
              {suggestion && (
                <>
                  <div className="section-heading" style={{ marginTop: 18 }}>
                    <h3>Evaluation rules</h3>
                  </div>
                  <dl className="detail-grid">
                    <div className="detail-item"><dt>Rule version</dt><dd>{suggestion.ruleVersion || '—'}</dd></div>
                    <div className="detail-item">
                      <dt>Human approval</dt>
                      <dd>{suggestion.humanApprovalRequired ? 'Required' : 'Not required'}</dd>
                    </div>
                    <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                      <dt>Compatibility rule</dt>
                      <dd>{suggestion.compatibilityRule || '—'}</dd>
                    </div>
                    <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                      <dt>Feasibility</dt>
                      <dd>{humanize(suggestion.feasibility)}</dd>
                    </div>
                  </dl>
                </>
              )}
            </>
          ) : (
            <EmptyState
              title="No request selected"
              description="Pick a request to see its quantity, urgency, and deadline beside the candidates."
            />
          )}
        </Surface>

        <Surface as="section" padding="md" aria-labelledby="candidates-title">
          <div className="section-heading">
            <div>
              <h2 id="candidates-title">Candidate units</h2>
              <p className="text-sm text-muted">Advisory evaluations returned by /allocations/suggestions</p>
            </div>
            <div className="section-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={selectRecommended}>
                <Sparkles size={14} aria-hidden="true" /> Select recommended
              </button>
              {auth.hasPermission(PERMISSIONS.ALLOCATION_CONFIRM) && candidates.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!selectionComplete || confirm.isPending}
                  onClick={openConfirm}
                >
                  Confirm {selectedCount || ''} {selectedCount === 1 ? 'unit' : 'units'}
                </button>
              )}
            </div>
          </div>

          <div className="toolbar">
            <div className="toolbar-search">
              <Search size={15} aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search candidate units"
                placeholder="Search units…"
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
              />
            </div>
            <div className="filter-grid">
              <div className="filter-field">
                <label className="sr-only" htmlFor="candidate-filter">Candidate eligibility</label>
                <Select
                  id="candidate-filter"
                  value={candidateFilter}
                  onChange={(event) => setCandidateFilter(event.target.value as CandidateFilter)}
                >
                  <option value="all">All candidates</option>
                  <option value="eligible">Eligible only</option>
                  <option value="incompatible">Incompatible only</option>
                </Select>
              </div>
              <div className="filter-field">
                <label className="sr-only" htmlFor="candidate-sort">Sort candidates</label>
                <Select
                  id="candidate-sort"
                  value={candidateSort}
                  onChange={(event) => setCandidateSort(event.target.value as CandidateSort)}
                >
                  <option value="rank">Server rank</option>
                  <option value="expiry">Expiry soonest</option>
                  <option value="unit">Unit number</option>
                </Select>
              </div>
            </div>
          </div>

          {suggestions.isPending && <div className="skeleton-lines"><Skeleton height={20} /><Skeleton height={20} /><Skeleton height={20} /></div>}
          {suggestions.isError && <ErrorState error={suggestions.error} onRetry={() => numericRequestId !== null && suggestions.mutate(numericRequestId)} />}
          {suggestions.isSuccess && candidates.length === 0 && (
            <EmptyState title="No candidates returned" description="The API returned no candidate evaluations for this request." />
          )}
          {!suggestions.isPending && !suggestions.isSuccess && (
            <EmptyState title="No evaluation yet" description="Choose a request and load suggestions to see candidates." />
          )}
          {suggestions.isSuccess && candidates.length > 0 && visibleCandidates.length === 0 && (
            <EmptyState title="No matching candidates" description="Adjust the candidate filters or search term." />
          )}

          <div className="mobile-card-list" style={{ marginTop: 12 }}>
            {visibleCandidates.map((candidate) => {
              const atLimit = !candidate.selected && selectedCount >= selectionLimit;
              return (
                <label
                  key={candidate.unit.id}
                  className={`item-header surface-interactive${candidate.eligible ? '' : ' is-incompatible'}`}
                  style={{ cursor: candidate.eligible && !atLimit ? 'pointer' : 'not-allowed' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={candidate.selected}
                      disabled={!candidate.eligible || atLimit}
                      onChange={(event) => toggleCandidate(candidate.unit.id, event.target.checked)}
                    />
                    <span>
                      <strong className="mono">{candidate.unit.unitNumber}</strong>
                      <span className="text-xs text-muted" style={{ display: 'block' }}>
                        {humanize(candidate.unit.bloodGroup)} · {humanize(candidate.unit.componentType)} · expires{' '}
                        {formatDate(candidate.unit.expiresAt)} · {candidate.unit.storageLocation || 'No location'}
                      </span>
                      {candidate.rejectionReasons.length > 0 && (
                        <span className="status-chip" style={{ marginTop: 6, display: 'inline-flex', gap: 6 }}>
                          <AlertTriangle size={12} aria-hidden="true" />
                          {candidate.rejectionReasons.map((reason) => humanize(reason)).join(' · ')}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="cluster">
                    <span className="status-chip">Rank {candidate.rank}</span>
                    <StatusBadge
                      status={candidate.eligible ? 'AVAILABLE' : 'REJECTED'}
                      label={candidate.eligible ? 'Eligible' : 'Not eligible'}
                    />
                  </span>
                </label>
              );
            })}
          </div>
          {quantity > 0 && (
            <p className="text-xs text-muted" style={{ marginTop: 12 }}>
              The API requires exactly {quantity} distinct {quantity === 1 ? 'unit' : 'units'}; additional selections are
              blocked in this view.
            </p>
          )}
        </Surface>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm allocation"
        description="This creates reservations through the API and requires the ALLOCATION_CONFIRM permission."
        footer={
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={confirm.isPending || !selectionComplete}
              onClick={() => confirm.mutate()}
            >
              Confirm and create reservations
            </button>
          </div>
        }
      >
        <div className="alert alert-warning" role="note">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>
            Confirming creates reservations for {selectedCount} selected {selectedCount === 1 ? 'unit' : 'units'}.
            Verify clinical suitability before continuing.
          </span>
        </div>
        <dl className="detail-grid" style={{ marginTop: 16 }}>
          <div className="detail-item"><dt>Request</dt><dd>{request?.requestNumber ?? requestId}</dd></div>
          <div className="detail-item"><dt>Required quantity</dt><dd>{quantity || '—'}</dd></div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
            <dt>Unit IDs</dt>
            <dd>{candidates.filter((item) => item.selected && item.eligible).map((item) => item.unit.id).join(', ') || '—'}</dd>
          </div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
            <dt>Idempotency key</dt>
            <dd className="mono">{idempotencyKey}</dd>
          </div>
        </dl>
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIdempotencyKey(api.createIdempotencyKey())}
          >
            <KeyRound size={14} aria-hidden="true" /> Generate new key
          </button>
          <span className="text-xs text-subtle">
            A fresh key is generated automatically after a failed attempt so retries cannot replay stale state.
          </span>
        </div>
        <p className="text-xs text-subtle" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldAlert size={13} aria-hidden="true" /> This confirmation is idempotent and sent with the key shown above.
        </p>
      </Modal>

      <div className="section-heading" style={{ marginTop: 18 }}>
        <h3>After confirmation</h3>
        <span className="text-xs text-muted"><ArrowRight size={12} aria-hidden="true" /> Requests, reservations, inventory, and analytics refresh automatically</span>
      </div>
      <div className="task-grid">
        <button type="button" className="task-card surface-interactive" onClick={() => invalidateDomains(['reservations'])}>
          <span className="task-icon"><CheckCircle2 size={18} aria-hidden="true" /></span>
          <span className="task-title">Refresh reservations</span>
          <span className="task-meta">Sync holds created by allocation</span>
          <span className="task-cta">Sync now →</span>
        </button>
      </div>
    </div>
  );
}
