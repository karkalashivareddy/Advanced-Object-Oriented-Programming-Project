import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Lenis from 'lenis';
import {
  ArrowRight,
  Boxes,
  Check,
  ClipboardCheck,
  Clock3,
  Droplets,
  EyeOff,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  MapPin,
  Menu,
  Route,
  ScanLine,
  ShieldCheck,
  Siren,
  Truck,
  UsersRound,
  X,
} from 'lucide-react';
import {
  BloodstreamVisual,
  CellField,
  JourneyVessel,
  LifelinePath,
  Wordmark,
  type JourneyStage,
} from '@/components/brand';
import { Picture } from '@/components/ui';
import {
  Counter,
  CursorHalo,
  Magnetic,
  OffscreenMotionPause,
  Reveal,
  ScrollProgress,
  SplitText,
  Stagger,
} from '@/components/motion';
import {
  formatBloodGroup,
  getCompatibleDonorCount,
  getRbcCompatibility,
  getRbcMatrix,
  RBC_COMPATIBILITY_NOTE,
  type RbcGroup,
} from '@/lib/bloodCompatibility';
import { BLOOD_GROUPS } from '@/lib/constants';
import { prefersReducedMotion } from '@/lib/motion';

const NEARBY_DISCOVERY_NOTE =
  'Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.';

const journeyStages: JourneyStage[] = [
  {
    label: 'Donate',
    detail: 'A donor profile and consent record anchor the donation.',
    icon: HeartHandshake,
  },
  {
    label: 'Screen',
    detail: 'Authorized staff record screening results before approval.',
    icon: ClipboardCheck,
  },
  {
    label: 'Store',
    detail: 'Each approved unit receives its own identifier and status history.',
    icon: Boxes,
  },
  {
    label: 'Request',
    detail: 'A hospital raises a time-bound emergency request.',
    icon: Siren,
  },
  {
    label: 'Reserve',
    detail: 'Eligible units are matched, reviewed, and reserved with an idempotency key.',
    icon: Route,
  },
  {
    label: 'Deliver',
    detail: 'Dispatch records the handover from departure to delivery.',
    icon: Truck,
  },
];

const inventoryFeatures = [
  {
    icon: ScanLine,
    title: 'Traceable units',
    text: 'Every unit carries its own identifier, blood group, component, location, and status history.',
  },
  {
    icon: Clock3,
    title: 'Expiry awareness',
    text: 'Filters and alerts surface units approaching expiry before they become unusable.',
  },
  {
    icon: Boxes,
    title: 'Controlled transitions',
    text: 'Release, adjustment, expiry, and movement actions are permission-gated and recorded.',
  },
];

const trustFeatures = [
  {
    icon: LockKeyhole,
    title: 'Token-based sessions',
    text: 'Short-lived bearer tokens and rotating refresh tokens limit the blast radius of a compromised session.',
  },
  {
    icon: ShieldCheck,
    title: 'Role and permission checks',
    text: 'Fine-grained permissions and organization scoping shape what each user can see and do. The server remains authoritative.',
  },
  {
    icon: ClipboardCheck,
    title: 'Auditable workflows',
    text: 'Audit records and correlation identifiers support investigation of inventory and dispatch actions.',
  },
  {
    icon: Route,
    title: 'Idempotent critical actions',
    text: 'Reservations, allocation confirmations, and dispatch creation accept idempotency keys to reduce duplicate side effects.',
  },
];

const trustDimensions = [
  { label: 'Authorization', value: 'Server-side', detail: 'The API enforces access on every request.' },
  { label: 'Data scope', value: 'Organization', detail: 'Memberships define what a user can see.' },
  { label: 'Critical actions', value: 'Idempotent', detail: 'Keys reduce duplicate reservations and dispatches.' },
  { label: 'Investigation', value: 'Auditable', detail: 'Correlation IDs connect actions to records.' },
];

const heroAssurances = [
  { icon: ShieldCheck, text: 'Permission-aware by design' },
  { icon: ScanLine, text: 'Unit-level traceability' },
  { icon: Route, text: 'Idempotent handoffs' },
  { icon: ClipboardCheck, text: 'Auditable actions' },
];

const privacyPoints = [
  {
    icon: EyeOff,
    title: 'No exact donor coordinates',
    text: 'The API returns a coarse distance band, never a donor’s precise location.',
  },
  {
    icon: LockKeyhole,
    title: 'Consent and recency are required',
    text: 'Search only considers available donors with current consent and a recent location update.',
  },
  {
    icon: MapPin,
    title: 'Your origin stays with the request',
    text: 'The coordinates you enter are sent to the LifeLink API for the search and are not published on this page.',
  },
];

const faqs = [
  {
    question: 'Who is LifeLink for?',
    answer:
      'It is designed for blood banks and hospitals that need a shared, permission-aware record of donations, inventory, emergency requests, and dispatch. Donors can review their own profile, appointments, and donations.',
  },
  {
    question: 'Does LifeLink make clinical decisions?',
    answer:
      'No. Allocation suggestions are labelled as non-clinical decision support. Qualified staff must verify compatibility and make every clinical judgement.',
  },
  {
    question: 'How is organization data separated?',
    answer:
      'Accounts belong to organizations through memberships, and the API applies organization scoping. The UI also offers an organization switcher for users with more than one membership.',
  },
  {
    question: 'Can I register my hospital or blood bank here?',
    answer:
      'Self-registration creates a donor account. An administrator creates and verifies organization profiles, then adds staff memberships with the appropriate role.',
  },
  {
    question: 'How do I get staff access?',
    answer:
      'Use the sign-in screen with credentials provisioned by your organization administrator. If you are a donor, the registration screen creates your account through the same API used by the application.',
  },
];

const marketingLinks = [
  { label: 'Journey', href: '#journey' },
  { label: 'Atlas', href: '#compatibility' },
  { label: 'Platform', href: '#platform' },
  { label: 'Community', href: '#community' },
  { label: 'Safety', href: '#security' },
  { label: 'FAQ', href: '#faq' },
];

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [recipient, setRecipient] = useState<RbcGroup>('O_POSITIVE');
  const [selectedDonor, setSelectedDonor] = useState<RbcGroup>('O_POSITIVE');
  const closeMenu = () => setMobileOpen(false);
  const matrix = useMemo(() => getRbcMatrix(recipient), [recipient]);
  const compatibleCount = getCompatibleDonorCount(recipient);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.9 });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="marketing bloodstream-page">
      <ScrollProgress />
      <CursorHalo />
      <div className="landing-ambient" aria-hidden="true">
        <span className="landing-ambient__wash" />
        <span className="landing-ambient__thread" />
      </div>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Wordmark to="/" inverse />
          <nav className="marketing-nav" aria-label="Primary navigation">
            {marketingLinks.map((link) => (
              <a href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
            <Link to="/login">Sign in</Link>
            <Link className="btn btn-primary btn-sm" to="/register">
              Create account <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
          <button
            type="button"
            className="btn btn-ghost btn-icon mobile-menu-button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="marketing-mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
        {mobileOpen && (
          <nav className="marketing-mobile-nav cluster" id="marketing-mobile-nav" aria-label="Mobile navigation">
            {marketingLinks.map((link) => (
              <a href={link.href} key={link.label} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
            <Link to="/login" onClick={closeMenu}>
              Sign in
            </Link>
            <Link className="btn btn-primary btn-sm" to="/register" onClick={closeMenu}>
              Create account <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section className="marketing-hero bloodstream-hero" aria-labelledby="hero-title">
          <div className="marketing-container hero-grid">
            <div className="hero-copy ll-enter">
              <span className="hero-kicker">
                <span className="hero-kicker__dot" aria-hidden="true" />
                The living blood network
              </span>
              <h1 className="hero-title" id="hero-title">
                <SplitText text="Every Drop Has a Destination." accentWord="Destination." />
              </h1>
              <p className="hero-lede">
                Connecting donors, hospitals and blood banks through one intelligent lifeline. Because when
                every second matters, every connection counts.
              </p>
              <div className="hero-actions">
                <Magnetic>
                  <Link className="btn btn-primary btn-lg" to="/login">
                    Find Blood <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </Magnetic>
                <Link className="btn btn-secondary btn-lg" to="/register">
                  Become a Donor
                </Link>
              </div>
              <Stagger className="hero-proof" itemClassName="hero-proof__item" gap="tight">
                {heroAssurances.map(({ icon: Icon, text }) => (
                  <span key={text}>
                    <Icon size={13} aria-hidden="true" /> {text}
                  </span>
                ))}
              </Stagger>
            </div>

            <div className="hero-visual ll-enter" style={{ animationDelay: '90ms' }}>
              <OffscreenMotionPause className="hero-motion-boundary">
                <div className="hero-vessel-card" id="product">
                <BloodstreamVisual label="Illustrative animated blood vessel with red blood cells moving from donor to delivery" />
                <CellField dense />
                <LifelinePath variant="hero" />
                <span className="hero-visual-index" aria-hidden="true">LL / 001 — donor to delivery</span>
                <div className="hero-vessel-card__top">
                  <span className="vessel-pill">
                    <span className="live-dot" aria-hidden="true" /> Journey in motion
                  </span>
                  <span className="vessel-pill vessel-pill--muted">Illustrative</span>
                </div>
                <div className="hero-vessel-card__panel">
                  <span className="metric-label">One continuous thread</span>
                  <div className="vessel-milestones" aria-label="Illustrative journey milestones">
                    <span>Donor</span>
                    <i aria-hidden="true" />
                    <span>Screened</span>
                    <i aria-hidden="true" />
                    <span>Reserved</span>
                    <i aria-hidden="true" />
                    <span>Delivered</span>
                  </div>
                  <p className="freshness">Visual story only · not live supply data</p>
                </div>
                </div>
              </OffscreenMotionPause>
            </div>
          </div>
        </section>

        <section className="network-signal" aria-label="Illustrative continuous donor-to-delivery lifeline">
          <div className="network-signal__inner">
            <span className="network-signal__label">One record · one thread</span>
            <LifelinePath variant="divider" className="network-signal__path" />
            <span className="network-signal__code">Illustrative · not live supply data</span>
          </div>
        </section>

        <section className="marketing-section journey-section" id="journey" aria-labelledby="journey-title">
          <div className="marketing-container">
            <Reveal>
              <div className="chapter-rail">01 / The continuum</div>
              <div className="section-heading">
                <span className="eyebrow"><HeartPulse size={13} aria-hidden="true" /> Donor to delivery</span>
                <h2 id="journey-title">From one generous decision to one careful delivery.</h2>
                <p>
                  Each stage creates the evidence the next stage needs. Teams see the same history instead of
                  reconstructing it from separate systems.
                </p>
              </div>
            </Reveal>
            <JourneyVessel stages={journeyStages} />
          </div>
        </section>

        <section className="marketing-section compat-section" id="compatibility" aria-labelledby="compatibility-title">
          <div className="marketing-container">
            <Reveal>
              <div className="chapter-rail">02 / Compatibility atlas</div>
              <div className="section-heading">
                <span className="eyebrow"><Droplets size={13} aria-hidden="true" /> Red-cell teaching matrix</span>
                <h2 id="compatibility-title">See the boundaries before you make the decision.</h2>
                <p>
                  Explore all 64 red-cell recipient and donor combinations. This is an educational view of one
                  rule set, not a compatibility check and not a substitute for clinical crossmatching.
                </p>
              </div>
            </Reveal>

            <div className="blood-explorer">
              <div className="blood-explorer__toolbar">
                <div>
                  <span className="field-label">Recipient red-cell group</span>
                  <div className="orb-row" role="group" aria-label="Choose a recipient blood group">
                    {BLOOD_GROUPS.map((group) => (
                      <button
                        key={group}
                        type="button"
                        className="blood-orb blood-orb--select"
                        data-selected={group === recipient}
                        aria-pressed={group === recipient}
                        onClick={() => setRecipient(group)}
                      >
                        <span className="blood-orb__core" aria-hidden="true" />
                        <span className="blood-orb__label">{formatBloodGroup(group)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="compat-summary" role="status">
                  <Counter value={compatibleCount} />
                  <span>compatible donor groups for {formatBloodGroup(recipient)} recipients</span>
                </div>
              </div>

              <div className="blood-explorer__stage">
                <div>
                  <span className="field-label">Donor groups · illustrative</span>
                  <div className="orb-row orb-row--donors" aria-label="Illustrative donor compatibility">
                    {matrix.map((row) => {
                      const selected = row.donor === selectedDonor;
                      return (
                        <button
                          key={row.donor}
                          type="button"
                          className="blood-orb blood-orb--donor"
                          data-compatible={row.compatibility.compatible}
                          data-selected={selected}
                          aria-pressed={selected}
                          onClick={() => setSelectedDonor(row.donor)}
                        >
                          <span className="blood-orb__core" aria-hidden="true" />
                          <span className="blood-orb__label">{formatBloodGroup(row.donor)}</span>
                          <span className="blood-orb__status">
                            {row.compatibility.compatible ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
                            {row.compatibility.compatible ? 'Compatible' : 'Not compatible'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <aside className="blood-explorer__detail" aria-live="polite">
                  <span className="eyebrow eyebrow--chip">Selected pair</span>
                  <h3>{formatBloodGroup(recipient)} ← {formatBloodGroup(selectedDonor)}</h3>
                  <p>{getRbcCompatibility(recipient, selectedDonor).explanation}</p>
                  <p className="freshness">Illustrative · not a clinical compatibility check</p>
                </aside>
              </div>

              <details className="compat-table-fallback">
                <summary>View all eight donor results as a text table</summary>
                <div className="compat-matrix-wrap">
                  <table className="compat-table">
                    <caption>
                      Illustrative red-cell donor groups for {formatBloodGroup(recipient)} recipients. Change the
                      recipient group to explore every pair in the matrix.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Donor group</th>
                        <th scope="col">Compatibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row) => (
                        <tr key={row.donor}>
                          <th scope="row">{formatBloodGroup(row.donor)}</th>
                          <td>
                            <span className={row.compatibility.compatible ? 'compat-cell compat-cell--yes' : 'compat-cell compat-cell--no'}>
                              {row.compatibility.compatible ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                              {row.compatibility.compatible ? 'Compatible' : 'Not compatible'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="clinical-note">
                <ClipboardCheck size={17} aria-hidden="true" />
                <span>{RBC_COMPATIBILITY_NOTE}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="marketing-section soft" id="platform" aria-labelledby="platform-title">
          <div className="marketing-container">
            <Reveal>
              <div className="chapter-rail">03 / Inventory with memory</div>
              <div className="section-heading">
                <span className="eyebrow"><Boxes size={13} aria-hidden="true" /> The platform</span>
                <h2 id="platform-title">Know what you have, where it is, and when it expires.</h2>
                <p>
                  A unit is never just a number. Its blood group, component, storage location, status changes,
                  and linked donation remain connected throughout its life.
                </p>
              </div>
            </Reveal>
            <div className="feature-grid">
              {inventoryFeatures.map((feature) => (
                <article className="feature-card surface" key={feature.title}>
                  <div className="task-icon"><feature.icon size={20} aria-hidden="true" /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="emergency-title">
          <div className="marketing-container split-section split-layout">
            <Reveal>
              <div className="chapter-rail">04 / Emergency coordination</div>
              <span className="eyebrow"><Siren size={13} aria-hidden="true" /> Shared context</span>
              <h2 id="emergency-title">Respond with the same record, not a different spreadsheet.</h2>
              <p className="page-subtitle">
                Emergency requests carry their required items, approval state, and event history. Authorized
                staff review candidate units, confirm allocations with an idempotency key, and move
                reservations into dispatch.
              </p>
              <ul className="check-list">
                <li><Check size={16} aria-hidden="true" /> Status-aware request and item review</li>
                <li><Check size={16} aria-hidden="true" /> Clearly labelled non-clinical suggestions</li>
                <li><Check size={16} aria-hidden="true" /> Reservation-to-dispatch traceability</li>
              </ul>
            </Reveal>
            <Reveal delay={80}>
              <div className="feature-card surface-raised">
                <div className="task-icon"><Siren size={20} aria-hidden="true" /></div>
                <h3>Coordinated response</h3>
                <p>
                  Requests, allocations, reservations, and dispatch are distinct steps with explicit
                  permissions. Each action stays attached to the same operational record.
                </p>
                <Picture
                  asset="emergency-handoff"
                  decorative
                  sizes="(max-width: 640px) 100vw, 360px"
                  pictureClassName="responsive-picture--inset"
                />
                <div className="alert alert-info">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <div><strong>Decision support only</strong>Suggestions never replace clinical verification.</div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="marketing-section privacy-section" aria-labelledby="privacy-title">
          <div className="marketing-container privacy-grid">
            <Reveal>
              <div className="privacy-visual">
                <Picture
                  asset="privacy-rings"
                  decorative
                  sizes="(max-width: 720px) 100vw, 480px"
                  pictureClassName="responsive-picture--cover"
                />
                <span className="privacy-ring privacy-ring--outer" aria-hidden="true" />
                <span className="privacy-ring privacy-ring--middle" aria-hidden="true" />
                <span className="privacy-ring privacy-ring--inner" aria-hidden="true" />
                <span className="privacy-cell privacy-cell--one" aria-hidden="true" />
                <span className="privacy-cell privacy-cell--two" aria-hidden="true" />
                <span className="privacy-cell privacy-cell--three" aria-hidden="true" />
                <span className="privacy-origin" aria-hidden="true"><MapPin size={18} /></span>
                <span className="privacy-visual-label">Approximate bands · exact coordinates withheld</span>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="chapter-rail">05 / Privacy by boundary</div>
              <span className="eyebrow"><EyeOff size={13} aria-hidden="true" /> Donor discovery</span>
              <h2 id="privacy-title">Find a lead without exposing a person.</h2>
              <p className="page-subtitle">
                Nearby donor discovery returns consenting, available donors as distance bands. It never returns
                exact coordinates or contact details, and every result remains an operational lead.
              </p>
              <ul className="privacy-list">
                {privacyPoints.map(({ icon: Icon, title, text }) => (
                  <li key={title}>
                    <Icon size={17} aria-hidden="true" />
                    <span><strong>{title}</strong>{text}</span>
                  </li>
                ))}
              </ul>
              <p className="clinical-note">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>{NEARBY_DISCOVERY_NOTE}</span>
              </p>
            </Reveal>
          </div>
        </section>

        <section className="marketing-section" id="security" aria-labelledby="security-title">
          <div className="marketing-container">
            <Reveal>
              <div className="chapter-rail">06 / Trust enforced in the system</div>
              <div className="section-heading">
                <span className="eyebrow"><LockKeyhole size={13} aria-hidden="true" /> Safety by design</span>
                <h2 id="security-title">The interface guides you. The API decides.</h2>
                <p>
                  The SPA hides actions you cannot perform, but the API independently enforces authorization
                  and organization scope on every request.
                </p>
              </div>
            </Reveal>
            <div className="metric-grid">
              {trustDimensions.map((dimension) => (
                <article className="metric-card surface" key={dimension.label}>
                  <span className="metric-label">{dimension.label}</span>
                  <strong className="metric-value">{dimension.value}</strong>
                  <span className="metric-delta">{dimension.detail}</span>
                </article>
              ))}
            </div>
            <div className="feature-grid">
              {trustFeatures.map((feature) => (
                <article className="feature-card surface" key={feature.title}>
                  <div className="task-icon"><feature.icon size={20} aria-hidden="true" /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section community-section" id="community" aria-labelledby="community-title">
          <div className="marketing-container">
            <Reveal>
              <div className="chapter-rail">07 / One network, clear roles</div>
              <div className="section-heading">
                <span className="eyebrow"><HeartHandshake size={13} aria-hidden="true" /> Community of care</span>
                <h2 id="community-title">Donors, banks and hospitals on the same thread.</h2>
                <p>
                  Each participant joins through a deliberate path. Donors create their own accounts.
                  Administrators create organization profiles and memberships. The API applies the resulting
                  permissions and organization scope on every request.
                </p>
              </div>
            </Reveal>
            <Stagger className="feature-grid" itemClassName="feature-card surface" gap="base">
              <div>
                <span className="task-icon"><HeartHandshake size={20} aria-hidden="true" /></span>
                <h3>Donors register themselves</h3>
                <p>Registration creates a donor account through the same API used by the application.</p>
              </div>
              <div>
                <span className="task-icon"><UsersRound size={20} aria-hidden="true" /></span>
                <h3>Organizations are provisioned</h3>
                <p>An administrator creates the blood bank or hospital profile, then adds staff memberships and roles.</p>
              </div>
              <div>
                <span className="task-icon"><ShieldCheck size={20} aria-hidden="true" /></span>
                <h3>Access stays scoped</h3>
                <p>The interface reflects permissions, while the API independently enforces them on every request.</p>
              </div>
            </Stagger>
          </div>
        </section>

        <section className="marketing-section soft" aria-labelledby="onboarding-title">
          <div className="marketing-container">
            <Reveal>
              <div className="chapter-rail">08 / Organization onboarding</div>
              <div className="section-heading">
                <span className="eyebrow"><UsersRound size={13} aria-hidden="true" /> Built for teams</span>
                <h2 id="onboarding-title">Built for blood banks and hospitals.</h2>
                <p>
                  Administrators create each organization profile with its registration code, service area,
                  and memberships. Verification and staff access are managed separately from donor
                  self-registration.
                </p>
              </div>
            </Reveal>
            <div className="feature-grid">
              <article className="feature-card surface">
                <div className="task-icon"><ShieldCheck size={20} aria-hidden="true" /></div>
                <h3>Administrator-created profile</h3>
                <p>An administrator registers a blood bank or hospital with contact details and location.</p>
              </article>
              <article className="feature-card surface">
                <div className="task-icon"><UsersRound size={20} aria-hidden="true" /></div>
                <h3>Add your team</h3>
                <p>Memberships connect existing accounts to an organization and a role.</p>
              </article>
              <article className="feature-card surface">
                <div className="task-icon"><ClipboardCheck size={20} aria-hidden="true" /></div>
                <h3>Verify and operate</h3>
                <p>Administrators verify the organization before day-to-day use.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="faq" aria-labelledby="faq-title">
          <div className="marketing-container">
            <Reveal>
              <div className="chapter-rail">09 / Common questions</div>
              <div className="section-heading">
                <span className="eyebrow"><HeartHandshake size={13} aria-hidden="true" /> FAQ</span>
                <h2 id="faq-title">Clear answers before you begin.</h2>
              </div>
            </Reveal>
            <div className="faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-cta bloodstream-cta" aria-labelledby="cta-title">
          <OffscreenMotionPause className="cta-motion-boundary">
            <CellField />
            <LifelinePath variant="hero" />
          </OffscreenMotionPause>
          <div className="marketing-container">
            <span className="eyebrow">10 / Get started</span>
            <h2 id="cta-title">Keep every drop connected to a decision.</h2>
            <p>
              Sign in to your organization workspace or create a donor account through the API-backed
              registration flow.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/login">
                Find Blood <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/register">
                Become a Donor
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-container">
          <div className="marketing-footer-grid">
            <div>
              <Wordmark inverse />
              <p>Coordinated blood inventory and emergency response for healthcare organizations.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#journey">Journey</a></li>
                <li><a href="#compatibility">Atlas</a></li>
                <li><a href="#platform">Platform</a></li>
                <li><a href="#community">Community</a></li>
                <li><a href="#security">Security</a></li>
              </ul>
            </div>
            <div>
              <h4>Account</h4>
              <ul>
                <li><Link to="/login">Sign in</Link></li>
                <li><Link to="/register">Create account</Link></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
          </div>
          <p className="footer-bottom">
            LifeLink · Advanced Object-Oriented Programming course project. Illustrative visuals only.
          </p>
        </div>
      </footer>
    </div>
  );
}
