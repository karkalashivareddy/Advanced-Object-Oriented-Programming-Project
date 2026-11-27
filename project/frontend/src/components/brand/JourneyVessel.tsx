import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/motion';

export type JourneyStage = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

type JourneyVesselProps = {
  stages: JourneyStage[];
};

/** Accessible donor-to-delivery sequence styled as a single continuous vessel. */
export function JourneyVessel({ stages }: JourneyVesselProps) {
  const [activeStage, setActiveStage] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const manualUntil = useRef(0);
  const selected = stages[activeStage];

  // Vertical scroll position drives the selected stage. A manual selection
  // holds briefly so keyboard and pointer choices are not immediately undone.
  useEffect(() => {
    if (prefersReducedMotion() || stages.length === 0) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const node = wrapRef.current;
      if (!node || Date.now() < manualUntil.current) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport + rect.height)));
      const next = Math.min(stages.length - 1, Math.floor(progress * stages.length));
      setActiveStage((current) => (current === next ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [stages.length]);

  const progressStyle = {
    '--journey-progress': stages.length ? String((activeStage + 1) / stages.length) : '0',
  } as CSSProperties;

  return (
    <div
      ref={wrapRef}
      className="journey-vessel-wrap"
      style={progressStyle}
      role="group"
      aria-label="Donor to delivery journey"
    >
      <div className="journey-vessel-track">
        <span className="journey-vessel__line" aria-hidden="true" />
        <ol className="journey-vessel">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = index === activeStage;
            return (
              <li
                className={`journey-stage${isActive ? ' is-selected' : ''}`}
                key={stage.label}
                data-active={isActive}
              >
                <button
                  type="button"
                  className="journey-stage__select"
                  aria-label={`Show ${stage.label} stage`}
                  aria-pressed={isActive}
                  onClick={() => {
                    manualUntil.current = Date.now() + 2400;
                    setActiveStage(index);
                  }}
                >
                  <span className="journey-stage__node" aria-hidden="true"><Icon size={18} /></span>
                </button>
                <span className="journey-stage__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <h3>{stage.label}</h3>
                <p>{stage.detail}</p>
              </li>
            );
          })}
        </ol>
      </div>
      {selected && (
        <p className="journey-vessel__selection" aria-live="polite">
          <strong>{String(activeStage + 1).padStart(2, '0')} · {selected.label}</strong>
          <span>{selected.detail}</span>
        </p>
      )}
    </div>
  );
}
