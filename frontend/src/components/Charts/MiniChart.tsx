import React from 'react';
import { ChartRenderer } from './ChartRenderer';

export const MiniChart: React.FC<{ type: string; data: any[] }> = ({ type, data }) => {
  if (!data || data.length === 0 || type === 'none') {
    return (
      <div className="w-full h-24 flex items-center justify-center text-white/30 text-xs">
        No chart data
      </div>
    );
  }
  return (
    <div className="w-full">
      <ChartRenderer type={type} data={data} height={type === 'table' ? 120 : 160} />
    </div>
  );
};
