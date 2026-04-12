import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartRendererProps {
  type: string;
  data: any[];
  height?: number;
}

const COLORS = ['#7B4FAF', '#00A89A', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

export const ChartRenderer: React.FC<ChartRendererProps> = ({ type, data, height = 300 }) => {
  const keys = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  if (!data || data.length === 0 || type === 'none') return null;

  if (type === 'table') {
    return (
      <div className="overflow-x-auto border border-natwest-border rounded bg-black/30" style={{ maxHeight: height }}>
        <table className="w-full text-sm text-left">
          <thead className="bg-[#1D1429] text-natwest-textSecondary sticky top-0">
            <tr>
              {keys.map(k => (
                <th key={k} className="px-3 py-2 font-medium border-b border-natwest-border">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-natwest-border/30 hover:bg-natwest-surface">
                {keys.map(k => (
                  <td key={k} className="px-3 py-1.5 text-white">{String(row[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Assuming first key is X axis (categorical/time), and subsequent numeric keys are Y axis
  const xAxisKey = keys[0];
  const yAxisKeys = keys.slice(1).filter(k => typeof data[0][k] === 'number');

  if (yAxisKeys.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#110B1D] border border-natwest-border p-3 rounded shadow-xl text-sm">
          <p className="text-white font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height }} className="mt-4 mb-2">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D1F45" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: '#1A1025'}} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#A08CC0' }} />
            {yAxisKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D1F45" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#A08CC0' }} />
            {yAxisKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{r: 4, fill: '#0F0A1A', strokeWidth: 2}} activeDot={{r: 6}} />
            ))}
          </LineChart>
        ) : type === 'pie' ? (
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#A08CC0' }} layout="vertical" verticalAlign="middle" align="right" />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey={yAxisKeys[0]}
              nameKey={xAxisKey}
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <div /> // Fallback handled earlier
        )}
      </ResponsiveContainer>
    </div>
  );
};
