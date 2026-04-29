import React from 'react';
import { ConnectorBadge } from '../Connectors/ConnectorBadge';
import { NotebookList } from '../Notebooks/NotebookList';

interface SessionItem {
  id: string;
  filename: string;
  upload_timestamp: string;
  row_count?: number;
  col_count?: number;
}

interface SidebarProps {
  sessions: SessionItem[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  isCollapsed: boolean;
  onOpenConnector: () => void;
  connectorInfo: { connectionName: string; dbType: string; lastSyncedAt: string | null } | null;
  onDisconnect: () => void;
  activeNotebookId?: string | null;
  onOpenNotebook?: (id: string) => void;
  notebookRefreshTrigger?: number;
}

function formatSessionName(filename: string): string {
  // Remove extension
  let name = filename.replace(/\.(csv|xlsx|xls)$/i, '');
  // Replace underscores/hyphens with spaces
  name = name.replace(/[_-]+/g, ' ');
  // Title case
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  // Truncate if too long
  if (name.length > 28) name = name.substring(0, 26) + '…';
  return name;
}

function formatRelativeDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, activeSessionId, onSelectSession, onNewSession, isCollapsed, onOpenConnector, connectorInfo, onDisconnect,
  activeNotebookId = null, onOpenNotebook = () => {}, notebookRefreshTrigger = 0
}) => {
  if (isCollapsed) return null;

  return (
    <div className="w-64 border-r border-white/10 bg-[#0a0714] flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center font-bold text-white text-xs">DL</div>
        <h1 className="font-display font-bold text-lg text-white">DataLens</h1>
      </div>

      {/* New Session Button */}
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white transition-all text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Analysis
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
        <h2 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2 px-1">History</h2>
        <div className="space-y-1">
          {sessions.map(s => {
            const isActive = activeSessionId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`w-full text-left p-2.5 rounded-lg transition-all group ${
                  isActive
                    ? 'bg-natwest-primary/20 border border-natwest-primary/40'
                    : 'bg-transparent border border-transparent hover:bg-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-natwest-tealLight' : 'text-white/30 group-hover:text-white/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                    {formatSessionName(s.filename)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 pl-5">
                  <span className="text-[10px] text-white/30">
                    {formatRelativeDate(s.upload_timestamp)}
                  </span>
                  {s.row_count && (
                    <span className="text-[10px] text-white/20">
                      · {s.row_count.toLocaleString()} rows
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        <NotebookList 
          activeNotebookId={activeNotebookId}
          onOpenNotebook={onOpenNotebook}
          refreshTrigger={notebookRefreshTrigger}
        />
      </div>

      {/* Database Connector Section */}
      <div className="border-t border-white/10">
        {connectorInfo ? (
          <ConnectorBadge
            connectionName={connectorInfo.connectionName}
            dbType={connectorInfo.dbType}
            lastSyncedAt={connectorInfo.lastSyncedAt}
            onDisconnect={onDisconnect}
          />
        ) : (
          <div className="p-3">
            <button
              onClick={onOpenConnector}
              className="w-full py-2.5 px-4 rounded-lg bg-natwest-primary/10 hover:bg-natwest-primary/20 border border-natwest-primary/30 hover:border-natwest-primary/50 text-white/80 hover:text-white transition-all text-sm font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
              </svg>
              Connect Database
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
