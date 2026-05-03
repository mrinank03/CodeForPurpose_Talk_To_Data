import React, { useState } from 'react';
import { Mail, X, Users } from 'lucide-react';
import { ContactPicker } from '../Mailing/ContactPicker';

interface Props {
  onClose: () => void;
  onSend: (emails: string) => void;
  isSending: boolean;
}

export const EmailModal: React.FC<Props> = ({ onClose, onSend, isSending }) => {
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#120e1f] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Email Report</h2>
            <p className="text-white/40 text-xs">Send AI insights report to selected recipients</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-white/50 font-medium mb-1.5 block">Recipients</label>
            <div className="bg-[#0a0714] border border-white/10 rounded-lg p-3 min-h-[60px] flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {selectedEmails.length === 0 && (
                  <span className="text-sm text-white/30 italic">No recipients selected</span>
                )}
                {selectedEmails.map(email => (
                  <div key={email} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                    <Mail className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-emerald-300 font-medium">{email}</span>
                    <button 
                      type="button"
                      onClick={() => setSelectedEmails(prev => prev.filter(e => e !== email))}
                      className="ml-1 text-emerald-400/50 hover:text-emerald-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="self-start text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                Select Recipients
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/60 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSend(selectedEmails.join(','))}
            disabled={selectedEmails.length === 0 || isSending}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Report
              </>
            )}
          </button>
        </div>
      </div>

      {showPicker && (
        <ContactPicker 
          initialSelectedEmails={selectedEmails}
          onClose={() => setShowPicker(false)}
          onConfirm={(emails) => {
            setSelectedEmails(emails);
            setShowPicker(false);
          }}
        />
      )}
    </div>
  );
};
