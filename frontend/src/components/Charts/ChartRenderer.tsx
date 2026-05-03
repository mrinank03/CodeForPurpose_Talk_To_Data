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

  // Intelligent Dual Y-Axis Detection
  const yAxisConfig = useMemo(() => {
    if (yAxisKeys.length < 2 || !data.length) return { dual: false, leftKeys: yAxisKeys, rightKeys: [] };

    const stats = yAxisKeys.map(k => {
      const vals = data.map(d => d[k]).filter(v => typeof v === 'number');
      return { key: k, max: Math.max(...vals), min: Math.min(...vals) };
    });

    const percentageKeywords = ['margin', 'percent', 'rate', 'ratio', 'pct'];
    
    // Identify keys that should likely be on the right axis (percentages or small scales)
    const rightKeys = stats.filter(s => {
      const isPercentageName = percentageKeywords.some(kw => s.key.toLowerCase().includes(kw));
      const scaleMismatch = stats.some(other => other.max > s.max * 50); // 50x difference
      return isPercentageName || (scaleMismatch && s.max < 1000);
    }).map(s => s.key);
    
    const leftKeys = yAxisKeys.filter(k => !rightKeys.includes(k));
    const isDual = leftKeys.length > 0 && rightKeys.length > 0;
    
    return { dual: isDual, leftKeys, rightKeys };
  }, [data, yAxisKeys]);

  if (yAxisKeys.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#110B1D] border border-natwest-border p-3 rounded shadow-xl text-sm">
          <p className="text-white font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => {
            const isPercent = entry.name.toLowerCase().includes('margin') || entry.name.toLowerCase().includes('percent') || entry.name.toLowerCase().includes('pct');
            return (
              <p key={index} style={{ color: entry.color }}>
                {entry.name}: {isPercent ? `${entry.value.toFixed(2)}%` : entry.value.toLocaleString()}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height }} className="mt-4 mb-2">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D1F45" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
            {yAxisConfig.dual && (
              <YAxis yAxisId="right" orientation="right" stroke="#00A89A" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
            )}
            <Tooltip content={<CustomTooltip />} cursor={{fill: '#1A1025'}} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#A08CC0' }} />
            {yAxisConfig.leftKeys.map((k, i) => (
              <Bar key={k} yAxisId="left" dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
            {yAxisConfig.rightKeys.map((k, i) => (
              <Bar key={k} yAxisId="right" dataKey={k} fill={COLORS[(i + yAxisConfig.leftKeys.length) % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D1F45" vertical={false} />
            <XAxis dataKey={xAxisKey} stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="#A08CC0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
            {yAxisConfig.dual && (
              <YAxis yAxisId="right" orientation="right" stroke="#00A89A" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#A08CC0' }} />
            {yAxisConfig.leftKeys.map((k, i) => (
              <Line key={k} yAxisId="left" type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{r: 4, fill: '#0F0A1A', strokeWidth: 2}} activeDot={{r: 6}} />
            ))}
            {yAxisConfig.rightKeys.map((k, i) => (
              <Line key={k} yAxisId="right" type="monotone" dataKey={k} stroke={COLORS[(i + yAxisConfig.leftKeys.length) % COLORS.length]} strokeWidth={3} dot={{r: 4, fill: '#0F0A1A', strokeWidth: 2}} activeDot={{r: 6}} />
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
          <div />
        )}
      </ResponsiveContainer>
    </div>
  );
};
