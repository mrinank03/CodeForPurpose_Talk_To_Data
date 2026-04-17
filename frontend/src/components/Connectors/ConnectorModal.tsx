// 4-step database connection wizard modal.
// Steps: form -> table_select -> mirroring -> connected
// All step state is managed locally with useState.

import React, { useState } from 'react';
import { ConnectorFormData, ConnectorStep, DbType, TableInfo } from '../../types/connector';
import { testConnection, connectDatabase, mirrorTables } from '../../services/connectorApi';

interface Props {
  sessionId: string;
  onClose: () => void;
  onConnected: (connectionName: string, dbType: string) => void;
}

const DEFAULT_FORM: ConnectorFormData = {
  connectionName: '',
  dbType: 'postgresql',
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
};

export const ConnectorModal: React.FC<Props> = ({ sessionId, onClose, onConnected }) => {
  const [step, setStep] = useState<ConnectorStep>('form');
  const [form, setForm] = useState<ConnectorFormData>(DEFAULT_FORM);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [mirrorResults, setMirrorResults] = useState<Array<{ table: string; rows_mirrored: number; status: string; error?: string }>>([]);
  const [error, setError] = useState('');
  const [testPassed, setTestPassed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auto-fill port when db type changes
  const handleDbTypeChange = (dbType: DbType) => {
    setForm(prev => ({
      ...prev,
      dbType,
      port: dbType === 'postgresql' ? 5432 : 3306,
    }));
    setTestPassed(false);
  };

  const handleTestConnection = async () => {
    setError('');
    setIsProcessing(true);
    try {
      await testConnection(form);
      setTestPassed(true);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Connection test failed');
      setTestPassed(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueToTables = async () => {
    setError('');
    setIsProcessing(true);
    try {
      const res = await connectDatabase(sessionId, form);
      setTables(res.tables.map((t: string) => ({ name: t, selected: false })));
      setStep('table_select');
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to connect');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTable = (name: string) => {
    setTables(prev => prev.map(t => t.name === name ? { ...t, selected: !t.selected } : t));
  };

  const selectAll = () => setTables(prev => prev.map(t => ({ ...t, selected: true })));
  const clearAll = () => setTables(prev => prev.map(t => ({ ...t, selected: false })));

  const handleMirror = async () => {
    const selected = tables.filter(t => t.selected).map(t => t.name);
    if (selected.length === 0) return;

    setStep('mirroring');
    setIsProcessing(true);
    setError('');
    try {
      const res = await mirrorTables(sessionId, selected);
      setMirrorResults(res.tables);
      setStep('connected');
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Mirroring failed');
      setStep('table_select');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    onConnected(form.connectionName, form.dbType);
    onClose();
  };

  const selectedCount = tables.filter(t => t.selected).length;
  const filteredTables = tables.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-natwest-surface border border-natwest-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-natwest-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Connect Database</h2>
              <p className="text-white/40 text-xs">
                {step === 'form' && 'Enter your credentials'}
                {step === 'table_select' && 'Select tables to mirror'}
                {step === 'mirroring' && 'Mirroring in progress...'}
                {step === 'connected' && 'Connection established'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Credentials Form */}
          {step === 'form' && (
            <div className="space-y-3">
              <div>
                <label className="block text-white/60 text-xs mb-1">Connection Name</label>
                <input
                  value={form.connectionName}
                  onChange={e => setForm(p => ({ ...p, connectionName: e.target.value }))}
                  placeholder="e.g. Production Analytics"
                  className="w-full bg-natwest-bg border border-natwest-border rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-natwest-teal"
                />
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1">Database Type</label>
                <div className="flex gap-2">
                  {(['postgresql', 'mysql'] as DbType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleDbTypeChange(t)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                        form.dbType === t
                          ? 'bg-natwest-primary/30 border-natwest-primary text-white'
                          : 'bg-natwest-bg border-natwest-border text-white/50 hover:border-white/20'
                      }`}
                    >
                      {t === 'postgresql' ? 'PostgreSQL' : 'MySQL'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-white/60 text-xs mb-1">Host</label>
                  <input
                    value={form.host}
                    onChange={e => setForm(p => ({ ...p, host: e.target.value }))}
                    placeholder="db.example.com"
                    className="w-full bg-natwest-bg border border-natwest-border rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-natwest-teal"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-xs mb-1">Port</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={e => setForm(p => ({ ...p, port: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-natwest-bg border border-natwest-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-natwest-teal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1">Database Name</label>
                <input
                  value={form.database}
                  onChange={e => setForm(p => ({ ...p, database: e.target.value }))}
                  placeholder="analytics_db"
                  className="w-full bg-natwest-bg border border-natwest-border rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-natwest-teal"
                />
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1">Username</label>
                <input
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="db_user"
                  className="w-full bg-natwest-bg border border-natwest-border rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-natwest-teal"
                />
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-natwest-bg border border-natwest-border rounded-lg px-3 py-2.5 pr-10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-natwest-teal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      ) : (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Test connection result */}
              {testPassed && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Connection successful
                </div>
              )}
            </div>
          )}

          {/* Step 2: Table Selection */}
          {step === 'table_select' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">{tables.length} tables found · {selectedCount} selected</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-natwest-tealLight hover:underline">Select All</button>
                  <button onClick={clearAll} className="text-xs text-white/40 hover:underline">Clear</button>
                </div>
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tables..."
                className="w-full bg-natwest-bg border border-natwest-border rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-natwest-teal"
              />
              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                {filteredTables.map(t => (
                  <label
                    key={t.name}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      t.selected ? 'bg-natwest-primary/20 border border-natwest-primary/40' : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={t.selected}
                      onChange={() => toggleTable(t.name)}
                      className="accent-natwest-teal w-4 h-4"
                    />
                    <span className="text-white/80 text-sm font-mono">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Mirroring Progress */}
          {step === 'mirroring' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-10 h-10 border-3 border-natwest-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 text-sm">Mirroring tables into DataLens...</p>
            </div>
          )}

          {/* Step 4: Connected */}
          {step === 'connected' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-green-400 font-bold text-sm">All tables mirrored successfully</span>
              </div>
              {mirrorResults.map(r => (
                <div key={r.table} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                  <span className="text-white/80 text-sm font-mono">{r.table}</span>
                  <span className={`text-xs ${r.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                    {r.status === 'ok' ? `${r.rows_mirrored.toLocaleString()} rows` : 'Failed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-natwest-border flex justify-end gap-2">
          {step === 'form' && (
            <>
              {!testPassed ? (
                <button
                  onClick={handleTestConnection}
                  disabled={isProcessing || !form.host || !form.database || !form.username}
                  className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-all disabled:opacity-40"
                >
                  {isProcessing ? 'Testing...' : 'Test Connection'}
                </button>
              ) : (
                <button
                  onClick={handleContinueToTables}
                  disabled={isProcessing || !form.connectionName}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-natwest-primary to-natwest-teal text-white text-sm font-bold transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(134,110,255,0.3)]"
                >
                  {isProcessing ? 'Connecting...' : 'Continue'}
                </button>
              )}
            </>
          )}

          {step === 'table_select' && (
            <button
              onClick={handleMirror}
              disabled={selectedCount === 0 || isProcessing}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-natwest-primary to-natwest-teal text-white text-sm font-bold transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(134,110,255,0.3)]"
            >
              Mirror {selectedCount} Table{selectedCount !== 1 ? 's' : ''}
            </button>
          )}

          {step === 'connected' && (
            <button
              onClick={handleFinish}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-natwest-primary to-natwest-teal text-white text-sm font-bold transition-all shadow-[0_0_15px_rgba(134,110,255,0.3)]"
            >
              Start Analysing
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
