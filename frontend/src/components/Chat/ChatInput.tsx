import React, { useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<Props> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isLoading) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative mt-auto">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask anything about your data..."
        disabled={isLoading}
        className="w-full bg-natwest-surface border border-natwest-border rounded-full pl-6 pr-12 py-3.5 text-white placeholder-natwest-textSecondary focus:outline-none focus:border-natwest-teal focus:ring-1 focus:ring-natwest-teal transition-all disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!text.trim() || isLoading}
        className="absolute right-2 top-1.5 bottom-1.5 w-10 h-10 rounded-full bg-natwest-primary hover:bg-natwest-medium disabled:bg-natwest-surface disabled:text-natwest-textSecondary flex items-center justify-center text-white transition-colors"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 ml-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
      </button>
    </form>
  );
};
