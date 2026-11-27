import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  HeartHandshake,
  LocateFixed,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { BLOOD_GROUPS, DONOR_AVAILABILITY } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { useInvalidateDomains } from '@/lib/queryCache';
import { formatDate, formatDateTime, humanize, toDateInput } from '@/lib/utils';
import {
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Surface,
  useToast,
  type DataTableColumn,
} from '@/components/ui';
import type { PageResponse } from '@/types/api';
import type {
  AppointmentView,
  BloodGroup,
  ConsentView,
  DonorAvailability,
  DonorView,
  OrganizationView,
  UserView,
} from '@/types/domain';

interface DonorForm {
  userId: string;
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

const PAGE_SIZE = 10;

function emptyForm(): DonorForm {
  return {
    userId: '',
    bloodGroup: 'O_POSITIVE',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    preferredContact: '',
    availability: 'AVAILABLE',
  };
}

function consentLabel(item: ConsentView): { status: string; label: string } {
  if (item.withdrawnAt) return { status: 'CANCELLED', label: 'Withdrawn' };
  return item.granted ? { status: 'APPROVED', label: 'Granted' } : { status: 'REJECTED', label: 'Not granted' };
}

export function DonorsPage() {
  const auth = useAuth();
  const toast = useToast();
  const invalidateDomains = useInvalidateDomains();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [bloodGroup, setBloodGroup] = useState('');
  const [availability, setAvailability] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(0);
  const [userQuery, setUserQuery] = useState('');
  const debouncedUserQuery = useDebouncedValue(userQuery);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<DonorView | 'new' | null>(null);
  const [form, setForm] = useState<DonorForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState({ type: 'GENERAL', granted: true });
  const [locationCoordinates, setLocationCoordinates] = useState({ latitude: '', longitude: '' });
  const [locationError, setLocationError] = useState('');
  const [appointment, setAppointment] = useState<AppointmentForm>({
    organizationId: auth.organizationId ? String(auth.organizationId) : '',
    scheduledAt: '',
    notes: '',
  });

  const canBrowseUsers = auth.hasPermission(PERMISSIONS.USER_READ);
  const canChooseOrganization = auth.hasPermission(PERMISSIONS.ORGANIZATION_READ);
  const activeMembership =
    auth.user?.memberships.find((membership) => membership.organizationId === auth.organizationId) ??
    auth.user?.memberships[0];

  const donorsQuery = useQuery({
    queryKey: ['donors', 'list', page, PAGE_SIZE, debouncedSearch, bloodGroup, availability, city],
    queryFn: () => api.get<PageResponse<DonorView>>('/donors', {
      query: {
        page,
        size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        bloodGroup: bloodGroup || undefined,
        availability: availability || undefined,
        city: city.trim() || undefined,
      },
    }),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'account-picker', debouncedUserQuery],
    queryFn: () =>
      api.get<PageResponse<UserView>>('/users', {
        query: { search: debouncedUserQuery || undefined, size: 20 },
      }),
    enabled: editing === 'new' && canBrowseUsers,
  });

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'options', auth.organizationId],
    queryFn: () => api.get<PageResponse<OrganizationView>>('/organizations', { query: { size: 100 } }),
    enabled: canChooseOrganization,
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

  const membershipOptions = (auth.user?.memberships ?? []).map((membership) => ({
    id: membership.organizationId,
    name: membership.organizationName,
  }));
  const organizationOptions = Array.from(
    new Map(
      (canChooseOrganization && organizationsQuery.data?.content.length
        ? organizationsQuery.data.content.map((organization) => ({ id: organization.id, name: organization.name }))
        : membershipOptions
      ).map((option) => [option.id, option]),
    ).values(),
  );

  const invalidate = () => invalidateDomains(['donors']);

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
      toast.success(editing === 'new' ? 'Donor profile linked' : 'Donor profile updated');
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error('Could not save donor', getErrorMessage(error)),
  });

  const addConsent = useMutation({
    mutationFn: () =>
      api.post<ConsentView>(`/donors/${selectedId}/consents`, {
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

  const withdrawConsent = useMutation({
    mutationFn: ({ donorId, consentId }: { donorId: number; consentId: number }) =>
      api.patch(`/donors/${donorId}/consents/${consentId}`),
    onSuccess: () => {
      toast.success('Consent withdrawn');
      invalidate();
    },
    onError: (error) => toast.error('Could not withdraw consent', getErrorMessage(error)),
  });

  const locationPreference = useMutation({
    mutationFn: (enabled: boolean) => api.patch<{ consentGranted: boolean; locationUpdatedAt: string | null }>(
      `/donors/${selectedId}/location-preference`,
      enabled
        ? { enabled, latitude: Number(locationCoordinates.latitude), longitude: Number(locationCoordinates.longitude) }
        : { enabled },
    ),
    onSuccess: (result) => {
      toast.success(result.consentGranted ? 'Location sharing enabled' : 'Location consent withdrawn');
      setLocationError('');
      setLocationCoordinates({ latitude: '', longitude: '' });
      invalidate();
    },
    onError: (error) => toast.error('Could not update location preference', getErrorMessage(error)),
  });

  const captureLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Location access is unavailable in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocationCoordinates({ latitude: String(coords.latitude), longitude: String(coords.longitude) }),
      () => setLocationError('Location was not shared. You can enter coordinates manually.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const addAppointment = useMutation({
    mutationFn: () =>
      api.post<AppointmentView>(`/donors/${selectedId}/appointments`, {
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
    saveDonor.reset();
    setErrors({});
    setEditing(donor);
    if (donor === 'new') {
      setUserQuery('');
      setForm(emptyForm());
      return;
    }
    setForm({
      userId: String(donor.userId),
      bloodGroup: donor.bloodGroup,
      dateOfBirth: toDateInput(donor.dateOfBirth),
      address: donor.address ?? '',
      city: donor.city ?? '',
      state: donor.state ?? '',
      preferredContact: donor.preferredContact ?? '',
      availability: donor.availability ?? 'AVAILABLE',
    });
  };

  const openDetail = (id: number) => {
    addConsent.reset();
    withdrawConsent.reset();
    addAppointment.reset();
    appointmentAction.reset();
    setSelectedId(id);
  };

  const submitDonor = () => {
    const next: Record<string, string> = {};
    if (editing === 'new') {
      if (!/^\d+$/.test(form.userId) || Number(form.userId) <= 0) {
        next.userId = 'Choose an existing user account.';
      }
    }
    setErrors(next);
    if (Object.keys(next).length === 0) saveDonor.mutate();
  };

  const clearFilters = () => {
    setSearch('');
    setBloodGroup('');
    setAvailability('');
    setCity('');
    setPage(0);
  };

  const donors = donorsQuery.data?.content ?? [];
  const totalElements = donorsQuery.data?.totalElements ?? 0;
  const safePage = donorsQuery.data?.page ?? page;

  const accountResults = usersQuery.data?.content ?? [];
  const selectedUserId = Number(form.userId);
  const selectedUser =
    accountResults.find((user) => user.id === selectedUserId) ??
    (auth.user?.id === selectedUserId ? auth.user : null);

  const consents = consentsQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];
  const detail = detailQuery.data;

  const renderActions = (donor: DonorView) => (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetail(donor.id)}>
        View
      </button>
      {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditor(donor)}>
          <Pencil size={13} aria-hidden="true" /> Edit
        </button>
      )}
    </>
  );

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
      key: 'city',
      header: 'City',
      render: (donor) => donor.city ?? '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (donor) => (
        <div
          className="table-actions"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {renderActions(donor)}
        </div>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Operations"
        title="Donors"
        description="Link existing accounts to donor profiles and manage consent and appointments."
        actions={
          auth.hasPermission(PERMISSIONS.DONOR_MANAGE) ? (
            <button type="button" className="btn btn-primary" onClick={() => openEditor('new')}>
              <Plus size={16} aria-hidden="true" /> New donor
            </button>
          ) : undefined
        }
      />

      <section className="metric-grid page-enter stagger-1" aria-label="Donor summary">
        <article className="metric-card surface">
          <span className="metric-label">Profiles returned</span>
          <strong className="metric-value">{donors.length}</strong>
          <span className="metric-delta">On this page</span>
        </article>
        <article className="metric-card surface">
          <span className="metric-label">Available donors</span>
          <strong className="metric-value">
            {donors.filter((donor) => (donor.availability ?? 'AVAILABLE') === 'AVAILABLE').length}
          </strong>
          <span className="metric-delta">Available on this page</span>
        </article>
        <article className="metric-card surface">
          <span className="metric-label">Matching filters</span>
          <strong className="metric-value">{totalElements}</strong>
          <span className="metric-delta">Matching records across pages</span>
        </article>
      </section>

      <Surface as="section" variant="flat" padding="md" aria-label="Donor filters">
        <div className="filter-grid">
          <div className="filter-field">
            <label htmlFor="donor-search">Search donors</label>
            <div className="search-input-wrap">
              <Search size={15} aria-hidden="true" />
              <Input
                id="donor-search"
                type="search"
                aria-describedby="donor-filter-note"
                placeholder="Name or public ID…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <span className="text-xs text-subtle" id="donor-filter-note">
              Search, filters and pagination run on the server within your authorized donor scope.
            </span>
          </div>
          <div className="filter-field">
            <label htmlFor="donor-blood-group">Blood group</label>
            <Select
              id="donor-blood-group"
              value={bloodGroup}
              onChange={(event) => {
                setBloodGroup(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All blood groups</option>
              {BLOOD_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {humanize(group)}
                </option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <label htmlFor="donor-availability">Availability</label>
            <Select
              id="donor-availability"
              value={availability}
              onChange={(event) => {
                setAvailability(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Any availability</option>
              {DONOR_AVAILABILITY.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </Select>
          </div>
          <div className="filter-field">
            <label htmlFor="donor-city">City</label>
            <Input
              id="donor-city"
              type="search"
              placeholder="Any city"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="section-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <RotateCcw size={14} aria-hidden="true" /> Reset
            </button>
          </div>
        </div>
      </Surface>

      <DataTable
        ariaLabel="Donor list"
        caption="Donor profiles returned by the donor API"
        loadingLabel="Loading donors…"
        rowKey={(row) => row.id}
        columns={columns}
        rows={donors}
        loading={donorsQuery.isPending}
        page={safePage}
        size={PAGE_SIZE}
        totalElements={totalElements}
        onPageChange={setPage}
        onRowClick={(donor) => openDetail(donor.id)}
        emptyTitle="No donors found"
        emptyDescription="Try a different filter or link an existing user account."
        emptyAction={
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
            <RotateCcw size={14} aria-hidden="true" /> Clear filters
          </button>
        }
        mobileCard={(donor) => (
          <>
            <strong className="task-title">{donor.fullName}</strong>
            <dl className="mobile-card-fields">
              <div>
                <dt>Email</dt>
                <dd>{donor.email}</dd>
              </div>
              <div>
                <dt>Blood group</dt>
                <dd>{humanize(donor.bloodGroup)}</dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>
                  <StatusBadge status={donor.availability ?? 'AVAILABLE'} />
                </dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{donor.city ?? '—'}</dd>
              </div>
            </dl>
            <div className="action-row">{renderActions(donor)}</div>
          </>
        )}
      />

      {donorsQuery.isError && (
        <ErrorState error={donorsQuery.error} onRetry={() => void donorsQuery.refetch()} />
      )}

      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail?.fullName ?? 'Donor profile'}
        description={detail?.email}
      >
        {detailQuery.isPending && (
          <div className="skeleton-lines" role="status" aria-live="polite">
            <Skeleton height={18} />
            <Skeleton height={18} />
          </div>
        )}
        {detailQuery.isError && (
          <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        )}
        {detail && (
          <div className="stack">
            <div>
              <div className="section-heading">
                <h3>Profile</h3>
                <StatusBadge
                  status={detail.availability ?? 'AVAILABLE'}
                  label={`Donor ${humanize(detail.availability ?? 'AVAILABLE').toLowerCase()}`}
                />
              </div>
              <span className="freshness">
                Details loaded {formatDateTime(new Date(detailQuery.dataUpdatedAt).toISOString())}
              </span>
              <dl className="detail-grid">
                <div className="detail-item">
                  <dt>User ID</dt>
                  <dd className="mono">{detail.userId}</dd>
                </div>
                <div className="detail-item">
                  <dt>Public ID</dt>
                  <dd className="mono">{detail.publicId}</dd>
                </div>
                <div className="detail-item">
                  <dt>Blood group</dt>
                  <dd>{humanize(detail.bloodGroup)}</dd>
                </div>
                <div className="detail-item">
                  <dt>Date of birth</dt>
                  <dd>{formatDate(detail.dateOfBirth)}</dd>
                </div>
                <div className="detail-item">
                  <dt>Preferred contact</dt>
                  <dd>{detail.preferredContact ?? '—'}</dd>
                </div>
                <div className="detail-item">
                  <dt>City</dt>
                  <dd>{detail.city ?? '—'}</dd>
                </div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <dt>Address</dt>
                  <dd>{[detail.address, detail.city, detail.state].filter(Boolean).join(', ') || '—'}</dd>
                </div>
              </dl>
            </div>

            {detail.userId === auth.user?.id && (
              <section className="donor-location-consent" aria-labelledby="location-consent-heading">
                <div className="section-heading">
                  <div>
                    <h3 id="location-consent-heading">Location discovery consent</h3>
                    <p className="text-xs text-muted">Optional. Your exact coordinates are used for matching and never shown in search results.</p>
                  </div>
                  <StatusBadge
                    status={consents.some((item) => item.type === 'LOCATION_DISCOVERY' && item.granted && !item.withdrawnAt) ? 'APPROVED' : 'UNAVAILABLE'}
                    label={consents.some((item) => item.type === 'LOCATION_DISCOVERY' && item.granted && !item.withdrawnAt) ? 'Sharing on' : 'Sharing off'}
                  />
                </div>
                <div className="donor-location-controls">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={captureLocation}>
                    <LocateFixed size={15} aria-hidden="true" /> Use current device location
                  </button>
                  <FormField label="Latitude">
                    <Input inputMode="decimal" value={locationCoordinates.latitude}
                      onChange={(event) => setLocationCoordinates({ ...locationCoordinates, latitude: event.target.value })} placeholder="12.9716" />
                  </FormField>
                  <FormField label="Longitude">
                    <Input inputMode="decimal" value={locationCoordinates.longitude}
                      onChange={(event) => setLocationCoordinates({ ...locationCoordinates, longitude: event.target.value })} placeholder="77.5946" />
                  </FormField>
                </div>
                {locationError && <p role="alert" className="field-error">{locationError}</p>}
                {locationPreference.isError && <p role="alert" className="field-error">{getErrorMessage(locationPreference.error)}</p>}
                <div className="form-actions">
                  <button type="button" className="btn btn-primary btn-sm"
                    disabled={locationPreference.isPending || !locationCoordinates.latitude.trim() || !locationCoordinates.longitude.trim()}
                    onClick={() => locationPreference.mutate(true)}>
                    {locationPreference.isPending ? 'Saving…' : 'Opt in and share location'}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" disabled={locationPreference.isPending}
                    onClick={() => locationPreference.mutate(false)}>
                    Withdraw consent and clear location
                  </button>
                </div>
              </section>
            )}

            <section aria-label="Consent records">
              <div className="section-heading">
                <h3>Consents</h3>
                <span className="status-chip">{consents.length} records</span>
              </div>
              {consentsQuery.isPending && <Skeleton height={50} />}
              {consentsQuery.isError && (
                <ErrorState
                  error={consentsQuery.error}
                  title="Consent records could not be loaded"
                  onRetry={() => void consentsQuery.refetch()}
                />
              )}
              {consentsQuery.isSuccess && consents.length === 0 && (
                <EmptyState title="No consent records" description="Record a consent below." />
              )}
              {consents.length > 0 && (
                <ul className="timeline-list">
                  {consents.map((item) => {
                    const badge = consentLabel(item);
                    return (
                      <li key={item.id}>
                        <div className="item-header">
                          <div>
                            <strong>{humanize(item.type)}</strong>
                            <div className="text-xs text-muted">{formatDateTime(item.grantedAt)}</div>
                            {item.withdrawnAt && (
                              <div className="text-xs text-subtle">Withdrawn {formatDateTime(item.withdrawnAt)}</div>
                            )}
                          </div>
                          <StatusBadge status={badge.status} label={badge.label} />
                        </div>
                        {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && item.granted && !item.withdrawnAt && (
                          <div className="form-actions">
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={withdrawConsent.isPending}
                              onClick={() => {
                                withdrawConsent.reset();
                                withdrawConsent.mutate({ donorId: detail.id, consentId: item.id });
                              }}
                            >
                              {withdrawConsent.isPending ? 'Withdrawing…' : 'Withdraw consent'}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {withdrawConsent.isError && (
                <div className="alert alert-danger" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>Could not withdraw consent: {getErrorMessage(withdrawConsent.error)}</span>
                </div>
              )}
              {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
                <div className="form-grid">
                  <FormField label="Consent type" required full hint="Location discovery consent can only be managed by the donor in the dedicated privacy section above.">
                    <Input
                      value={consent.type}
                      onChange={(event) => setConsent({ ...consent, type: event.target.value })}
                    />
                  </FormField>
                  <fieldset className="form-field form-field-full">
                    <legend>Decision</legend>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={consent.granted}
                        onChange={(event) => setConsent({ ...consent, granted: event.target.checked })}
                      />
                      Consent granted
                    </label>
                  </fieldset>
                </div>
              )}
              {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
                <>
                  {addConsent.isError && (
                    <div className="alert alert-danger" role="alert">
                      <AlertTriangle size={15} aria-hidden="true" />
                      <span>Could not record consent: {getErrorMessage(addConsent.error)}</span>
                    </div>
                  )}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={addConsent.isPending || !consent.type.trim() || consent.type.trim().toUpperCase() === 'LOCATION_DISCOVERY'}
                      onClick={() => {
                        addConsent.reset();
                        addConsent.mutate();
                      }}
                    >
                      {addConsent.isPending ? 'Recording consent…' : 'Record consent'}
                    </button>
                  </div>
                </>
              )}
            </section>

            <section aria-label="Appointments">
              <div className="section-heading">
                <h3>Appointments</h3>
                <span className="status-chip">{appointments.length} total</span>
              </div>
              {appointmentsQuery.isPending && <Skeleton height={50} />}
              {appointmentsQuery.isError && (
                <ErrorState
                  error={appointmentsQuery.error}
                  title="Appointments could not be loaded"
                  onRetry={() => void appointmentsQuery.refetch()}
                />
              )}
              {appointmentsQuery.isSuccess && appointments.length === 0 && (
                <EmptyState title="No appointments" description="Request an appointment below." />
              )}
              {appointments.length > 0 && (
                <ul className="timeline-list">
                  {appointments.map((item) => {
                    const status = item.status.toUpperCase();
                    const actions: AppointmentAction[] =
                      status === 'REQUESTED'
                        ? ['CONFIRM', 'REJECT', 'CANCEL']
                        : status === 'CONFIRMED'
                          ? ['COMPLETE', 'CANCEL']
                          : [];
                    return (
                      <li key={item.id}>
                        <div className="item-header">
                          <div>
                            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CalendarDays size={14} aria-hidden="true" /> {formatDateTime(item.scheduledAt)}
                            </strong>
                            <div className="text-xs text-muted">
                              {item.organizationName ?? `Organization #${item.organizationId}`}
                            </div>
                            {item.notes && <div className="text-xs text-subtle">{item.notes}</div>}
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        {auth.hasPermission(PERMISSIONS.APPOINTMENT_MANAGE) && actions.length > 0 && (
                          <div className="action-row">
                            {actions.map((action) => (
                              <button
                                key={`${item.id}-${action}`}
                                type="button"
                                className={`btn btn-sm ${action === 'CONFIRM' || action === 'COMPLETE' ? 'btn-primary' : 'btn-secondary'}`}
                                disabled={appointmentAction.isPending}
                                onClick={() => {
                                  appointmentAction.reset();
                                  appointmentAction.mutate({ id: item.id, action });
                                }}
                              >
                                {appointmentAction.isPending ? 'Updating…' : `${humanize(action)} · ${formatDate(item.scheduledAt)}`}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {appointmentAction.isError && (
                <div className="alert alert-danger" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>Could not update appointment: {getErrorMessage(appointmentAction.error)}</span>
                </div>
              )}
              {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
                <div className="form-grid">
                  <FormField
                    label="Organization"
                    required
                    full
                    hint="Defaults to your active membership"
                  >
                    <Select
                      value={appointment.organizationId}
                      onChange={(event) => setAppointment({ ...appointment, organizationId: event.target.value })}
                    >
                      <option value="">Select an organization</option>
                      {organizationOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  {canChooseOrganization && organizationsQuery.isError && (
                    <ErrorState
                      error={organizationsQuery.error}
                      title="Organizations could not be loaded"
                      onRetry={() => void organizationsQuery.refetch()}
                    />
                  )}
                  <FormField label="Appointment date and time" required full>
                    <Input
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
                </div>
              )}
              {auth.hasPermission(PERMISSIONS.DONOR_MANAGE) && (
                <>
                  {addAppointment.isError && (
                    <div className="alert alert-danger" role="alert">
                      <AlertTriangle size={15} aria-hidden="true" />
                      <span>Could not request appointment: {getErrorMessage(addAppointment.error)}</span>
                    </div>
                  )}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={
                        addAppointment.isPending ||
                        !appointment.scheduledAt ||
                        !Number(appointment.organizationId)
                      }
                      onClick={() => {
                        addAppointment.reset();
                        addAppointment.mutate();
                      }}
                    >
                      {addAppointment.isPending ? 'Requesting appointment…' : 'Request appointment'}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Link a donor account' : 'Edit donor profile'}
        description="Donor profiles link to existing user accounts; credentials are created through registration."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={saveDonor.isPending} onClick={submitDonor}>
              {saveDonor.isPending
                ? editing === 'new'
                  ? 'Linking donor…'
                  : 'Saving donor…'
                : editing === 'new'
                  ? 'Link donor'
                  : 'Save donor'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          {editing === 'new' ? (
            <>
              <div className="form-field-full">
                <div className="section-heading">
                  <h3>Existing user account</h3>
                  <Users size={16} aria-hidden="true" />
                </div>
                <p className="text-sm text-subtle">
                  Select the account to link. Full name and email come from the user record and are not entered here.
                </p>
                {canBrowseUsers ? (
                  <>
                    <FormField
                      label="Search user accounts"
                      hint="Searches /users by name or email"
                      error={errors.userId}
                      full
                    >
                      <Input
                        type="search"
                        placeholder="Name or email…"
                        value={userQuery}
                        onChange={(event) => setUserQuery(event.target.value)}
                      />
                    </FormField>
                    {usersQuery.isPending && <Skeleton height={36} width="100%" />}
                    {usersQuery.isError && (
                      <ErrorState
                        error={usersQuery.error}
                        title="User accounts could not be loaded"
                        onRetry={() => void usersQuery.refetch()}
                      />
                    )}
                    {usersQuery.isSuccess && accountResults.length === 0 && (
                      <EmptyState title="No matching accounts" description="Try a different name or email." />
                    )}
                    {accountResults.length > 0 && (
                      <ul className="timeline-list" aria-label="User accounts">
                        {accountResults.map((user) => (
                          <li key={user.id}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-pressed={selectedUserId === user.id}
                              onClick={() => {
                                setForm((current) => ({ ...current, userId: String(user.id) }));
                                setErrors((current) => ({ ...current, userId: '' }));
                              }}
                            >
                              <strong>{user.fullName}</strong> · {user.email}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <FormField
                    label="User ID"
                    error={errors.userId}
                    hint="Your role cannot browse accounts; enter the numeric user ID."
                    required
                    full
                  >
                    <Input
                      inputMode="numeric"
                      value={form.userId}
                      onChange={(event) => setForm({ ...form, userId: event.target.value })}
                    />
                  </FormField>
                )}
                {selectedUserId > 0 && (
                  <p className="chip">
                    {selectedUser
                      ? `Selected: ${selectedUser.fullName} (${selectedUser.email})`
                      : `Selected user #${form.userId}`}
                  </p>
                )}
              </div>
              <FormField label="Blood group" required>
                <Select
                  value={form.bloodGroup}
                  onChange={(event) => setForm({ ...form, bloodGroup: event.target.value as BloodGroup })}
                >
                  {BLOOD_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {humanize(group)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Date of birth">
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
                />
              </FormField>
            </>
          ) : (
            <FormField label="Availability" full>
              <Select
                value={form.availability}
                onChange={(event) => setForm({ ...form, availability: event.target.value as DonorAvailability })}
              >
                {DONOR_AVAILABILITY.map((item) => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Address" full>
            <Input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </FormField>
          <FormField label="City">
            <Input
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </FormField>
          <FormField label="State">
            <Input
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value })}
            />
          </FormField>
          <FormField label="Preferred contact" full>
            <Input
              value={form.preferredContact}
              onChange={(event) => setForm({ ...form, preferredContact: event.target.value })}
            />
          </FormField>
        </div>
        {saveDonor.isError && (
          <div className="alert alert-danger" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Could not save donor: {getErrorMessage(saveDonor.error)}</span>
          </div>
        )}
        <p className="text-xs text-subtle cluster">
          <HeartHandshake size={13} aria-hidden="true" /> Consent and appointment records are managed from the donor
          drawer. {activeMembership ? `Active organization: ${activeMembership.organizationName}.` : ''}
        </p>
      </Modal>
    </div>
  );
}
