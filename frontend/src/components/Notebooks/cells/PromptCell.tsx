import React, { useState, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { NotebookCell } from '../../../types/notebook';
import { ChartRenderer } from '../../Charts/ChartRenderer';

interface PromptCellProps {
  cell: NotebookCell;
  notebookId: string;
  sessionId: string;
  onChange: (id: string, content: string) => void;
  onResultUpdate: (id: string, result: any, resultType: string) => void;
}

export const PromptCell: React.FC<PromptCellProps> = ({
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
          placeholder="e.g. Show total transactions by region as a bar chart"
          className="w-full bg-[#1A1527] border border-white/10 rounded-lg p-3 pr-12 text-white/90 font-sans text-sm resize-y min-h-[80px] focus:outline-none focus:border-natwest-primary/50 transition-colors"
        />
        <button
          onClick={handleRun}
          disabled={isRunning || !content.trim()}
          className="absolute right-2 bottom-2 p-2 bg-natwest-primary/20 hover:bg-natwest-primary/40 text-natwest-primary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Run prompt"
        >
          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        </button>
      </div>

      {cell.result && (
        <div className="mt-2 bg-[#150D22] border border-white/5 rounded-lg p-4">
          {cell.result.error && (
            <div className="text-red-400 bg-red-400/10 p-3 rounded-md text-sm">
              Error: {cell.result.error}
            </div>
          )}
          {!cell.result.error && cell.result_type === 'chart' && cell.result.chart_data && (
             <ChartRenderer type={cell.result.chart_type} data={cell.result.chart_data} />
          )}
          {!cell.result.error && cell.result_type === 'table' && cell.result.rows && (
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
          )}
          {!cell.result.error && cell.result.answer && (
             <blockquote className="border-l-2 border-natwest-primary pl-4 text-white/80 text-sm mt-3 first:mt-0">
               {cell.result.answer}
             </blockquote>
          )}
        </div>
      )}
    </div>
  );
};
