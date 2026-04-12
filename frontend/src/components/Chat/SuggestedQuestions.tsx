import React from 'react';

interface Props {
  questions: string[];
  onClick: (q: string) => void;
}

export const SuggestedQuestions: React.FC<Props> = ({ questions, onClick }) => {
  if (!questions || questions.length === 0) return null;
  
  return (
    <div className="flex flex-col items-center gap-2 mb-6 w-full px-4">
      {questions.slice(0, 3).map((q, i) => (
        <button
          key={i}
          onClick={() => onClick(q)}
          className="w-full md:w-3/4 max-w-lg px-4 py-3 rounded-2xl border border-natwest-primary/40 bg-[#1A112B] hover:bg-natwest-primary hover:border-natwest-light text-natwest-light text-[13px] md:text-sm font-medium transition-all shadow-sm flex items-center justify-between group"
        >
          <span className="truncate pr-2">{q}</span>
          <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      ))}
    </div>
  );
};
