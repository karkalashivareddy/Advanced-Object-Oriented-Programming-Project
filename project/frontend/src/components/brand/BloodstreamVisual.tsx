import { useId } from 'react';
import { useReducedMotion } from '@/lib/useReducedMotion';

const VESSEL_PATH =
  'M -30 318 C 92 318 126 210 246 202 C 362 194 384 320 508 302 C 610 287 638 158 790 148';
const INNER_PATH =
  'M -30 300 C 90 300 132 230 246 222 C 356 214 390 296 508 282 C 606 270 646 184 790 174';
const FLOW_PATHS = [
  'M -30 318 C 92 318 126 210 246 202 C 362 194 384 320 508 302 C 610 287 638 158 790 148',
  'M -30 336 C 96 336 138 228 252 220 C 366 212 392 340 510 322 C 612 306 650 176 790 166',
  'M -30 300 C 90 300 132 230 246 222 C 356 214 390 296 508 282 C 606 270 646 184 790 174',
];

const CELLS = [
  { path: 0, begin: '0s', duration: '15s', rx: 21, ry: 12, rotate: -12, x: 132, y: 258 },
  { path: 1, begin: '-4.5s', duration: '18s', rx: 17, ry: 10, rotate: 14, x: 315, y: 246 },
  { path: 2, begin: '-9s', duration: '13s', rx: 24, ry: 13, rotate: -6, x: 482, y: 280 },
  { path: 0, begin: '-11s', duration: '20s', rx: 15, ry: 9, rotate: 22, x: 640, y: 214 },
  { path: 1, begin: '-2s', duration: '16s', rx: 19, ry: 11, rotate: -18, x: 712, y: 174 },
];

type BloodstreamVisualProps = {
  /** Provide a label when the visual conveys information; omit it when decorative. */
  label?: string;
  className?: string;
};

/**
 * Decorative, code-drawn vessel used by the public storytelling pages.
 * The artwork is illustrative only and never represents live supply data.
 */
export function BloodstreamVisual({ label, className }: BloodstreamVisualProps) {
  const reducedMotion = useReducedMotion();
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const decorative = !label;

  return (
    <svg
      className={className ? `bloodstream-visual ${className}` : 'bloodstream-visual'}
      viewBox="0 0 760 460"
      preserveAspectRatio="xMidYMid slice"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      focusable="false"
    >
      <defs>
        <linearGradient id={`vessel-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-vessel-900)" />
          <stop offset="52%" stopColor="var(--color-vessel-700)" />
          <stop offset="100%" stopColor="var(--color-vessel-950)" />
        </linearGradient>
        <linearGradient id={`plasma-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-cell)" stopOpacity="0.15" />
          <stop offset="45%" stopColor="var(--color-cell-bright)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--color-cell)" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id={`cell-${uid}`} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="var(--color-cell-bright)" />
          <stop offset="62%" stopColor="var(--color-cell)" />
          <stop offset="100%" stopColor="var(--color-cell-core)" />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="760" height="460" fill="var(--color-vessel-950)" />
      <g opacity="0.35" stroke="var(--color-vessel-500)" strokeWidth="1">
        <path d="M0 78 H760" />
        <path d="M0 382 H760" />
        <path d="M90 0 V460" />
        <path d="M670 0 V460" />
      </g>

      <path
        d={VESSEL_PATH}
        fill="none"
        stroke={`url(#vessel-${uid})`}
        strokeWidth="118"
        strokeLinecap="round"
        opacity="0.96"
      />
      <path
        d={VESSEL_PATH}
        fill="none"
        stroke="var(--color-vessel-500)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d={INNER_PATH}
        fill="none"
        stroke={`url(#plasma-${uid})`}
        strokeWidth="42"
        strokeLinecap="round"
        opacity="0.28"
      />
      <path
        className="bloodstream-visual__flow"
        d={INNER_PATH}
        fill="none"
        stroke={`url(#plasma-${uid})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="18 30"
        filter={`url(#glow-${uid})`}
      />

      <g opacity="0.7">
        {CELLS.map((cell, index) => (
          <ellipse
            key={`static-${index}`}
            cx={cell.x}
            cy={cell.y}
            rx={cell.rx}
            ry={cell.ry}
            transform={`rotate(${cell.rotate} ${cell.x} ${cell.y})`}
            fill={`url(#cell-${uid})`}
            opacity={reducedMotion ? 0.9 : 0.22}
          />
        ))}
      </g>

      {!reducedMotion &&
        CELLS.map((cell, index) => (
          <g key={`flow-${index}`}>
            <ellipse
              rx={cell.rx}
              ry={cell.ry}
              fill={`url(#cell-${uid})`}
              stroke="var(--color-cell-bright)"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            >
              <animateMotion
                dur={cell.duration}
                begin={cell.begin}
                repeatCount="indefinite"
                rotate={String(cell.rotate)}
                path={FLOW_PATHS[cell.path]}
              />
            </ellipse>
          </g>
        ))}

      <g fill="none" stroke="var(--color-cell-bright)" opacity="0.5">
        <circle cx="86" cy="294" r="18" />
        <circle cx="86" cy="294" r="31" opacity="0.45" />
        <circle cx="86" cy="294" r="46" opacity="0.2" />
      </g>
    </svg>
  );
}
