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
  Route,
  ScanLine,
  ShieldCheck,
  Siren,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react';

const howItWorks = [
  {
    title: 'Register your organization',
    text: 'Blood banks and hospitals create a verified profile that defines their service area and team.',
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

const faqs = [
  {
    question: 'Who is LifeLink for?',
    answer:
      'It is designed for blood banks and hospitals that need a shared, permission-aware record of donations, inventory, emergency requests, and dispatch.',
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
    question: 'How do I get access?',
    answer:
      'Accounts and demo credentials are provisioned by the backend seed and your administrator. The registration screen creates an account through the same API used by the application.',
  },
];

export function LandingPage() {
  return (
    <div className="marketing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Link to="/" className="brand" aria-label="LifeLink home" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-mark">
              <HeartPulse size={19} aria-hidden="true" />
            </span>
            <span className="brand-name">LifeLink</span>
          </Link>
          <nav className="marketing-nav" aria-label="Marketing navigation">
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
            <Link to="/login">Sign in</Link>
            <Link className="btn btn-primary btn-sm" to="/register">
              Get started <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="marketing-hero">
          <div className="marketing-container">
            <div>
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
                  Create your workspace <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="btn btn-secondary btn-lg" to="/login">
                  Sign in
                </Link>
              </div>
              <p className="hero-note">Access is provisioned by your organization administrator.</p>
            </div>

            <div className="product-preview" id="product" aria-label="Illustrative product preview">
              <div className="preview-bar">
                <i /><i /><i />
                <span>LifeLink · Workspace preview</span>
              </div>
              <div className="preview-body">
                <div className="preview-side" aria-hidden="true">
                  <div /><div /><div /><div /><div /><div />
                </div>
                <div className="preview-main">
                  <div className="preview-cards" aria-hidden="true">
                    <div className="preview-card">
                      <small>Inventory</small><strong>—</strong>
                    </div>
                    <div className="preview-card">
                      <small>Requests</small><strong>—</strong>
                    </div>
                    <div className="preview-card">
                      <small>Dispatch</small><strong>—</strong>
                    </div>
                  </div>
                  <div className="preview-row" aria-hidden="true"><i /><span /><span className="short" /></div>
                  <div className="preview-row" aria-hidden="true"><i /><span /><span className="short" /></div>
                  <div className="preview-row" aria-hidden="true"><i /><span /><span className="short" /></div>
                  <div className="preview-row" aria-hidden="true"><i /><span /><span className="short" /></div>
                  <div className="preview-row" aria-hidden="true"><i /><span /><span className="short" /></div>
                  <p className="text-xs text-subtle" style={{ marginTop: 12 }}>
                    Illustrative layout. Live values appear after you sign in.
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
            <div className="steps">
              {howItWorks.map((step) => (
                <article className="step" key={step.title}>
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
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon"><feature.icon size={20} aria-hidden="true" /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-container split-section">
            <div>
              <span className="eyebrow">Emergency coordination</span>
              <h2>Respond with shared context.</h2>
              <p className="section-heading" style={{ marginBottom: 0 }}>
                Emergency requests carry their required items, approval state, and event history. Authorized staff review
                candidate units, confirm allocations with an idempotency key, and move reservations into dispatch.
              </p>
              <ul className="check-list">
                <li><Check size={16} aria-hidden="true" /> Status-aware request and item review</li>
                <li><Check size={16} aria-hidden="true" /> Clearly labelled non-clinical suggestions</li>
                <li><Check size={16} aria-hidden="true" /> Reservation-to-dispatch traceability</li>
              </ul>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Siren size={20} aria-hidden="true" /></div>
              <h3>Coordinated response</h3>
              <p>
                Requests, allocations, reservations, and dispatch are distinct steps with explicit permissions. Each action
                stays attached to the same operational record.
              </p>
              <div className="notice-banner" style={{ marginBottom: 0, marginTop: 16 }}>
                <ShieldCheck size={17} aria-hidden="true" />
                <div><strong>Decision support only</strong>Suggestions never replace clinical verification.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section soft">
          <div className="marketing-container split-section">
            <div className="feature-card">
              <div className="feature-icon"><HeartHandshake size={20} aria-hidden="true" /></div>
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
            <div className="feature-grid">
              {trustFeatures.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon"><feature.icon size={20} aria-hidden="true" /></div>
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
                Each organization has its own profile, registration code, service area, and memberships. Administrators can
                review accounts and verify partner organizations.
              </p>
            </div>
            <div className="feature-grid">
              <article className="feature-card">
                <div className="feature-icon"><UserRoundPlus size={20} aria-hidden="true" /></div>
                <h3>Create a profile</h3>
                <p>Register a blood bank or hospital with contact details and location.</p>
              </article>
              <article className="feature-card">
                <div className="feature-icon"><UsersRound size={20} aria-hidden="true" /></div>
                <h3>Add your team</h3>
                <p>Memberships connect users to an organization and a role.</p>
              </article>
              <article className="feature-card">
                <div className="feature-icon"><ShieldCheck size={20} aria-hidden="true" /></div>
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
            <h2>Ready to coordinate your blood supply?</h2>
            <p>Sign in to your organization workspace or create an account through the API-backed registration flow.</p>
            <Link className="btn btn-primary btn-lg" to="/register">
              Get started <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-container">
          <div className="marketing-footer-grid">
            <div>
              <span className="brand-name">LifeLink</span>
              <p style={{ marginTop: 10, maxWidth: '38ch' }}>
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
                <li><Link to="/register">Register</Link></li>
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
