'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { WeeklyCount } from '@/types/metrics';

function formatWeekLabel(isoWeek: string): string {
  // isoWeek = "2024-W12" — return the Monday date as "Mar 18"
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  // ISO week 1 = week containing Jan 4
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface VelocityChartProps {
  weeklyData: WeeklyCount[];
  recent4wAvg: number;
  prior8wAvg: number;
  percentChange: number;
}

export default function VelocityChart({
  weeklyData,
  recent4wAvg,
  prior8wAvg,
  percentChange,
}: VelocityChartProps) {
  const data = weeklyData.map((d) => ({
    ...d,
    label: formatWeekLabel(d.week),
  }));

  const changeSign = percentChange > 0 ? '+' : '';
  const changeColor =
    percentChange > 10
      ? 'text-indigo-400'
      : percentChange >= -5
        ? 'text-green-400'
        : percentChange >= -20
          ? 'text-amber-400'
          : 'text-red-400';

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-neutral-300">Velocity Trend — Merged PRs per Week</h3>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>
            Recent 4w avg:{' '}
            <span className="font-mono text-neutral-300">{recent4wAvg}</span>
          </span>
          <span>
            Prior 8w avg:{' '}
            <span className="font-mono text-neutral-300">{prior8wAvg}</span>
          </span>
          <span className={`font-mono font-medium ${changeColor}`}>
            {changeSign}{percentChange}% vs prior period
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#525252', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: '#525252', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#171717',
              border: '1px solid #404040',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#d4d4d4',
            }}
            itemStyle={{ color: '#818cf8' }}
            labelStyle={{ color: '#737373', marginBottom: '2px' }}
            formatter={(value) => [Number(value), 'Merged PRs']}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#818cf8"
            strokeWidth={2}
            dot={{ fill: '#818cf8', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#a5b4fc' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
