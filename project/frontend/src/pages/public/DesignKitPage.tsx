import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BloodDrop,
  CellField,
  Counter,
  LifelinePath,
  Magnetic,
  Reveal,
  Wordmark,
} from '@/components/brand';
import { RBC_COMPATIBILITY_NOTE } from '@/lib/bloodCompatibility';

/** Developer-only visual regression surface at /__kit. Not part of the product navigation. */
export function DesignKitPage() {
  return (
    <div className="design-kit">
      <header className="marketing-header">
        <div className="marketing-header-inner">
          <Wordmark inverse />
          <nav aria-label="Design kit">
            <Link to="/">Back to site</Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="design-kit__main">
        <section aria-labelledby="kit-title">
          <span className="hero-kicker">Developer preview</span>
          <h1 id="kit-title">The Lifeline design kit</h1>
          <p>Brand primitives, motion states and clinical boundary copy used by the product.</p>
        </section>

        <section aria-labelledby="kit-primitives">
          <h2 id="kit-primitives">Primitives</h2>
          <div className="design-kit__grid">
            <article><h3>Wordmark</h3><Wordmark /></article>
            <article><h3>Blood drop</h3><BloodDrop size={48} /></article>
            <article><h3>Cell field</h3><div className="design-kit__cell"><CellField dense /></div></article>
            <article><h3>Counter</h3><Counter value={64} /><span className="field-hint">matrix pairs</span></article>
          </div>
        </section>

        <section aria-labelledby="kit-lifeline">
          <h2 id="kit-lifeline">Lifeline path</h2>
          <div className="design-kit__path"><LifelinePath variant="hero" /></div>
          <div className="design-kit__path design-kit__path--status"><LifelinePath variant="status" /></div>
        </section>

        <section aria-labelledby="kit-motion">
          <h2 id="kit-motion">Motion</h2>
          <Reveal><p>Reveal on scroll</p></Reveal>
          <Magnetic>
            <Link className="btn btn-primary" to="/">
              Magnetic action <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Magnetic>
        </section>

        <section aria-labelledby="kit-copy">
          <h2 id="kit-copy">Clinical boundaries</h2>
          <p className="clinical-note">{RBC_COMPATIBILITY_NOTE}</p>
        </section>
      </main>
    </div>
  );
}
