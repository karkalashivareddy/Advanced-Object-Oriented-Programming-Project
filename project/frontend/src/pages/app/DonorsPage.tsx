import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, HeartHandshake, Pencil, Plus, Search } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { BLOOD_GROUPS, DONOR_AVAILABILITY } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDate, formatDateTime, humanize, toDateInput } from '@/lib/utils';
import {
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  Modal,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import type {
  AppointmentView,
  BloodGroup,
  ConsentView,
  DonorAvailability,
  DonorView,
} from '@/types/domain';

interface DonorForm {
  userId: string;
  fullName: string;
  email: string;
  bloodGroup: BloodGroup;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  preferredContact: string;
  availability: DonorAvailability;
}

interface AppointmentForm {
  organizationId: string;
  scheduledAt: string;
  notes: string;
}

type AppointmentAction = 'CONFIRM' | 'COMPLETE' | 'CANCEL' | 'REJECT';

function emptyForm(userId: number): DonorForm {
  return {
    userId: userId ? String(userId) : '',
    fullName: '',
    email: '',
    bloodGroup: 'O_POSITIVE',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    preferredContact: '',
    availability: 'AVAILABLE',
  };
}

export function DonorsPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<DonorView | 'new' | null>(null);
  const [form, setForm] = useState<DonorForm>(() => emptyForm(auth.user?.id ?? 0));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState({ type: 'GENERAL', granted: true });
  const [appointment, setAppointment] = useState<AppointmentForm>({
    organizationId: auth.organizationId ? String(auth.organizationId) : '',
    scheduledAt: '',
    notes: '',
  });

  const donorsQuery = useQuery({
    queryKey: ['donors', 'list'],
    queryFn: () => api.get<DonorView[]>('/donors'),
  });

  const detailQuery = useQuery({
    queryKey: ['donors', 'detail', selectedId],
    queryFn: () => api.get<DonorView>(`/donors/${selectedId}`),
    enabled: selectedId !== null,
  });

  const consentsQuery = useQuery({
    queryKey: ['donors', selectedId, 'consents'],
    queryFn: () => api.get<ConsentView[]>(`/donors/${selectedId}/consents`),
    enabled: selectedId !== null,
  });

  const appointmentsQuery = useQuery({
    queryKey: ['donors', selectedId, 'appointments'],
    queryFn: () => api.get<AppointmentView[]>(`/donors/${selectedId}/appointments`),
    enabled: selectedId !== null,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['donors'] });

  const saveDonor = useMutation({
    mutationFn: () => {
      if (!editing || editing === 'new') {
        return api.post<DonorView>('/donors', {
          userId: Number(form.userId),
          bloodGroup: form.bloodGroup,
          dateOfBirth: form.dateOfBirth || undefined,
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          preferredContact: form.preferredContact.trim() || undefined,
        });
      }
      return api.patch<DonorView>(`/donors/${editing.id}`, {
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        preferredContact: form.preferredContact.trim() || undefined,
        availability: form.availability,
      });
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? 'Donor profile created' : 'Donor profile updated');
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error('Could not save donor', getErrorMessage(error)),
  });

  const addConsent = useMutation({
    mutationFn: () => api.post<ConsentView>(`/donors/${selectedId}/consents`, {
      type: consent.type.trim(),
      granted: consent.granted,
    }),
    onSuccess: () => {
      toast.success('Consent recorded');
      setConsent({ type: 'GENERAL', granted: true });
      invalidate();
    },
    onError: (error) => toast.error('Could not record consent', getErrorMessage(error)),
  });

  const addAppointment = useMutation({
    mutationFn: () => api.post<AppointmentView>(`/donors/${selectedId}/appointments`, {
      organizationId: Number(appointment.organizationId),
      scheduledAt: new Date(appointment.scheduledAt).toISOString(),
      notes: appointment.notes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Appointment requested');
      setAppointment((current) => ({ ...current, scheduledAt: '', notes: '' }));
      invalidate();
    },
    onError: (error) => toast.error('Could not request appointment', getErrorMessage(error)),
  });

  const appointmentAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: AppointmentAction }) =>
      api.patch<AppointmentView>(`/donors/appointments/${id}`, { action }),
    onSuccess: (_, variables) => {
      toast.success(`Appointment ${variables.action.toLowerCase()}ed`);
      invalidate();
    },
    onError: (error) => toast.error('Could not update appointment', getErrorMessage(error)),
  });

  const openEditor = (donor: DonorView | 'new') => {
    setEditing(donor);
    setErrors({});
    if (donor === 'new') {
      setForm(emptyForm(auth.user?.id ?? 0));
      return;
    }
    setForm({
      userId: String(donor.userId),
      fullName: donor.fullName,
      email: donor.email,
      bloodGroup: donor.bloodGroup,
      dateOfBirth: toDateInput(donor.dateOfBirth),
      address: donor.address ?? '',
      city: donor.city ?? '',
      state: donor.state ?? '',
      preferredContact: donor.preferredContact ?? '',
      availability: donor.availability ?? 'AVAILABLE',
    });
  };

  const submitDonor = () => {
    const next: Record<string, string> = {};
    if (editing !== 'new') {
      // Editable profile fields all have safe empty values.
    } else {
      if (!/^\d+$/.test(form.userId)) next.userId = 'Enter a numeric user ID.';
      if (!form.fullName.trim()) next.fullName = 'Full name is required.';
      if (!form.email.trim()) next.email = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) saveDonor.mutate();
  };

  const allDonors = donorsQuery.data ?? [];
  const term = debouncedSearch.trim().toLowerCase();
  const donors = term
    ? allDonors.filter((donor) =>
        donor.fullName.toLowerCase().includes(term) || donor.email.toLowerCase().includes(term))
    : allDonors;

  const consents = consentsQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];
  const detail = detailQuery.data;

  const columns: DataTableColumn<DonorView>[] = [
    {
      key: 'fullName',
      header: 'Donor',
      render: (donor) => (
        <div>
          <div className="table-cell-strong">{donor.fullName}</div>
          <div className="text-xs text-subtle">{donor.email}</div>
        </div>
      ),
    },
    { key: 'userId', header: 'User ID', render: (donor) => <span className="mono">{donor.userId}</span> },
    {
      key: 'bloodGroup',
      header: 'Blood group',
      render: (donor) => <span className="chip">{humanize(donor.bloodGroup)}</span>,
    },
    {
      key: 'availability',
      header: 'Availability',
      render: (donor) => <StatusBadge status={donor.availability ?? 'AVAILABLE'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (donor) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedId(donor.id)}>View</button>
          {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditor(donor)}>
              <Pencil size={13} aria-hidden="true" /> Edit
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Donors"
        description="Donor profiles, consent records, and appointment requests returned by the donor API."
        actions={
          auth.hasPermission(PERMISSIONS.DONOR_MANAGE) ? (
            <button type="button" className="btn btn-primary" onClick={() => openEditor('new')}>
              <Plus size={16} aria-hidden="true" /> New donor
            </button>
          ) : undefined
        }
      />

      <DataTable
        ariaLabel="Donor list"
        rowKey={(row) => row.id}
        columns={columns}
        rows={donors}
        loading={donorsQuery.isPending}
        onRowClick={(donor) => setSelectedId(donor.id)}
        emptyTitle="No donors found"
        emptyDescription="Try a different search or create a donor profile."
        toolbar={
          <div className="search-input-wrap">
            <Search size={15} aria-hidden="true" />
            <input
              className="input"
              type="search"
              aria-label="Search donors"
              placeholder="Search by name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      />
      {donorsQuery.isError && (
        <div className="card" style={{ marginTop: 16 }}>
          <ErrorState error={donorsQuery.error} onRetry={() => void donorsQuery.refetch()} />
        </div>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail?.fullName ?? 'Donor profile'}
        description={detail?.email}
      >
        {detailQuery.isPending && <div className="skeleton-lines"><Skeleton height={18} /><Skeleton height={18} /></div>}
        {detailQuery.isError && <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />}
        {detail && (
          <>
            <dl className="detail-grid">
              <div className="detail-item"><dt>User ID</dt><dd>{detail.userId}</dd></div>
              <div className="detail-item"><dt>Public ID</dt><dd className="mono">{detail.publicId}</dd></div>
              <div className="detail-item"><dt>Blood group</dt><dd>{humanize(detail.bloodGroup)}</dd></div>
              <div className="detail-item"><dt>Date of birth</dt><dd>{formatDate(detail.dateOfBirth)}</dd></div>
              <div className="detail-item"><dt>Availability</dt><dd><StatusBadge status={detail.availability ?? 'AVAILABLE'} /></dd></div>
              <div className="detail-item"><dt>Preferred contact</dt><dd>{detail.preferredContact ?? '—'}</dd></div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <dt>Address</dt>
                <dd>{[detail.address, detail.city, detail.state].filter(Boolean).join(', ') || '—'}</dd>
              </div>
            </dl>

            <hr className="divider" />
            <h3>Consents</h3>
            {consentsQuery.isPending && <Skeleton height={50} />}
            {consents.length === 0 && consentsQuery.isSuccess && (
              <EmptyState title="No consent records" description="Record a consent below." />
            )}
            {consents.map((item) => (
              <div className="item-header" key={item.id}>
                <div>
                  <strong>{humanize(item.type)}</strong>
                  <div className="text-xs text-muted">{formatDateTime(item.grantedAt)}</div>
                </div>
                <StatusBadge status={item.granted ? 'APPROVED' : 'REJECTED'} label={item.granted ? 'Granted' : 'Withdrawn'} />
              </div>
            ))}
            {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
              <div className="inline-form" style={{ marginTop: 12 }}>
                <FormField label="Consent type" required full>
                  <input className="input" value={consent.type} onChange={(event) => setConsent({ ...consent, type: event.target.value })} />
                </FormField>
                <label className="checkbox-row">
                  <input type="checkbox" checked={consent.granted} onChange={(event) => setConsent({ ...consent, granted: event.target.checked })} />
                  Consent granted
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={addConsent.isPending || !consent.type.trim()}
                  onClick={() => addConsent.mutate()}
                >
                  Record consent
                </button>
              </div>
            )}

            <hr className="divider" />
            <h3>Appointments</h3>
            {appointmentsQuery.isPending && <Skeleton height={50} />}
            {appointments.length === 0 && appointmentsQuery.isSuccess && (
              <EmptyState title="No appointments" description="Request an appointment below." />
            )}
            {appointments.map((item) => (
              <div className="item-header" key={item.id}>
                <div>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={14} aria-hidden="true" /> {formatDateTime(item.scheduledAt)}
                  </strong>
                  <div className="text-xs text-muted">{item.organizationName ?? `Organization #${item.organizationId}`}</div>
                  {item.notes && <div className="text-xs text-subtle">{item.notes}</div>}
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
            {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
              <div className="inline-form" style={{ marginTop: 12 }}>
                <FormField label="Organization ID" required full>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={appointment.organizationId}
                    onChange={(event) => setAppointment({ ...appointment, organizationId: event.target.value })}
                  />
                </FormField>
                <FormField label="Appointment date and time" required full>
                  <input
                    className="input"
                    type="datetime-local"
                    value={appointment.scheduledAt}
                    onChange={(event) => setAppointment({ ...appointment, scheduledAt: event.target.value })}
                  />
                </FormField>
                <FormField label="Notes" hint="Optional" full>
                  <textarea
                    className="textarea"
                    value={appointment.notes}
                    onChange={(event) => setAppointment({ ...appointment, notes: event.target.value })}
                  />
                </FormField>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={addAppointment.isPending || !appointment.scheduledAt || !/^\d+$/.test(appointment.organizationId)}
                  onClick={() => addAppointment.mutate()}
                >
                  Request appointment
                </button>
              </div>
            )}
            {auth.hasPermission(PERMISSIONS.APPOINTMENT_MANAGE) && (
              <div className="action-row">
                {appointments
                  .filter((item) => ['REQUESTED', 'CONFIRMED'].includes(item.status.toUpperCase()))
                  .flatMap((item) => {
                    const status = item.status.toUpperCase();
                    const actions: AppointmentAction[] = status === 'REQUESTED' ? ['CONFIRM', 'REJECT', 'CANCEL'] : ['COMPLETE', 'CANCEL'];
                    return actions.map((action) => (
                      <button
                        key={`${item.id}-${action}`}
                        type="button"
                        className={`btn btn-sm ${action === 'CONFIRM' || action === 'COMPLETE' ? 'btn-primary' : 'btn-secondary'}`}
                        disabled={appointmentAction.isPending}
                        onClick={() => appointmentAction.mutate({ id: item.id, action })}
                      >
                        {humanize(action)} · {formatDate(item.scheduledAt)}
                      </button>
                    ));
                  })}
              </div>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New donor profile' : 'Edit donor profile'}
        description="Submitted through the donors API."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={saveDonor.isPending} onClick={submitDonor}>Save donor</button>
          </>
        }
      >
        <div className="form-grid">
          {editing === 'new' ? (
            <>
              <FormField label="User ID" error={errors.userId} hint="ID of the account this profile belongs to" required full>
                <input className="input" inputMode="numeric" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} />
              </FormField>
              <FormField label="Full name" error={errors.fullName} required full>
                <input className="input" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
              </FormField>
              <FormField label="Email" error={errors.email} required full>
                <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </FormField>
              <FormField label="Blood group" required>
                <select className="select" value={form.bloodGroup} onChange={(event) => setForm({ ...form, bloodGroup: event.target.value as BloodGroup })}>
                  {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{humanize(group)}</option>)}
                </select>
              </FormField>
              <FormField label="Date of birth">
                <input className="input" type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
              </FormField>
            </>
          ) : (
            <FormField label="Availability" full>
              <select className="select" value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value as DonorAvailability })}>
                {DONOR_AVAILABILITY.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="Address" full>
            <input className="input" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </FormField>
          <FormField label="City">
            <input className="input" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </FormField>
          <FormField label="State">
            <input className="input" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
          </FormField>
          <FormField label="Preferred contact" full>
            <input className="input" value={form.preferredContact} onChange={(event) => setForm({ ...form, preferredContact: event.target.value })} />
          </FormField>
        </div>
        <p className="text-xs text-subtle" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <HeartHandshake size={13} aria-hidden="true" /> Consent and appointment records are managed from the donor drawer.
        </p>
      </Modal>
    </>
  );
}
