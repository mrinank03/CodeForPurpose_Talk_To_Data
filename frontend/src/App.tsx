import React, { useEffect, useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Layout/Sidebar';
import { FileUploader } from './components/Upload/FileUploader';
import { StoryCards } from './components/Story/StoryCards';
import { ChatWindow } from './components/Chat/ChatWindow';
import { ConnectorModal } from './components/Connectors/ConnectorModal';
import { ColumnSelectorModal } from './components/Report/ColumnSelectorModal';
import { ReportView } from './components/Report/ReportView';

import { useSession } from './hooks/useSession';
import { useStory } from './hooks/useStory';
import { useChat } from './hooks/useChat';
import { disconnect as disconnectApi } from './services/connectorApi';

const App: React.FC = () => {
  const { 
    sessionId, meta, metricDict, profile, 
    uploadFile, isUploading, uploadProgress, 
    allSessions, fetchSessions, loadSession, resetSession,
    suggestedQuestions, setSuggestedQuestions,
    precomputedInsights, activateSession
  } = useSession();

  // Generate a stable session ID for the connector modal when no session exists yet
  const [connectorSessionId] = useState(() => uuidv4());

  const { cards, runStory, isLoading: isStoryLoading, clearStory, reportData, runReport, isReportLoading, reportColumns } = useStory(sessionId, precomputedInsights);
  const { messages, sendMessage, isLoading: isChatLoading, clearChat, setInitialMessages } = useChat(sessionId);

  // Report column selector modal state
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Connector state
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  const [connectorInfo, setConnectorInfo] = useState<{
    connectionName: string;
    dbType: string;
    lastSyncedAt: string | null;
  } | null>(null);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSelectSession = async (id: string) => {
    const data = await loadSession(id);
    if (data && data.messages) {
      setInitialMessages(data.messages);
    } else {
      clearChat();
    }
    clearStory();
  };

  const handleNewSession = () => {
    resetSession();
    clearChat();
    clearStory();
    setSuggestedQuestions([]);
    setConnectorInfo(null);
  };

  const handleUpload = async (file: File) => {
    try {
      await uploadFile(file);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnected = (connectionName: string, dbType: string) => {
    setConnectorInfo({ connectionName, dbType, lastSyncedAt: null });
    // Activate the session so chat UI appears
    const activeId = sessionId || connectorSessionId;
    activateSession(activeId);
  };

  const handleDisconnect = async () => {
    if (sessionId) {
      try {
        await disconnectApi(sessionId);
      } catch (e) {
        console.error('Disconnect failed:', e);
      }
    }
    setConnectorInfo(null);
  };

  // Determine if chat should be shown:
  // Either we have uploaded data (meta exists) OR a database is connected
  const hasDataSource = !!meta || !!connectorInfo;
  const showChat = !!sessionId && (hasDataSource || messages.length > 0);

  return (
    <div className="flex h-screen bg-natwest-bg text-natwest-textPrimary">
      <Sidebar 
        sessions={allSessions}
        activeSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        isCollapsed={false}
        onOpenConnector={() => setShowConnectorModal(true)}
        connectorInfo={connectorInfo}
        onDisconnect={handleDisconnect}
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        <div className="flex-1 p-6 md:p-8 flex flex-col h-full overflow-hidden">
          {!showChat ? (
            /* ─── Landing: Upload + Connect Database ─── */
            <div className="max-w-2xl mx-auto mt-20 w-full">
              <FileUploader 
                onUpload={handleUpload}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
              />

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs font-medium uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Connect Database — prominent in the center */}
              <button
                onClick={() => setShowConnectorModal(true)}
                className="w-full py-4 px-6 rounded-xl bg-natwest-surface border-2 border-dashed border-natwest-primary/40 hover:border-natwest-primary hover:bg-natwest-primary/10 transition-all group flex items-center justify-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">Connect External Database</p>
                  <p className="text-white/40 text-xs">PostgreSQL or MySQL — mirror tables and query with AI</p>
                </div>
                <svg className="w-5 h-5 text-white/20 group-hover:text-white/50 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          ) : (
            /* ─── Active Session: Chat + Insights ─── */
            <div className="flex h-full w-full pointer-events-auto">
              {/* Left Side: Chat Area */}
              <div className="flex-1 flex flex-col h-full min-w-0 bg-transparent pr-4">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold font-display text-[22px] text-white">DataLens</h3>
                    {/* Show connected DB badge inline when a connector is active */}
                    {connectorInfo && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-natwest-primary/15 border border-natwest-primary/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-white/70 text-xs font-medium">{connectorInfo.connectionName}</span>
                      </div>
                    )}
                  </div>
                  {cards.length === 0 && !reportData && messages.length > 0 && (
                    <button 
                      onClick={() => setShowColumnSelector(true)}
                      disabled={isReportLoading}
                      className="px-5 py-2.5 bg-gradient-to-r from-natwest-primary to-natwest-teal rounded-full text-sm font-bold text-white transition-all disabled:opacity-50 shadow-[0_0_18px_rgba(134,110,255,0.45)] hover:shadow-[0_0_28px_rgba(134,110,255,0.7)] hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                      {isReportLoading ? 'Generating Report...' : 'Generate AI Insights'}
                    </button>
                  )}
                </div>
                <div className="flex-1 min-h-0 bg-transparent">
                   <ChatWindow 
                      messages={messages} 
                      isLoading={isChatLoading} 
                      onSend={sendMessage}
                      suggestedQuestions={meta ? suggestedQuestions : []}
                      onGenerateInsights={cards.length === 0 && !reportData && messages.length === 0 ? () => setShowColumnSelector(true) : undefined}
                      isStoryLoading={isReportLoading}
                    />
                </div>
              </div>

              {/* Right Side: Report or Legacy Insights */}
              {(reportData || cards.length > 0) && (
                <div className="w-full md:w-[420px] xl:w-[460px] h-full flex flex-col flex-shrink-0 border-l border-white/10 pl-5 relative">
                  {reportData ? (
                    <ReportView
                      report={reportData}
                      sessionId={sessionId!}
                      selectedColumns={reportColumns}
                      onClose={clearStory}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                            </svg>
                          </div>
                          <h3 className="font-bold font-display text-base text-white">AI Insights</h3>
                        </div>
                        <button 
                          onClick={clearStory}
                          className="text-white/30 hover:text-white/70 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 pr-1 space-y-3">
                        <StoryCards cards={cards} isLoading={isStoryLoading} onDrillIn={sendMessage} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connector Modal */}
      {showConnectorModal && (
        <ConnectorModal
          sessionId={sessionId || connectorSessionId}
          onClose={() => setShowConnectorModal(false)}
          onConnected={handleConnected}
        />
      )}

      {/* Column Selector Modal for Report */}
      {showColumnSelector && sessionId && (
        <ColumnSelectorModal
          sessionId={sessionId}
          onClose={() => setShowColumnSelector(false)}
          onGenerate={(cols) => {
            setShowColumnSelector(false);
            runReport(cols);
          }}
          isLoading={isReportLoading}
        />
      )}
    </div>
  );
};

export default App;
