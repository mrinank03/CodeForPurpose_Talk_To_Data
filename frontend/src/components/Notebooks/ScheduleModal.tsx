import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2, Mail, Plus, Loader2 } from 'lucide-react';
import { Schedule } from '../../types/schedule';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../services/scheduleApi';

interface ScheduleModalProps {
  notebookId: string;
  onClose: () => void;
}

const CRON_PRESETS = [
  { label: 'Every Minute (Testing)', value: '* * * * *' },
  { label: 'Daily at 9:00 AM', value: '0 9 * * *' },
  { label: 'Weekly on Monday at 9:00 AM', value: '0 9 * * 1' },
  { label: 'Monthly on the 1st at 9:00 AM', value: '0 9 1 * *' },
  { label: 'Custom...', value: 'custom' },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ notebookId, onClose }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [preset, setPreset] = useState(CRON_PRESETS[1].value);
  const [customCron, setCustomCron] = useState('');
  const [emails, setEmails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, [notebookId]);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const data = await getSchedules(notebookId);
      setSchedules(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emails.trim()) return;

    const finalCron = preset === 'custom' ? customCron : preset;
    if (!finalCron.trim()) return;

    try {
      setIsSubmitting(true);
      await createSchedule({
        notebook_id: notebookId,
        cron_expression: finalCron,
        recipient_emails: emails,
      });
      await fetchSchedules();
      setIsCreating(false);
      setEmails('');
      setPreset(CRON_PRESETS[1].value);
      setCustomCron('');
    } catch (err: any) {
      setError(err.message || 'Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    try {
      await updateSchedule(schedule.schedule_id, { enabled: !schedule.enabled });
      setSchedules(prev => prev.map(s => s.schedule_id === schedule.schedule_id ? { ...s, enabled: !s.enabled } : s));
    } catch (err: any) {
      setError(err.message || 'Failed to update schedule');
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      setSchedules(prev => prev.filter(s => s.schedule_id !== scheduleId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete schedule');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0714] border border-white/10 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-natwest-primary/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-natwest-primary" />
            </div>
            <h2 className="text-lg font-display font-bold text-white">Scheduled Reports</h2>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Active Schedules List */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Active Schedules</h3>
              {!isCreating && (
                <button 
                  onClick={() => setIsCreating(true)}
                  className="text-xs font-medium text-natwest-primary hover:text-natwest-primary/80 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add New
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-xl bg-white/5">
                <p className="text-white/40 text-sm mb-3">No active schedules found.</p>
                {!isCreating && (
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Create your first schedule
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {schedules.map(s => (
                  <div key={s.schedule_id} className={`p-4 border rounded-xl flex flex-col gap-3 transition-colors ${s.enabled ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-white font-medium text-sm">
                          <Clock className="w-4 h-4 text-white/50" />
                          <span className="font-mono bg-black/30 px-2 py-0.5 rounded">{s.cron_expression}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleToggle(s)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${s.enabled ? 'bg-natwest-primary/20 text-natwest-primary border-natwest-primary/30 hover:bg-natwest-primary/30' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
                        >
                          {s.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button 
                          onClick={() => handleDelete(s.schedule_id)} 
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                          title="Delete Schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/60 text-xs">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{s.recipient_emails}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Form */}
          {isCreating && (
            <form onSubmit={handleCreate} className="p-5 bg-natwest-surface border border-natwest-primary/30 rounded-xl flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-natwest-primary"></div>
              <h3 className="text-sm font-semibold text-white mb-1">New Schedule</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60">Frequency</label>
                <select 
                  value={preset} 
                  onChange={e => setPreset(e.target.value)}
                  className="w-full bg-[#0a0714] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-natwest-primary"
                >
                  {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {preset === 'custom' && (
                <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2">
                  <label className="text-xs font-medium text-white/60">Cron Expression</label>
                  <input
                    type="text"
                    value={customCron}
                    onChange={e => setCustomCron(e.target.value)}
                    placeholder="* * * * *"
                    className="w-full bg-[#0a0714] border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-natwest-primary"
                    required
                  />
                  <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="text-[10px] text-natwest-teal hover:underline text-right">Need help with cron?</a>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/60">Recipient Emails (comma separated)</label>
                <input
                  type="text"
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
                  placeholder="analyst@example.com, team@example.com"
                  className="w-full bg-[#0a0714] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-natwest-primary"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !emails.trim() || (preset === 'custom' && !customCron.trim())}
                  className="flex items-center gap-2 px-4 py-2 bg-natwest-primary hover:bg-natwest-primary/80 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Schedule
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
