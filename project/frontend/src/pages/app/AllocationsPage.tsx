import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Info, Search, ShieldAlert } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDate, humanize } from '@/lib/utils';
import {
  EmptyState,
  ErrorState,
  FormField,
  Modal,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/components/ui';
import type {
  AllocationCandidateView,
  AllocationSuggestion,
  BloodUnitView,
  EmergencyRequestView,
} from '@/types/domain';

interface Candidate extends AllocationCandidateView {
  selected: boolean;
}

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

export function AllocationsPage() {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [requestId, setRequestId] = useState(searchParams.get('requestId') ?? '');
  const [suggestion, setSuggestion] = useState<AllocationSuggestion | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['requests', 'for-allocations'],
    queryFn: () => api.get<EmergencyRequestView[]>('/emergency-requests'),
    enabled: auth.hasPermission(PERMISSIONS.REQUEST_READ),
  });

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
    },
    onError: (error) => toast.error('Could not confirm allocation', getErrorMessage(error)),
  });

  const selectedCount = candidates.filter((candidate) => candidate.selected && candidate.eligible).length;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Allocations"
        description="Review candidate units for an emergency request. This screen does not make clinical decisions."
      />

      <div className="notice-banner" role="note">
        <Info size={18} aria-hidden="true" />
        <div>
          <strong>Non-clinical decision support</strong>
          Suggestions are advisory only. Qualified staff must verify compatibility and clinical suitability before any
          allocation is confirmed. The server remains responsible for authorization and invariants.
        </div>
      </div>

      <section className="card card-pad" aria-labelledby="suggestions-form-title">
        <h2 className="card-title" id="suggestions-form-title">Request to evaluate</h2>
        <p className="card-subtitle" style={{ marginBottom: 16 }}>
          Choose an emergency request, then ask the API for candidate evaluations.
        </p>
        <div className="form-grid">
          <FormField label="Emergency request ID" hint="Numeric ID from the request list" required full>
            <input
              className="input"
              inputMode="numeric"
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
            />
          </FormField>
          {requestsQuery.data && requestsQuery.data.length > 0 && (
            <FormField label="Or choose from recent requests" full>
              <select
                className="select"
                value={requestId}
                onChange={(event) => setRequestId(event.target.value)}
              >
                <option value="">Select a request…</option>
                {requestsQuery.data.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.requestNumber} · {humanize(request.status)}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>
        <div className="action-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={suggestions.isPending || !/^\d+$/.test(requestId)}
            onClick={() => suggestions.mutate(Number(requestId))}
          >
            <Search size={15} aria-hidden="true" /> Get suggestions
          </button>
        </div>
        {requestsQuery.isError && <p className="field-error" style={{ marginTop: 8 }}>Request list unavailable: {getErrorMessage(requestsQuery.error)}</p>}
      </section>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="candidates-title">
        <div className="card-header">
          <div>
            <h2 className="card-title" id="candidates-title">Candidate units</h2>
            <p className="card-subtitle">Advisory evaluations returned by /allocations/suggestions</p>
          </div>
          {candidates.length > 0 && auth.hasPermission(PERMISSIONS.ALLOCATION_CONFIRM) && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={selectedCount === 0}
              onClick={() => {
                setIdempotencyKey(api.createIdempotencyKey());
                setConfirmOpen(true);
              }}
            >
              Confirm {selectedCount || ''} {selectedCount === 1 ? 'unit' : 'units'}
            </button>
          )}
        </div>
        <div className="card-body">
          {suggestion && (
            <dl className="detail-grid" style={{ marginTop: 0 }}>
              <div className="detail-item"><dt>Rule version</dt><dd>{suggestion.ruleVersion || '—'}</dd></div>
              <div className="detail-item"><dt>Human approval</dt><dd>{suggestion.humanApprovalRequired ? 'Required' : 'Not required'}</dd></div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}><dt>Compatibility rule</dt><dd>{suggestion.compatibilityRule || '—'}</dd></div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}><dt>Feasibility</dt><dd>{suggestion.feasibility || '—'}</dd></div>
            </dl>
          )}
          {suggestions.isPending && <div className="skeleton-lines"><Skeleton height={20} /><Skeleton height={20} /><Skeleton height={20} /></div>}
          {suggestions.isError && <ErrorState error={suggestions.error} onRetry={() => suggestions.mutate(Number(requestId))} />}
          {suggestions.isSuccess && candidates.length === 0 && (
            <EmptyState title="No candidates returned" description="The API returned no candidate evaluations for this request." />
          )}
          {!suggestions.isPending && !suggestions.isSuccess && (
            <EmptyState title="No evaluation yet" description="Enter a request ID and load suggestions to see candidates." />
          )}
          <div className="stack" style={{ marginTop: candidates.length ? 12 : 0 }}>
            {candidates.map((candidate) => (
              <label
                key={candidate.unit.id}
                className="item-header"
                style={{ cursor: candidate.eligible ? 'pointer' : 'not-allowed', opacity: candidate.eligible ? 1 : 0.6 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <input
                    type="checkbox"
                    checked={candidate.selected}
                    disabled={!candidate.eligible}
                    onChange={(event) => setCandidates((current) =>
                      current.map((item) => item.unit.id === candidate.unit.id ? { ...item, selected: event.target.checked } : item),
                    )}
                  />
                  <span>
                    <strong className="mono">{candidate.unit.unitNumber}</strong>
                    <span className="text-xs text-muted" style={{ display: 'block' }}>
                      {humanize(candidate.unit.bloodGroup)} · {humanize(candidate.unit.componentType)} · expires {formatDate(candidate.unit.expiresAt)}
                    </span>
                    {candidate.rejectionReasons.length > 0 && (
                      <span className="chip" style={{ marginTop: 4 }}>{candidate.rejectionReasons.map(humanize).join(', ')}</span>
                    )}
                  </span>
                </span>
                <span className="cluster">
                  <span className="chip">Rank {candidate.rank}</span>
                  <StatusBadge status={candidate.eligible ? 'AVAILABLE' : 'REJECTED'} label={candidate.eligible ? 'Eligible' : 'Not eligible'} />
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm allocation"
        description="This creates reservations through the API and requires the ALLOCATION_CONFIRM permission."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              Confirm and create reservations
            </button>
          </>
        }
      >
        <div className="alert alert-warning" role="note">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>
            Confirming creates reservations for {selectedCount} selected {selectedCount === 1 ? 'unit' : 'units'}. Verify
            clinical suitability before continuing.
          </span>
        </div>
        <dl className="detail-grid" style={{ marginTop: 16 }}>
          <div className="detail-item"><dt>Request ID</dt><dd>{requestId}</dd></div>
          <div className="detail-item">
            <dt>Unit IDs</dt>
            <dd>{candidates.filter((item) => item.selected && item.eligible).map((item) => item.unit.id).join(', ') || '—'}</dd>
          </div>
          <div className="detail-item" style={{ gridColumn: '1 / -1' }}><dt>Idempotency key</dt><dd className="mono">{idempotencyKey}</dd></div>
        </dl>
        <p className="text-xs text-subtle" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldAlert size={13} aria-hidden="true" /> This confirmation is idempotent and sent with the key shown above.
        </p>
      </Modal>
    </>
  );
}
