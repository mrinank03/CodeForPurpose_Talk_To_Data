import React, { useState, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { NotebookCell } from '../../../types/notebook';

interface CodeCellProps {
  cell: NotebookCell;
  notebookId: string;
  sessionId: string;
  onChange: (id: string, content: string) => void;
  onResultUpdate: (id: string, result: any, resultType: string) => void;
}

export const CodeCell: React.FC<CodeCellProps> = ({
  cell, notebookId, sessionId, onChange, onResultUpdate
}) => {
  const [content, setContent] = useState(cell.content);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setContent(cell.content);
  }, [cell.content]);

  const handleRun = async () => {
    if (!content.trim() || isRunning) return;
    setIsRunning(true);
    try {
      const { runCell } = await import('../../../services/notebookApi');
      const data = await runCell(notebookId, { ...cell, content });
      if (data.error) {
        onResultUpdate(cell.id, { error: data.error }, 'text');
      } else {
        onResultUpdate(cell.id, data.result, data.result_type);
      }
    } catch (e: any) {
      onResultUpdate(cell.id, { error: e.message }, 'text');
    } finally {
      setIsRunning(false);
    }
  };

  const handleBlur = () => {
    if (content !== cell.content) onChange(cell.id, content);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onBlur={handleBlur}
          placeholder="SELECT * FROM table_name LIMIT 10;"
          className="w-full bg-[#0d1117] text-blue-300 font-mono text-sm p-4 pr-24 rounded-lg border border-white/10 min-h-[100px] focus:outline-none focus:border-blue-500/50 resize-y"
        />
        <button
          onClick={handleRun}
          disabled={isRunning || !content.trim()}
          className="absolute right-3 bottom-3 flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded transition-colors text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run SQL
        </button>
      </div>

      {cell.result && (
        <div className="mt-2 bg-[#150D22] border border-white/5 rounded-lg overflow-hidden">
          {cell.result.error ? (
            <div className="text-red-400 bg-red-400/10 p-3 m-3 rounded-md text-sm font-mono">
              {cell.result.error}
            </div>
          ) : cell.result_type === 'table' && cell.result.rows ? (
            cell.result.rows.length === 0 ? (
              <div className="text-white/40 text-sm p-4 text-center">Query returned no results</div>
            ) : (
              <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                <table className="w-full text-left text-sm text-white/80 whitespace-nowrap">
                  <thead className="sticky top-0 bg-[#1A1527] text-xs uppercase text-white/50 border-b border-white/10 shadow-sm">
                    <tr>
                      {cell.result.columns?.map((col: string) => (
                        <th key={col} className="px-4 py-3 font-semibold">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cell.result.rows?.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        {cell.result.columns?.map((col: string) => (
                          <td key={col} className="px-4 py-2 font-mono text-xs">{String(row[col])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </div>
      )}
    </div>
  );
};
