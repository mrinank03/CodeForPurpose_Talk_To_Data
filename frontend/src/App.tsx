import React, { useEffect } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { FileUploader } from './components/Upload/FileUploader';
import { StoryCards } from './components/Story/StoryCards';
import { ChatWindow } from './components/Chat/ChatWindow';

import { useSession } from './hooks/useSession';
import { useStory } from './hooks/useStory';
import { useChat } from './hooks/useChat';

const App: React.FC = () => {
  const { 
    sessionId, meta, metricDict, profile, 
    uploadFile, isUploading, uploadProgress, 
    allSessions, fetchSessions, loadSession, resetSession,
    suggestedQuestions, setSuggestedQuestions,
    precomputedInsights
  } = useSession();

  const { cards, runStory, isLoading: isStoryLoading, clearStory } = useStory(sessionId, precomputedInsights);
  const { messages, sendMessage, isLoading: isChatLoading, clearChat, setInitialMessages } = useChat(sessionId);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSelectSession = async (id: string) => {
    const data = await loadSession(id);
    if (data && data.messages) {
      setInitialMessages(data.messages);
      // For a real app, we'd also hydrate the meta here but MVP just needs chat
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
  };

  const handleUpload = async (file: File) => {
    try {
      await uploadFile(file);
      // Upload sets the new session ID automatically internally
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-natwest-bg text-natwest-textPrimary">
      <Sidebar 
        sessions={allSessions}
        activeSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        isCollapsed={false}
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        <div className="flex-1 p-6 md:p-8 flex flex-col h-full overflow-hidden">
          {!sessionId || (!meta && messages.length === 0) ? (
            <div className="max-w-2xl mx-auto mt-20">
              <FileUploader 
                onUpload={handleUpload}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
              />
            </div>
          ) : (
            <div className="flex h-full w-full pointer-events-auto">
              {/* Left Side: Chat Area */}
              <div className="flex-1 flex flex-col h-full min-w-0 bg-transparent pr-4">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h3 className="font-bold font-display text-[22px] text-white">DataLens</h3>
                  {cards.length === 0 && messages.length > 0 && (
                    <button 
                      onClick={runStory}
                      disabled={isStoryLoading}
                      className="px-5 py-2.5 bg-gradient-to-r from-natwest-primary to-natwest-teal rounded-full text-sm font-bold text-white transition-all disabled:opacity-50 shadow-[0_0_18px_rgba(134,110,255,0.45)] hover:shadow-[0_0_28px_rgba(134,110,255,0.7)] hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                      {isStoryLoading ? 'Analyzing...' : 'Generate AI Insights'}
                    </button>
                  )}
                </div>
                <div className="flex-1 min-h-0 bg-transparent">
                   <ChatWindow 
                      messages={messages} 
                      isLoading={isChatLoading} 
                      onSend={sendMessage}
                      suggestedQuestions={meta ? suggestedQuestions : []}
                      onGenerateInsights={cards.length === 0 && messages.length === 0 ? runStory : undefined}
                      isStoryLoading={isStoryLoading}
                    />
                </div>
              </div>

              {/* Right Side: Insights Area */}
              {cards.length > 0 && (
                <div className="w-full md:w-[420px] xl:w-[460px] h-full flex flex-col flex-shrink-0 border-l border-white/10 pl-5 relative">
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
