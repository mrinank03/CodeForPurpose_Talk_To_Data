// Shows the active connection name and a sync status indicator.
// Clicking "Disconnect" calls the disconnect API and clears the state.

import React from 'react';

interface ConnectorBadgeProps {
  connectionName: string;
  dbType: string;
  lastSyncedAt: string | null;
  onDisconnect: () => void;
}

export const ConnectorBadge: React.FC<ConnectorBadgeProps> = ({
  connectionName,
  dbType,
  lastSyncedAt,
  onDisconnect,
}) => {
  return (
    <div className="mx-3 mb-3 p-3 rounded-xl bg-natwest-primary/15 border border-natwest-primary/30">
      <div className="flex items-center gap-2 mb-1.5">
        {/* Database icon */}
        <svg className="w-4 h-4 text-natwest-tealLight flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
        <span className="text-white text-xs font-bold truncate">{connectionName}</span>
      </div>

      <div className="flex items-center justify-between pl-6">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/40 text-[10px]">Live sync on</span>
        </div>
        <button
          onClick={onDisconnect}
          className="text-red-400/60 hover:text-red-400 text-[10px] hover:underline transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};
