import type { ChartDatum } from '@/components/ui';
import type { AnalyticsOverview } from '@/types/domain';
import { humanize } from './utils';

const NAME_KEYS = ['name', 'label', 'bloodGroup', 'componentType', 'status', 'type', 'urgency'];
const VALUE_KEYS = ['value', 'count', 'total', 'quantity', 'units', 'amount'];

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Normalises the documented grouped analytics responses into chart-friendly data. */
export function toChartData(source: unknown): ChartDatum[] {
  if (Array.isArray(source)) {
    return source
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const nameKey = NAME_KEYS.find((key) => record[key] !== undefined);
        const valueKey = VALUE_KEYS.find((key) => asNumber(record[key]) !== null);
        if (!nameKey || !valueKey) return null;
        return {
          name: humanize(String(record[nameKey])),
          value: asNumber(record[valueKey]) ?? 0,
        };
      })
      .filter((entry): entry is ChartDatum => entry !== null);
  }

  if (source && typeof source === 'object') {
    return Object.entries(source as Record<string, unknown>)
      .map(([key, value]) => ({ name: humanize(key), value: asNumber(value) }))
      .filter((entry): entry is ChartDatum => entry.value !== null);
  }

  return [];
}

export interface OverviewMetric {
  label: string;
  value: number;
}

export function toOverviewMetrics(overview: AnalyticsOverview | undefined, limit = 6): OverviewMetric[] {
  if (!overview) return [];
  const flattened: Record<string, unknown> = {};
  Object.entries(overview).forEach(([key, value]) => {
    if (asNumber(value) !== null) flattened[key] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
        if (asNumber(nestedValue) !== null) flattened[nestedKey] = nestedValue;
      });
    }
  });
  return Object.entries(flattened)
    .slice(0, limit)
    .map(([label, value]) => ({ label: humanize(label), value: asNumber(value) ?? 0 }));
}
