import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  Boxes,
  Check,
  ClipboardCheck,
  Clock3,
  Droplets,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  Menu,
  Route,
  ScanLine,
  ShieldCheck,
  Siren,
  Truck,
  UsersRound,
  X,
} from 'lucide-react';
import { BloodstreamVisual } from '@/components/brand/BloodstreamVisual';
import { JourneyVessel, type JourneyStage } from '@/components/brand/JourneyVessel';

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
  {
    label: 'Authorization',
    value: 'Server-side',
    detail: 'The API enforces access on every request.',
  },
  {
    label: 'Data scope',
    value: 'Organization',
    detail: 'Memberships define what a user can see.',
  },
  {
    label: 'Critical actions',
    value: 'Idempotent',
    detail: 'Keys reduce duplicate reservations and dispatches.',
  },
  {
    label: 'Investigation',
    value: 'Auditable',
    detail: 'Correlation IDs connect actions to records.',
  },
];

const heroAssurances = [
  { icon: ShieldCheck, text: 'Permission-aware by design' },
  { icon: ScanLine, text: 'Unit-level traceability' },
  { icon: Route, text: 'Idempotent handoffs' },
  { icon: ClipboardCheck, text: 'Auditable actions' },
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
  { label: 'Platform', href: '#platform' },
  { label: 'Security', href: '#security' },
  { label: 'FAQ', href: '#faq' },
];

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = () => setMobileOpen(false);

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
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Link to="/" className="brand" aria-label="LifeLink home">
            <span className="brand-mark">
              <HeartPulse size={19} aria-hidden="true" />
            </span>
            <span className="brand-name">LifeLink</span>
            <span className="brand-tagline">BLOOD NETWORK</span>
          </Link>
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
          <nav className="cluster marketing-container" id="marketing-mobile-nav" aria-label="Mobile navigation">
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
          <div className="marketing-container">
            <div className="page-enter">
              <span className="eyebrow">
                <Droplets size={14} aria-hidden="true" /> Donor to delivery, one record
              </span>
              <h1 id="hero-title">
                Every drop has a <span>journey.</span>
              </h1>
              <p className="hero-lede">
                LifeLink connects donor records, blood inventory, emergency requests, and dispatch in one
                permission-aware workspace. Every handoff stays attached to the same unit, the same request,
                and the same accountable team.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary btn-lg" to="/register">
                  Create donor account <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="btn btn-secondary btn-lg" to="/login">
                  Sign in to workspace
                </Link>
              </div>
              <p className="hero-note">
                Donors self-register. Staff access is provisioned by an organization administrator.
              </p>
              <ul className="hero-assurances" aria-label="Platform safeguards">
                {heroAssurances.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <Icon size={14} aria-hidden="true" /> {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="hero-vessel-card page-enter stagger-1" id="product">
              <BloodstreamVisual label="Illustrative animated blood vessel with red blood cells moving from donor to delivery" />
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
          </div>
        </section>

        <section className="marketing-section journey-section" id="journey" aria-labelledby="journey-title">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">The donor-to-delivery journey</span>
              <h2 id="journey-title">From one generous decision to one careful delivery.</h2>
              <p>
                Each stage creates the evidence the next stage needs. Teams see the same history instead of
                reconstructing it from separate systems.
              </p>
            </div>
            <JourneyVessel stages={journeyStages} />
          </div>
        </section>

        <section className="marketing-section soft" id="platform" aria-labelledby="platform-title">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">Inventory with memory</span>
              <h2 id="platform-title">Know what you have, where it is, and when it expires.</h2>
              <p>
                A unit is never just a number. Its blood group, component, storage location, status changes,
                and linked donation remain connected throughout its life.
              </p>
            </div>
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
            <div>
              <span className="eyebrow">Emergency coordination</span>
              <h2 id="emergency-title">Respond with shared context.</h2>
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
            </div>
            <div className="feature-card surface-raised">
              <div className="task-icon"><Siren size={20} aria-hidden="true" /></div>
              <h3>Coordinated response</h3>
              <p>
                Requests, allocations, reservations, and dispatch are distinct steps with explicit
                permissions. Each action stays attached to the same operational record.
              </p>
              <div className="alert alert-info">
                <ShieldCheck size={17} aria-hidden="true" />
                <div><strong>Decision support only</strong>Suggestions never replace clinical verification.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section soft" aria-labelledby="donor-title">
          <div className="marketing-container split-section split-layout">
            <div className="feature-card surface">
              <div className="task-icon"><HeartHandshake size={20} aria-hidden="true" /></div>
              <h3>Donor participation</h3>
              <p>
                Donor profiles, consent records, and appointment requests live beside the donations and
                units they produce. Staff review screening and approve eligible donations before units
                enter inventory.
              </p>
            </div>
            <div>
              <span className="eyebrow">For donors and staff</span>
              <h2 id="donor-title">Consent and continuity, built in.</h2>
              <ul className="check-list">
                <li><UsersRound size={16} aria-hidden="true" /> Donor profiles with contact details and blood group</li>
                <li><ClipboardCheck size={16} aria-hidden="true" /> Consent records attached to each donor</li>
                <li><BellRing size={16} aria-hidden="true" /> Appointment requests with staff review</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="security" aria-labelledby="security-title">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">Trust and security</span>
              <h2 id="security-title">Safety is enforced in the system, not just the interface.</h2>
              <p>
                The SPA hides actions you cannot perform, but the API independently enforces authorization
                and organization scope on every request.
              </p>
            </div>
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

        <section className="marketing-section soft" aria-labelledby="onboarding-title">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">Organization onboarding</span>
              <h2 id="onboarding-title">Built for blood banks and hospitals.</h2>
              <p>
                Administrators create each organization profile with its registration code, service area,
                and memberships. Verification and staff access are managed separately from donor
                self-registration.
              </p>
            </div>
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
            <div className="section-heading">
              <span className="eyebrow">FAQ</span>
              <h2 id="faq-title">Common questions</h2>
            </div>
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
          <BloodstreamVisual />
          <div className="marketing-container">
            <span className="eyebrow">Get started</span>
            <h2 id="cta-title">Keep every drop connected to a decision.</h2>
            <p>
              Sign in to your organization workspace or create a donor account through the API-backed
              registration flow.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/register">
                Create donor account <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/login">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-container">
          <div className="marketing-footer-grid">
            <div>
              <span className="brand-name">LifeLink</span>
              <p>Coordinated blood inventory and emergency response for healthcare organizations.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#journey">Journey</a></li>
                <li><a href="#platform">Platform</a></li>
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
