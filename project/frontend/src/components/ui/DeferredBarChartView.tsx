import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { AnalyticsChartDatum } from './AnalyticsBarChart';
import { Skeleton } from './Skeleton';

const AnalyticsBarChart = lazy(async () => {
  const chart = await import('./AnalyticsBarChart');
  return { default: chart.AnalyticsBarChart };
});

export function DeferredBarChartView({ data, ariaLabel }: { data: AnalyticsChartDatum[]; ariaLabel: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '80px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host}>
      {nearViewport ? (
        <Suspense fallback={<div className="chart-container" role="status" aria-label={`Loading ${ariaLabel}`}><Skeleton height={180} /></div>}>
          <AnalyticsBarChart data={data} ariaLabel={ariaLabel} />
        </Suspense>
      ) : (
        <div className="chart-container" aria-hidden="true" />
      )}
    </div>
  );
}
