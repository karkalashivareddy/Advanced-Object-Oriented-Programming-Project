import { useId, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'motion/react';
import { cx, formatNumber } from '@/lib/utils';
import { dur, ease } from '@/lib/motion';
import { useReducedMotion } from '@/lib/useReducedMotion';

export interface ChartDatum {
  name: string;
  value: number;
}

/** Palette lives in tokens.css so themes and forced-colors mode can override it. */
const axisStyle = { fontSize: 11, fill: 'var(--chart-axis)' };
const gridStroke = 'var(--chart-grid)';
const chartAnimation = { animationDuration: 480, animationEasing: 'ease-out' } as const;

interface ChartTooltipProps {
  active?: boolean;
  label?: ReactNode;
  payload?: ReadonlyArray<{ name?: ReactNode; value?: number | string }>;
}

/** Compact tooltip: the data is unchanged, only its presentation is refined. */
export function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip__label">{label ?? entry.name}</span>
      <strong className="chart-tooltip__value">{formatNumber(entry.value ?? 0)}</strong>
    </div>
  );
}

function chartSummary(data: ChartDatum[]): string {
  if (data.length === 0) return 'No chart data available.';
  return `Chart data: ${data.map((entry) => `${entry.name}, ${formatNumber(entry.value)}`).join('; ')}.`;
}

interface ChartProps {
  data: ChartDatum[];
  ariaLabel: string;
  color?: string;
  /** Adds a real, screen-reader-friendly data table under the visualisation. */
  showDataTable?: boolean;
  dataTableCaption?: string;
}

export function ChartDataTable({
  data,
  caption = 'Chart data',
  className,
}: {
  data: ChartDatum[];
  caption?: string;
  className?: string;
}) {
  return (
    <div className="chart-data-table-wrap">
      <table className={cx('premium-table', 'chart-data-table', className)}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" style={{ textAlign: 'right' }}>
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.name}>
              <th scope="row">{entry.name}</th>
              <td style={{ textAlign: 'right' }}>{formatNumber(entry.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartFrame({
  ariaLabel,
  showDataTable,
  dataTableCaption,
  data,
  summaryId,
  children,
}: ChartProps & { summaryId?: string; children: ReactNode }) {
  if (!showDataTable) {
    return (
      <>
        {children}
        {summaryId && <span id={summaryId} className="sr-only">{chartSummary(data)}</span>}
      </>
    );
  }
  return (
    <figure className="chart-figure">
      {children}
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <ChartDataTable data={data} caption={dataTableCaption ?? `${ariaLabel} — data table`} />
    </figure>
  );
}

function ChartContainer({
  ariaLabel,
  describedBy,
  reduced,
  children,
}: {
  ariaLabel: string;
  describedBy?: string;
  reduced: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="chart-container"
      role="img"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.enter }}
    >
      {children}
    </motion.div>
  );
}

export function BarChartView({
  data,
  ariaLabel,
  color = 'var(--chart-1)',
  showDataTable,
  dataTableCaption,
}: ChartProps) {
  const reduced = useReducedMotion();
  const summaryId = useId();
  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      showDataTable={showDataTable}
      dataTableCaption={dataTableCaption}
      data={data}
      summaryId={summaryId}
    >
      <ChartContainer ariaLabel={ariaLabel} describedBy={showDataTable ? undefined : summaryId} reduced={reduced}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} content={<ChartTooltip />} />
            <Bar
              dataKey="value"
              fill={color}
              radius={[5, 5, 0, 0]}
              maxBarSize={46}
              isAnimationActive={!reduced}
              {...chartAnimation}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </ChartFrame>
  );
}

export function LineChartView({
  data,
  ariaLabel,
  color = 'var(--chart-2)',
  showDataTable,
  dataTableCaption,
}: ChartProps) {
  const reduced = useReducedMotion();
  const summaryId = useId();
  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      showDataTable={showDataTable}
      dataTableCaption={dataTableCaption}
      data={data}
      summaryId={summaryId}
    >
      <ChartContainer ariaLabel={ariaLabel} describedBy={showDataTable ? undefined : summaryId} reduced={reduced}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={!reduced}
              {...chartAnimation}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </ChartFrame>
  );
}

export function PieChartView({
  data,
  ariaLabel,
  showDataTable,
  dataTableCaption,
}: ChartProps) {
  const reduced = useReducedMotion();
  const summaryId = useId();
  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      showDataTable={showDataTable}
      dataTableCaption={dataTableCaption}
      data={data}
      summaryId={summaryId}
    >
      <ChartContainer ariaLabel={ariaLabel} describedBy={showDataTable ? undefined : summaryId} reduced={reduced}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={90}
              paddingAngle={2}
              isAnimationActive={!reduced}
              {...chartAnimation}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={`var(--chart-${(index % 6) + 1})`} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </ChartFrame>
  );
}
