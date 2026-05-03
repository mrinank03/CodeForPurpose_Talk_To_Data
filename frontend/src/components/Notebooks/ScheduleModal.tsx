import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2, Mail, Plus, Loader2, Power, PowerOff, Users } from 'lucide-react';
import { Schedule } from '../../types/schedule';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../services/scheduleApi';
import { ContactPicker } from '../Mailing/ContactPicker';

interface ScheduleModalProps {
  notebookId: string;
  onClose: () => void;
}

const FREQUENCY_OPTIONS = [
  { label: 'Every Hour', id: 'hourly' },
  { label: 'Daily', id: 'daily' },
  { label: 'Weekly', id: 'weekly' },
  { label: 'Monthly', id: 'monthly' },
];

const DAYS_OF_WEEK = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

/** Convert the simple time picker values into a cron expression */
function buildCron(frequency: string, hour: number, minute: number, dayOfWeek: number, dayOfMonth: number): string {
  switch (frequency) {
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'monthly':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

/** Convert a cron expression to a human-readable string */
function cronToHuman(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [min, hr, dom, , dow] = parts;

  if (hr === '*') return `Every hour at :${min.padStart(2, '0')}`;
  
  const time = `${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;

  if (dom !== '*') return `Monthly on day ${dom} at ${time}`;
  if (dow !== '*') {
    const dayNames: Record<string, string> = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };
    return `Every ${dayNames[dow] || dow} at ${time}`;
  }
  return `Daily at ${time}`;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ notebookId, onClose }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [frequency, setFrequency] = useState('daily');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [emails, setEmails] = useState('');
  const [selectedEmailsList, setSelectedEmailsList] = useState<string[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);
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
    if (selectedEmailsList.length === 0) return;

    const cronExpression = buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth);

    try {
      setIsSubmitting(true);
      await createSchedule({
        notebook_id: notebookId,
        cron_expression: cronExpression,
        recipient_emails: selectedEmailsList.join(','),
      });
      await fetchSchedules();
      setIsCreating(false);
      setSelectedEmailsList([]);
      setFrequency('daily');
      setHour(9);
      setMinute(0);
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

  const cronPreview = buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0714] border border-white/10 w-full max-w-xl rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 rounded-t-2xl">
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

        {/* Scrollable Content */}
        <div style={{ maxHeight: 'calc(85vh - 72px)', overflowY: 'auto' }} className="p-6 flex flex-col gap-6 custom-scrollbar">
          
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
                  <div key={s.schedule_id} className={`p-4 border rounded-xl flex flex-col gap-3 transition-all duration-200 ${s.enabled ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white text-sm font-medium">{cronToHuman(s.cron_expression)}</span>
                          <span className="font-mono text-[10px] text-white/30">{s.cron_expression}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* ── Highly Visible Enable/Disable Toggle ── */}
                        <button 
                          onClick={() => handleToggle(s)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                            s.enabled 
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600' 
                              : 'bg-orange-500/90 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600'
                          }`}
                        >
                          {s.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                          {s.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button 
                          onClick={() => handleDelete(s.schedule_id)} 
                          className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-1.5"
                          title="Delete Schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-white/60 text-xs mt-2 border-t border-white/5 pt-3">
                      <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-natwest-teal" />
                      <div className="flex flex-wrap gap-1.5">
                        {s.recipient_emails.split(',').map((email, idx) => (
                          <span key={idx} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[11px] text-white/80">
                            {email.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Form */}
          {isCreating && (
            <form onSubmit={handleCreate} className="p-5 bg-natwest-surface border border-natwest-primary/30 rounded-xl flex flex-col gap-5 relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-natwest-primary"></div>
              <h3 className="text-sm font-semibold text-white mb-1">New Schedule</h3>
              
              {/* ── Frequency Selector ── */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/60">Frequency</label>
                <div className="grid grid-cols-4 gap-2">
                  {FREQUENCY_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFrequency(opt.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 border ${
                        frequency === opt.id
                          ? 'bg-natwest-primary text-white border-natwest-primary shadow-lg shadow-natwest-primary/20'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Time Picker ── */}
              {frequency !== 'hourly' && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-medium text-white/60">Time</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={hour}
                      onChange={e => setHour(Number(e.target.value))}
                      className="bg-[#0a0714] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-natwest-primary w-24"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className="text-white/40 text-lg font-bold">:</span>
                    <select
                      value={minute}
                      onChange={e => setMinute(Number(e.target.value))}
                      className="bg-[#0a0714] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-natwest-primary w-24"
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ── Minute Picker (Hourly) ── */}
              {frequency === 'hourly' && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-medium text-white/60">Run at minute</label>
                  <select
                    value={minute}
                    onChange={e => setMinute(Number(e.target.value))}
                    className="bg-[#0a0714] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-natwest-primary w-32"
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                      <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Day of Week Picker (Weekly) ── */}
              {frequency === 'weekly' && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-medium text-white/60">Day of Week</label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDayOfWeek(d.value)}
                        className={`w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150 border ${
                          dayOfWeek === d.value
                            ? 'bg-natwest-primary text-white border-natwest-primary'
                            : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Day of Month Picker (Monthly) ── */}
              {frequency === 'monthly' && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-medium text-white/60">Day of Month</label>
                  <select
                    value={dayOfMonth}
                    onChange={e => setDayOfMonth(Number(e.target.value))}
                    className="bg-[#0a0714] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-natwest-primary w-32"
                  >
                    {Array.from({ length: 28 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Preview ── */}
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-natwest-teal flex-shrink-0" />
                <span className="text-xs text-natwest-teal font-medium">{cronToHuman(cronPreview)}</span>
                <span className="text-[10px] text-white/25 font-mono ml-auto">{cronPreview}</span>
              </div>

              {/* ── Emails ── */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/60">Recipients</label>
                <div className="bg-[#0a0714] border border-white/10 rounded-lg p-3 min-h-[60px] flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedEmailsList.length === 0 && (
                      <span className="text-sm text-white/30 italic">No recipients selected</span>
                    )}
                    {selectedEmailsList.map(email => (
                      <div key={email} className="flex items-center gap-1.5 bg-natwest-teal/20 border border-natwest-teal/30 px-2.5 py-1 rounded-md">
                        <Mail className="w-3 h-3 text-natwest-teal" />
                        <span className="text-xs text-natwest-tealLight font-medium">{email}</span>
                        <button 
                          type="button"
                          onClick={() => setSelectedEmailsList(prev => prev.filter(e => e !== email))}
                          className="ml-1 text-natwest-teal/50 hover:text-natwest-teal transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowContactPicker(true)}
                    className="self-start text-xs font-bold text-natwest-primary bg-natwest-primary/10 hover:bg-natwest-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Select Recipients
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-1">
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || selectedEmailsList.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-natwest-primary hover:bg-natwest-primary/80 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 shadow-lg shadow-natwest-primary/20"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Schedule
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {showContactPicker && (
        <ContactPicker 
          initialSelectedEmails={selectedEmailsList}
          onClose={() => setShowContactPicker(false)}
          onConfirm={(emails) => {
            setSelectedEmailsList(emails);
            setShowContactPicker(false);
          }}
        />
      )}
    </div>
  );
};
