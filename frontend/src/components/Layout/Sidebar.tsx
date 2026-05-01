import React, { useState } from 'react';
import { ConnectorBadge } from '../Connectors/ConnectorBadge';
import { NotebookList } from '../Notebooks/NotebookList';
import { Star, Archive, Trash2, Plus, MessageSquare, FileText, ChevronDown, ChevronRight, LayoutDashboard } from 'lucide-react';

export interface SessionItem {
  id: string;
  filename: string;
  upload_timestamp: string;
  row_count?: number;
  col_count?: number;
  is_starred?: boolean;
  is_archived?: boolean;
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
  onDeleteSession?: (id: string) => void;
  onUpdateSession?: (id: string, updates: { is_starred?: boolean; is_archived?: boolean }) => void;
}

function formatSessionName(filename: string): string {
  let name = filename.replace(/\.(csv|xlsx|xls)$/i, '');
  name = name.replace(/[_-]+/g, ' ');
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  if (name.length > 25) name = name.substring(0, 23) + '…';
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
  activeNotebookId = null, onOpenNotebook = () => {}, notebookRefreshTrigger = 0,
  onDeleteSession, onUpdateSession
}) => {
  const [showArchived, setShowArchived] = useState(false);

  if (isCollapsed) return null;

  const starredSessions = sessions.filter(s => s.is_starred && !s.is_archived);
  const activeSessions = sessions.filter(s => !s.is_starred && !s.is_archived);
  const archivedSessions = sessions.filter(s => s.is_archived);

  const renderSessionItem = (s: SessionItem) => {
    const isActive = activeSessionId === s.id;
    return (
      <div
        key={s.id}
        onClick={() => onSelectSession(s.id)}
        className={`w-full text-left p-2.5 rounded-lg transition-all group cursor-pointer relative ${
          isActive
            ? 'bg-natwest-primary/20 border border-natwest-primary/40'
            : 'bg-transparent border border-transparent hover:bg-white/5 hover:border-white/10'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden pr-2">
            <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-natwest-tealLight' : 'text-white/30 group-hover:text-white/50'}`} />
            <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
              {formatSessionName(s.filename)}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateSession?.(s.id, { is_starred: !s.is_starred }); }}
              className={`p-1.5 rounded transition-colors ${s.is_starred ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10' : 'text-white/30 hover:text-yellow-400 hover:bg-white/10'}`}
              title={s.is_starred ? "Unstar" : "Star"}
            >
              <Star className="w-3.5 h-3.5" fill={s.is_starred ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdateSession?.(s.id, { is_archived: !s.is_archived }); }}
              className={`p-1.5 rounded transition-colors ${s.is_archived ? 'text-natwest-teal hover:text-natwest-tealLight hover:bg-natwest-teal/10' : 'text-white/30 hover:text-white hover:bg-white/10'}`}
              title={s.is_archived ? "Unarchive" : "Archive"}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteSession?.(s.id); }}
              className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
      </div>
    );
  };

  return (
    <div className="w-72 border-r border-white/10 bg-[#0a0714] flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center font-bold text-white text-xs">DL</div>
        <h1 className="font-display font-bold text-lg text-white tracking-wide">DataLens</h1>
      </div>

      {/* Primary Actions Grid */}
      <div className="p-4 grid grid-cols-2 gap-3 border-b border-white/10 bg-white/[0.02]">
        <button
          onClick={onNewSession}
          className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-natwest-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <MessageSquare className="w-4 h-4 text-natwest-primary" />
          </div>
          <span className="text-[11px] font-semibold text-white/80 group-hover:text-white">Analysis Chat</span>
        </button>
        
        {/* We keep New Notebook logic inside NotebookList or trigger it from here if exposed. For now, it stays in NotebookList but we style NotebookList's button instead. Actually we'll just let NotebookList handle its own button. */}
        <button
          onClick={() => {
            // Emulate clicking the NotebookList new button by dispatching an event or we can just let NotebookList handle it below.
            const btn = document.getElementById('new-notebook-btn');
            if (btn) btn.click();
          }}
          className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-natwest-teal/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText className="w-4 h-4 text-natwest-teal" />
          </div>
          <span className="text-[11px] font-semibold text-white/80 group-hover:text-white">Data Notebook</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar flex flex-col gap-6">
        
        {/* Starred Sessions */}
        {starredSessions.length > 0 && (
          <div>
            <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-yellow-500" /> Starred
            </h2>
            <div className="space-y-1">
              {starredSessions.map(renderSessionItem)}
            </div>
          </div>
        )}

        {/* Active Sessions */}
        <div>
          <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
            <LayoutDashboard className="w-3 h-3" /> Recent Chats
          </h2>
          <div className="space-y-1">
            {activeSessions.length === 0 ? (
              <div className="text-center py-4 text-xs text-white/30 italic">No recent chats</div>
            ) : (
              activeSessions.map(renderSessionItem)
            )}
          </div>
        </div>

        {/* Notebooks List Container */}
        <div>
          <NotebookList 
            activeNotebookId={activeNotebookId}
            onOpenNotebook={onOpenNotebook}
            refreshTrigger={notebookRefreshTrigger}
          />
        </div>

        {/* Archived Sessions */}
        {archivedSessions.length > 0 && (
          <div className="mt-auto pt-4 border-t border-white/5">
            <button 
              onClick={() => setShowArchived(!showArchived)}
              className="w-full flex items-center justify-between px-1 py-2 text-white/40 hover:text-white/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                {showArchived ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1">
                  <Archive className="w-3 h-3" /> Archived
                </span>
              </div>
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">{archivedSessions.length}</span>
            </button>
            
            {showArchived && (
              <div className="space-y-1 mt-2">
                {archivedSessions.map(renderSessionItem)}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Database Connector Section */}
      <div className="border-t border-white/10 bg-[#0a0714]">
        {connectorInfo ? (
          <ConnectorBadge
            connectionName={connectorInfo.connectionName}
            dbType={connectorInfo.dbType}
            lastSyncedAt={connectorInfo.lastSyncedAt}
            onDisconnect={onDisconnect}
          />
        ) : (
          <div className="p-4">
            <button
              onClick={onOpenConnector}
              className="w-full py-2.5 px-4 rounded-xl bg-natwest-primary/10 hover:bg-natwest-primary/20 border border-natwest-primary/30 hover:border-natwest-primary/50 text-white/90 transition-all text-sm font-medium flex items-center justify-center gap-2"
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
