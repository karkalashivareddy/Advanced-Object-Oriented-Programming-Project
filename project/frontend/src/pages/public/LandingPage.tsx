import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  Boxes,
  Check,
  ClipboardCheck,
  Clock3,
  HeartHandshake,
  HeartPulse,
  LockKeyhole,
  Menu,
  Route,
  ScanLine,
  ShieldCheck,
  Siren,
  UsersRound,
  X,
} from 'lucide-react';

const howItWorks = [
  {
    title: 'Start with an account',
    text: 'Self-registration creates a donor account. Organization profiles and staff memberships are assigned by an administrator.',
  },
  {
    title: 'Capture donations and inventory',
    text: 'Record donor consent, screening outcomes, and each blood unit through its storage lifecycle.',
  },
  {
    title: 'Coordinate an emergency',
    text: 'Raise a request, review eligible units, and reserve stock with idempotent, auditable actions.',
  },
  {
    title: 'Dispatch and reconcile',
    text: 'Move a confirmed reservation through departure and delivery, with incidents recorded in context.',
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

const trustMetrics = [
  { label: 'Authorization', value: 'Server-side', detail: 'The API enforces access on every request.' },
  { label: 'Data scope', value: 'Organization', detail: 'Memberships define what a user can see.' },
  { label: 'Critical actions', value: 'Idempotent', detail: 'Keys reduce duplicate reservations and dispatches.' },
  { label: 'Investigation', value: 'Auditable', detail: 'Correlation IDs connect actions to records.' },
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
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
  { label: 'FAQ', href: '#faq' },
];

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = () => setMobileOpen(false);

  return (
    <div className="marketing">
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
        <section className="marketing-hero">
          <div className="marketing-container">
            <div className="page-enter">
              <span className="eyebrow">
                <HeartPulse size={14} aria-hidden="true" /> Blood supply coordination
              </span>
              <h1>
                A calmer path from <span>donor</span> to delivery.
              </h1>
              <p className="hero-lede">
                LifeLink brings donor records, blood inventory, emergency requests, and dispatch into one
                permission-aware workspace for blood banks and hospitals.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary btn-lg" to="/register">
                  Create account <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="btn btn-secondary btn-lg" to="/login">
                  Sign in
                </Link>
              </div>
              <p className="hero-note">Donors can self-register. Staff access is provisioned by an organization administrator.</p>
            </div>

            <div className="hero-visual surface-glass surface-raised stagger-1" id="product" aria-label="Illustrative product preview">
              <div className="preview-bar">
                <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
                <span>LifeLink · Workspace example</span>
              </div>
              <div className="preview-body">
                <div className="preview-side" aria-hidden="true">
                  <div /><div /><div /><div /><div /><div />
                </div>
                <div className="preview-main">
                  <div className="preview-cards" aria-hidden="true">
                    <div className="preview-card">
                      <small>Available units</small><strong>Example</strong>
                    </div>
                    <div className="preview-card">
                      <small>Open requests</small><strong>Example</strong>
                    </div>
                    <div className="preview-card">
                      <small>In transit</small><strong>Example</strong>
                    </div>
                  </div>
                  <div className="preview-row" aria-hidden="true"><i /><span>O- · red cells</span><span className="short">AVAILABLE</span></div>
                  <div className="preview-row" aria-hidden="true"><i /><span>Request RQ-1042</span><span className="short">CRITICAL</span></div>
                  <div className="preview-row" aria-hidden="true"><i /><span>Unit U-2081</span><span className="short">EXPIRES SOON</span></div>
                  <div className="preview-row" aria-hidden="true"><i /><span>Dispatch D-318</span><span className="short">IN_TRANSIT</span></div>
                  <p className="freshness">
                    Illustrative example records, not live data. Real values appear after sign-in.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="how-it-works">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">How it works</span>
              <h2>One workflow, from intake to handover.</h2>
              <p>Each step builds on the last so teams share the same record of what happened and why.</p>
            </div>
            <div className="step-grid">
              {howItWorks.map((step, index) => (
                <article className="step surface surface-interactive" key={step.title}>
                  <span className="metric-label">Step {index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section soft">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">Inventory overview</span>
              <h2>Know what you have, where it is, and when it expires.</h2>
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

        <section className="marketing-section">
          <div className="marketing-container split-section split-layout">
            <div>
              <span className="eyebrow">Emergency coordination</span>
              <h2>Respond with shared context.</h2>
              <p className="page-subtitle">
                Emergency requests carry their required items, approval state, and event history. Authorized staff review
                candidate units, confirm allocations with an idempotency key, and move reservations into dispatch.
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
                Requests, allocations, reservations, and dispatch are distinct steps with explicit permissions. Each action
                stays attached to the same operational record.
              </p>
              <div className="alert alert-info">
                <ShieldCheck size={17} aria-hidden="true" />
                <div><strong>Decision support only</strong>Suggestions never replace clinical verification.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section soft">
          <div className="marketing-container split-section split-layout">
            <div className="feature-card surface">
              <div className="task-icon"><HeartHandshake size={20} aria-hidden="true" /></div>
              <h3>Donor participation</h3>
              <p>
                Donor profiles, consent records, and appointment requests live beside the donations and units they produce.
                Staff review screening and approve eligible donations before units enter inventory.
              </p>
            </div>
            <div>
              <span className="eyebrow">For donors and staff</span>
              <h2>Consent and continuity, built in.</h2>
              <ul className="check-list">
                <li><UsersRound size={16} aria-hidden="true" /> Donor profiles with contact details and blood group</li>
                <li><ClipboardCheck size={16} aria-hidden="true" /> Consent records attached to each donor</li>
                <li><BellRing size={16} aria-hidden="true" /> Appointment requests with staff review</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="security">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">Trust and security</span>
              <h2>Safety is enforced in the system, not just the interface.</h2>
              <p>
                The SPA hides actions you cannot perform, but the API independently enforces authorization and organization
                scope on every request.
              </p>
            </div>
            <div className="metric-grid">
              {trustMetrics.map((metric) => (
                <article className="metric-card surface" key={metric.label}>
                  <span className="metric-label">{metric.label}</span>
                  <strong className="metric-value">{metric.value}</strong>
                  <span className="metric-delta">{metric.detail}</span>
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

        <section className="marketing-section soft">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">Organization onboarding</span>
              <h2>Built for blood banks and hospitals.</h2>
              <p>
                Administrators create each organization profile with its registration code, service area, and memberships.
                Verification and staff access are managed separately from donor self-registration.
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

        <section className="marketing-section" id="faq">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="eyebrow">FAQ</span>
              <h2>Common questions</h2>
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

        <section className="marketing-cta">
          <div className="marketing-container">
            <span className="eyebrow">Get started</span>
            <h2>Ready to coordinate your blood supply?</h2>
            <p>Sign in to your organization workspace or create a donor account through the API-backed registration flow.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/register">
                Create account <ArrowRight size={17} aria-hidden="true" />
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
              <p>
                Coordinated blood inventory and emergency response for healthcare organizations.
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#product">Preview</a></li>
                <li><a href="#how-it-works">Workflow</a></li>
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
          <p className="footer-bottom">LifeLink · Advanced Object-Oriented Programming course project.</p>
        </div>
      </footer>
    </div>
  );
}
