import type { ReactNode } from 'react';
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
import { cx, formatNumber } from '@/lib/utils';
import { useReducedMotion } from '@/lib/useReducedMotion';

export interface ChartDatum {
  name: string;
  value: number;
}

/** Palette lives in tokens.css so themes and forced-colors mode can override it. */
const axisStyle = { fontSize: 11, fill: 'var(--chart-axis)' };
const gridStroke = 'var(--chart-grid)';
const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
  fontSize: 'var(--text-xs)',
};

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
  children,
}: ChartProps & { children: ReactNode }) {
  if (!showDataTable) return <>{children}</>;
  return (
    <figure className="chart-figure">
      {children}
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <ChartDataTable data={data} caption={dataTableCaption ?? `${ariaLabel} — data table`} />
    </figure>
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
  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      showDataTable={showDataTable}
      dataTableCaption={dataTableCaption}
      data={data}
    >
      <div className="chart-container" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'var(--color-surface-hover)' }} contentStyle={tooltipStyle} />
            <Bar
              dataKey="value"
              fill={color}
              radius={[5, 5, 0, 0]}
              maxBarSize={46}
              isAnimationActive={!reduced}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      showDataTable={showDataTable}
      dataTableCaption={dataTableCaption}
      data={data}
    >
      <div className="chart-container" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
  return (
    <ChartFrame
      ariaLabel={ariaLabel}
      showDataTable={showDataTable}
      dataTableCaption={dataTableCaption}
      data={data}
    >
      <div className="chart-container" role="img" aria-label={ariaLabel}>
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
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={`var(--chart-${(index % 6) + 1})`} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
