import React from 'react';

interface AuditTrailProps {
  isOpen: boolean;
  sql?: string | null;
  columnsUsed?: string[] | null;
  confidence?: 'High' | 'Medium' | 'Low' | string | null;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ isOpen, sql, columnsUsed, confidence }) => {
  if (!isOpen) return null;

  const validConfidence = (confidence === 'High' || confidence === 'Low') 
    ? confidence 
    : 'Medium';

  const badgeColor = {
    'High': 'bg-natwest-success/20 text-natwest-success',
    'Medium': 'bg-natwest-warning/20 text-natwest-warning',
    'Low': 'bg-natwest-danger/20 text-natwest-danger'
  }[validConfidence];

  return (
    <div className="mt-3 bg-[#110B1D] rounded-lg border border-natwest-border p-4 animate-fadeIn text-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white">How did we get this?</h4>
        <span className={`px-2 py-1 rounded text-xs font-medium ${badgeColor}`}>
          Confidence: {confidence}
        </span>
      </div>
      
      {columnsUsed && columnsUsed.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-natwest-textSecondary mr-2">Columns used:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {columnsUsed.map(c => (
              <span key={c} className="bg-natwest-surface border border-natwest-border px-2 py-0.5 rounded text-xs">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {sql && (
        <div>
          <span className="text-xs text-natwest-textSecondary">Executed SQL:</span>
          <div className="mt-1 relative group">
            <pre className="p-3 bg-black rounded overflow-x-auto text-xs font-mono text-[#D4D4D4] border border-[#2D2D2D]">
              <code>{sql}</code>
            </pre>
            <button 
              onClick={() => navigator.clipboard.writeText(sql)}
              className="absolute top-2 right-2 p-1.5 bg-natwest-surface rounded border border-natwest-border text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-natwest-primary"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
