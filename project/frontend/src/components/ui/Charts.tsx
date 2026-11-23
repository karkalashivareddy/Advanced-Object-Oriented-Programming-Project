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

export interface ChartDatum {
  name: string;
  value: number;
}

const CHART_COLORS = ['#b42332', '#1d4ed8', '#15803d', '#b45309', '#64748b', '#7c3aed'];

const axisStyle = { fontSize: 11, fill: '#64748b' };

interface ChartProps {
  data: ChartDatum[];
  ariaLabel: string;
  color?: string;
}

export function BarChartView({ data, ariaLabel, color = '#b42332' }: ChartProps) {
  return (
    <div className="chart-container" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} maxBarSize={46} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChartView({ data, ariaLabel, color = '#1d4ed8' }: ChartProps) {
  return (
    <div className="chart-container" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
          <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieChartView({ data, ariaLabel }: ChartProps) {
  return (
    <div className="chart-container" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
