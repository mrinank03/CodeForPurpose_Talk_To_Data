import React, { useEffect, useState } from 'react';
import api from '../../services/api';

interface ColumnInfo {
  name: string;
  type: 'numeric' | 'categorical';
  unique_count: number;
  null_pct: number;
}

interface Props {
  sessionId: string;
  onClose: () => void;
  onGenerate: (columns: string[]) => void;
  isLoading: boolean;
}

export const ColumnSelectorModal: React.FC<Props> = ({ sessionId, onClose, onGenerate, isLoading }) => {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchColumns = async () => {
      try {
        const res = await api.get(`/api/report/columns/${sessionId}`);
        const cols: ColumnInfo[] = res.data.columns || [];
        setColumns(cols);
        setTotalRows(res.data.total_rows || 0);
        // Pre-select all numeric columns
        const preSelected = new Set(cols.filter(c => c.type === 'numeric').map(c => c.name));
        // Also select first 3 categorical columns
        cols.filter(c => c.type === 'categorical').slice(0, 3).forEach(c => preSelected.add(c.name));
        setSelected(preSelected);
      } catch (e) {
        console.error('Failed to fetch columns', e);
      } finally {
        setLoading(false);
      }
    };
    fetchColumns();
  }, [sessionId]);

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(columns.map(c => c.name)));
  const deselectAll = () => setSelected(new Set());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#120e1f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Generate AI Report</h2>
                <p className="text-white/40 text-xs">{totalRows.toLocaleString()} rows · Select columns to analyze</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Select All / Deselect All */}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={selectAll} className="text-xs text-natwest-tealLight hover:text-white transition-colors">Select All</button>
            <span className="text-white/20">·</span>
            <button onClick={deselectAll} className="text-xs text-white/40 hover:text-white transition-colors">Deselect All</button>
            <span className="ml-auto text-xs text-white/30">{selected.size} of {columns.length} selected</span>
          </div>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            columns.map(col => (
              <label
                key={col.name}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                  selected.has(col.name)
                    ? 'bg-natwest-primary/10 border-natwest-primary/30'
                    : 'bg-white/[0.02] border-transparent hover:bg-white/5 hover:border-white/10'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(col.name)}
                  onChange={() => toggle(col.name)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-natwest-primary focus:ring-natwest-primary/50"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate block">
                    {col.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {col.unique_count} unique · {col.null_pct}% null
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  col.type === 'numeric'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {col.type}
                </span>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => onGenerate(Array.from(selected))}
            disabled={selected.size === 0 || isLoading}
            className="w-full py-3 bg-gradient-to-r from-natwest-primary to-natwest-teal rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 shadow-[0_0_18px_rgba(134,110,255,0.35)] hover:shadow-[0_0_28px_rgba(134,110,255,0.6)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating Report...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Generate Report ({selected.size} columns)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
