// Microphone toggle button for the chat input.
// Shows a pulsing ring animation while listening.
// Hidden entirely if the browser does not support the Web Speech API.

import React from 'react';

interface MicButtonProps {
  isListening: boolean;
  isSupported: boolean;
  isMicAvailable: boolean;
  onToggle: () => void;
}

export const MicButton: React.FC<MicButtonProps> = ({ isListening, isSupported, isMicAvailable, onToggle }) => {
  // If the browser has no support, render nothing
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={
        isListening
          ? 'Stop listening'
          : 'Speak your question'
      }
      className={`
        relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200
        ${isListening
          ? 'bg-red-500 text-white'
          : 'bg-natwest-surface text-natwest-textSecondary hover:bg-natwest-primary/40 hover:text-white'
        }
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      {/* Pulsing ring — only visible while listening */}
      {isListening && (
        <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60" />
      )}

      {isListening ? (
        // Mic-off icon
        <svg className="relative z-10 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 19 5 5m14 0v4a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7V5m7 11v3m-4 0h8" />
          <line x1="3" y1="3" x2="21" y2="21" strokeLinecap="round" strokeWidth={2} />
        </svg>
      ) : (
        // Mic-on icon
        <svg className="relative z-10 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
        </svg>
      )}
    </button>
  );
};
