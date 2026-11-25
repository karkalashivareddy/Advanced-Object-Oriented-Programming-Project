import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

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
  const selected = stages[activeStage];
  return (
    <div className="journey-vessel-wrap" role="group" aria-label="Donor to delivery journey">
      <div className="journey-vessel-track">
        <span className="journey-vessel__line" aria-hidden="true" />
        <ol className="journey-vessel">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <li className={`journey-stage${index === activeStage ? ' is-selected' : ''}`} key={stage.label}>
                <button
                  type="button"
                  className="journey-stage__select"
                  aria-label={`Show ${stage.label} stage`}
                  aria-pressed={index === activeStage}
                  onClick={() => setActiveStage(index)}
                >
                  <span className="journey-stage__node" aria-hidden="true"><Icon size={18} /></span>
                  <span className="journey-stage__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                </button>
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
