import type { LucideIcon } from 'lucide-react';

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
  return (
    <div className="journey-vessel-wrap" role="group" aria-label="Donor to delivery journey">
      <div className="journey-vessel-track">
        <span className="journey-vessel__line" aria-hidden="true" />
        <ol className="journey-vessel">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <li className="journey-stage" key={stage.label}>
                <span className="journey-stage__node" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="journey-stage__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{stage.label}</h3>
                <p>{stage.detail}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
