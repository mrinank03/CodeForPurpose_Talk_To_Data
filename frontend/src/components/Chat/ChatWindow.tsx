import React, { useEffect, useRef } from 'react';
import { Message } from '../../types/index';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface Props {
  messages: Message[];
  isLoading: boolean;
  onSend: (text: string) => void;
  suggestedQuestions: string[];
  onGenerateInsights?: () => void;
  isStoryLoading?: boolean;
}

// Short, punchy labels for the suggested questions — truncated inline
const ShortQuestionChips: React.FC<{ questions: string[]; onClick: (q: string) => void }> = ({ questions, onClick }) => {
  if (!questions || questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 w-full">
      {questions.slice(0, 3).map((q, i) => (
        <button
          key={i}
          onClick={() => onClick(q)}
          className="text-left px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-natwest-primary/30 hover:border-natwest-primary/60 text-white/80 hover:text-white text-sm font-medium transition-all flex items-center justify-between gap-3 group"
        >
          <span className="truncate">{q}</span>
          <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      ))}
    </div>
  );
};

export const ChatWindow: React.FC<Props> = ({ messages, isLoading, onSend, suggestedQuestions, onGenerateInsights, isStoryLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;
  // Show chips at end of chat when: not loading, and user has < 2 messages sent
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  const showChipsInChat = hasMessages && !isLoading && userMsgCount < 3 && suggestedQuestions.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full flex-1 relative overflow-hidden">
      {/* Scrollable Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
        {!hasMessages ? (
          /* ─── Empty State ─── */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-8">
            {/* Sparkle icon */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(134,110,255,0.35)]">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Ask your data anything</h3>
            <p className="text-white/50 text-sm mb-7 leading-relaxed">
              Type a question below, or pick one to get started.
            </p>

            {/* Suggested chips — vertically stacked, part of the page flow */}
            {suggestedQuestions.length > 0 && (
              <ShortQuestionChips questions={suggestedQuestions} onClick={onSend} />
            )}

            {/* Generate Report button — prominent, below chips */}
            {onGenerateInsights && (
              <button
                onClick={onGenerateInsights}
                disabled={isStoryLoading}
                className="mt-6 px-7 py-3 bg-gradient-to-r from-natwest-primary to-natwest-teal rounded-full text-sm font-bold text-white transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(134,110,255,0.5)] hover:shadow-[0_0_30px_rgba(134,110,255,0.7)] hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                {isStoryLoading ? 'Analyzing your data...' : 'Generate Report'}
              </button>
            )}
          </div>
        ) : (
          /* ─── Chat Messages ─── */
          <div className="max-w-3xl mx-auto w-full pt-4">
            {messages.map((m, i) => (
              <ChatMessage key={i} message={m} />
            ))}

            {/* While AI is thinking */}
            {isLoading && (
              <div className="flex w-full mb-6 justify-start items-end gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-natwest-primary to-natwest-teal flex-shrink-0 flex items-center justify-center font-bold text-white text-xs">
                  DL
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl rounded-bl-sm flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Suggested chips after AI responds — scrolls with chat */}
            {showChipsInChat && (
              <div className="mb-6 mt-2">
                <p className="text-white/40 text-xs mb-2 pl-1">Suggested next questions:</p>
                <ShortQuestionChips questions={suggestedQuestions} onClick={onSend} />
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ─── Fixed Input Bar ─── */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput onSend={onSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};
