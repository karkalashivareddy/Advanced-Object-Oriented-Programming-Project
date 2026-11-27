import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'motion/react';
import { dur, ease } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { formatNumber } from '@/lib/utils';
import { ChartTooltip } from './Charts';

export interface AnalyticsChartDatum {
  name: string;
  value: number;
}

const axisStyle = { fontSize: 11, fill: 'var(--chart-axis)' };

export function AnalyticsBarChart({ data, ariaLabel }: { data: AnalyticsChartDatum[]; ariaLabel: string }) {
  const reducedMotion = useReducedMotion();
  const summaryId = useId();
  const summary = data.length
    ? `Chart data: ${data.map((entry) => `${entry.name}, ${formatNumber(entry.value)}`).join('; ')}.`
    : 'No chart data available.';

  return (
    <>
      <motion.div
        className="chart-container"
        role="img"
        aria-label={ariaLabel}
        aria-describedby={summaryId}
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur.base, ease: ease.enter }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} content={<ChartTooltip />} />
            <Bar
              dataKey="value"
              fill="var(--chart-1)"
              radius={[5, 5, 0, 0]}
              maxBarSize={46}
              isAnimationActive={!reducedMotion}
              animationDuration={480}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
      <span className="sr-only" id={summaryId}>{summary}</span>
    </>
  );
}
