import React, { useState } from 'react';
import { Message } from '../../types/index';
import { ChartRenderer } from '../Charts/ChartRenderer';
import { Database, ChevronDown, ChevronUp } from 'lucide-react';

const ConfidenceBadge: React.FC<{ confidence: string }> = ({ confidence }) => {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    High:   { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', icon: '✓' },
    Medium: { bg: 'bg-amber-500/15 border-amber-500/30',   text: 'text-amber-400',   icon: '~' },
    Low:    { bg: 'bg-red-500/15 border-red-500/30',       text: 'text-red-400',      icon: '!' },
  };
  const c = config[confidence] || config.Medium;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${c.bg} ${c.text}`}>
      <span className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-current/20 text-[9px] font-bold">{c.icon}</span>
      {confidence} Confidence
    </span>
  );
};

export const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-natwest-primary flex-shrink-0 flex items-center justify-center font-bold text-white text-xs mr-3 mt-1">
          DL
        </div>
      )}
      
      <div className={`max-w-[85%] ${isUser ? 'bg-natwest-primary text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-md' : 'bg-[#150D22] border border-natwest-border rounded-xl rounded-tl-sm px-5 py-4 text-natwest-textPrimary shadow-sm'}`}>
        <div className="leading-relaxed">
          {message.content}
        </div>
        
        {!isUser && message.chart_data && message.chart_type && message.chart_type !== 'none' && (
          <div className="mt-4">
            <ChartRenderer type={message.chart_type} data={message.chart_data} />
          </div>
        )}

        {!isUser && (message.confidence || message.sql) && (
          <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {message.confidence && <ConfidenceBadge confidence={message.confidence} />}
              
              {message.sql && (
                <button 
                  onClick={() => setShowSql(!showSql)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors border border-white/5"
                >
                  <Database className="w-3.5 h-3.5" />
                  View SQL Query
                  {showSql ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                </button>
              )}
            </div>
            
            {message.sql && showSql && (
              <div className="bg-black/40 rounded-lg p-3 border border-white/5 overflow-x-auto w-full">
                <pre className="text-xs text-blue-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {message.sql}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
