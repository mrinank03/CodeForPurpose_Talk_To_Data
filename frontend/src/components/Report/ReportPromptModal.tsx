import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
}

const SUGGESTED_PROMPTS = [
  "Analyze profit trends and category performance over the last financial year.",
  "What products will work best in the next season based on historical sales?",
  "Give me a detailed report on user engagement and feature usage.",
  "Identify top performing segments and underlying trends in revenue."
];

export const ReportPromptModal: React.FC<Props> = ({ onClose, onGenerate, isLoading }) => {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onGenerate(prompt.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#120e1f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 relative">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-display text-white mb-2">Generate AI Report</h2>
          <p className="text-sm text-white/50">Describe what kind of report you want to see. The AI will query your dataset and build a comprehensive summary with charts.</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g., Analyze the sales performance over time and show me the most profitable categories..."
                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-natwest-primary/50 resize-none transition-all custom-scrollbar"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-white/40 font-medium px-1">Suggested Prompts:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="text-left text-[11px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 border border-white/5 hover:border-white/20 transition-all leading-tight max-w-[90%]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="w-full mt-4 py-3 bg-gradient-to-r from-natwest-primary to-natwest-teal rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 shadow-[0_0_18px_rgba(134,110,255,0.35)] hover:shadow-[0_0_28px_rgba(134,110,255,0.6)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating AI Report...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Report
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
