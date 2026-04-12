import React, { useState } from 'react';
import { DatasetMeta } from '../../types/index';

interface DatasetSummaryProps {
  meta: DatasetMeta;
  metricDict: Record<string, string>;
  profile: Record<string, any>;
}

export const DatasetSummary: React.FC<DatasetSummaryProps> = ({ meta, metricDict, profile }) => {
  const [showDict, setShowDict] = useState(false);

  const getTagColor = (type: string) => {
    switch(type) {
      case 'dimension': return 'bg-natwest-primary/20 text-natwest-light border-natwest-primary';
      case 'measure': return 'bg-natwest-teal/20 text-natwest-tealLight border-natwest-teal';
      case 'time': return 'bg-natwest-warning/20 text-natwest-warning border-natwest-warning/50';
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  return (
    <div className="bg-natwest-surface border border-natwest-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-white">Dataset Ready</h2>
          <p className="text-natwest-textSecondary text-sm">
            {meta.row_count.toLocaleString()} rows • {meta.col_count} columns
          </p>
        </div>
        <button 
          onClick={() => setShowDict(!showDict)}
          className="text-sm font-medium text-natwest-tealLight hover:text-white transition-colors"
        >
          {showDict ? 'Hide Dictionary' : 'View Metric Dictionary'}
        </button>
      </div>

      {showDict && (
        <div className="mb-6 bg-black/40 border border-natwest-border rounded-lg p-4 grid gap-2 max-h-60 overflow-y-auto">
          {meta.columns.map(col => (
            <div key={col} className="text-sm">
              <span className="font-mono text-natwest-light mr-2 bg-natwest-primary/10 px-1 rounded">{col}</span>
              <span className="text-natwest-textSecondary">{metricDict[col]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {meta.columns.map(col => {
          const type = profile[col]?.type || 'dimension';
          return (
            <div key={col} className={`px-2.5 py-1 rounded-full border text-xs font-medium flex items-center gap-1.5 ${getTagColor(type)}`}>
              {col}
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto border border-natwest-border rounded-lg bg-natwest-bg">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#1D1429] text-natwest-textSecondary">
            <tr>
              {meta.columns.map(col => (
                <th key={col} className="px-4 py-3 font-medium border-b border-natwest-border whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meta.head.map((row, i) => (
              <tr key={i} className="border-b border-natwest-border/50 hover:bg-natwest-surface/50">
                {meta.columns.map(col => (
                  <td key={col} className="px-4 py-2 text-white whitespace-nowrap">{String(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
