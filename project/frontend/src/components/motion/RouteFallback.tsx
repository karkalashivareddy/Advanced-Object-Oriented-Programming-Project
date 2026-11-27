import { LifelinePath } from '@/components/brand';
import { Skeleton } from '@/components/ui';

/** Branded route fallback: ECG motif plus restrained content-shaped skeletons. */
export function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <div className="route-fallback__mark" aria-hidden="true">
        <LifelinePath variant="status" />
      </div>
      <div className="route-fallback__body">
        <Skeleton width="38%" height={26} />
        <Skeleton width="64%" height={14} />
        <div className="route-fallback__grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="route-fallback__card" key={index}>
              <Skeleton width="55%" height={12} />
              <Skeleton width="42%" height={30} />
            </div>
          ))}
        </div>
        <div className="route-fallback__card route-fallback__card--wide">
          <Skeleton height={14} width="82%" />
          <Skeleton height={14} width="68%" />
          <Skeleton height={14} width="74%" />
        </div>
      </div>
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
