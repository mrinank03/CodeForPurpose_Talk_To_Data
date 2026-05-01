import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Play, Save, Plus, Loader2, Database, Clock } from 'lucide-react';
import { Notebook, NotebookCell, CellType } from '../../types/notebook';
import { saveNotebook, runCell } from '../../services/notebookApi';
import { CellWrapper } from './cells/CellWrapper';
import { TextCell } from './cells/TextCell';
import { PromptCell } from './cells/PromptCell';
import { CodeCell } from './cells/CodeCell';
import { FileUploader } from '../Upload/FileUploader';
import { ScheduleModal } from './ScheduleModal';

interface NotebookEditorProps {
  initialNotebook: Notebook;
  onBack: () => void;
  onUpdateSummary: (notebook: Notebook) => void;
  onUploadFile: (file: File) => Promise<string | void>;
  onOpenConnector: () => void;
  isUploading: boolean;
  uploadProgress: number;
}

export const NotebookEditor: React.FC<NotebookEditorProps> = ({
  initialNotebook, onBack, onUpdateSummary, onUploadFile, onOpenConnector, isUploading, uploadProgress
}) => {
  const [notebook, setNotebook] = useState<Notebook>(initialNotebook);
  const [draggedCellId, setDraggedCellId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(notebook.title);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setNotebook(initialNotebook);
    setTitleInput(initialNotebook.title);
  }, [initialNotebook]);

  const handleSave = async (nb = notebook) => {
    setIsSaving(true);
    try {
      const saved = await saveNotebook(nb.id, nb.title, nb.cells, nb.session_id);
      setNotebook(saved);
      onUpdateSummary(saved);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (e) {
      setSaveMessage('Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      handleSave(notebook);
    }, 30000);
    return () => clearInterval(interval);
  }, [notebook]);

  useEffect(() => {
    if (titleInput !== notebook.title) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setNotebook(prev => {
          const nb = { ...prev, title: titleInput };
          handleSave(nb);
          return nb;
        });
      }, 800);
    }
  }, [titleInput]);

  const handleTitleBlur = () => {
    setTitleEditing(false);
    if (titleInput !== notebook.title) {
      setNotebook(prev => {
        const nb = { ...prev, title: titleInput };
        handleSave(nb);
        return nb;
      });
    }
  };

  const handleAddCell = (type: CellType) => {
    setNotebook(prev => ({
      ...prev,
      cells: [...prev.cells, { id: uuidv4(), type, content: '' }]
    }));
  };

  const handleDeleteCell = (id: string) => {
    setNotebook(prev => {
      const nb = { ...prev, cells: prev.cells.filter(c => c.id !== id) };
      handleSave(nb);
      return nb;
    });
  };

  const handleCellContentChange = (id: string, content: string) => {
    setNotebook(prev => ({
      ...prev,
      cells: prev.cells.map(c => c.id === id ? { ...c, content } : c)
    }));
  };

  const handleResultUpdate = (id: string, result: any, resultType: string) => {
    setNotebook(prev => ({
      ...prev,
      cells: prev.cells.map(c => c.id === id ? { ...c, result, result_type: resultType as any } : c)
    }));
  };

  const handleDragStart = (id: string) => {
    setDraggedCellId(id);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedCellId || draggedCellId === targetId) return;
    setNotebook(prev => {
      const draggedIndex = prev.cells.findIndex(c => c.id === draggedCellId);
      const targetIndex = prev.cells.findIndex(c => c.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const newCells = [...prev.cells];
      const [draggedCell] = newCells.splice(draggedIndex, 1);
      newCells.splice(targetIndex, 0, draggedCell);
      
      const nb = { ...prev, cells: newCells };
      handleSave(nb);
      return nb;
    });
    setDraggedCellId(null);
  };

  const handleRunAll = async () => {
    if (runProgress) return;
    const runnableCells = notebook.cells.filter(c => c.type !== 'text');
    if (runnableCells.length === 0) return;

    setRunProgress({ current: 0, total: runnableCells.length });
    
    for (let i = 0; i < runnableCells.length; i++) {
      setRunProgress({ current: i + 1, total: runnableCells.length });
      const cell = runnableCells[i];
      if (!cell.content.trim()) {
        handleResultUpdate(cell.id, { error: 'Cell is empty' }, 'text');
        continue;
      }
      try {
        const data = await runCell(notebook.id, cell);
        if (data.error) {
          handleResultUpdate(cell.id, { error: data.error }, 'text');
        } else {
          handleResultUpdate(cell.id, data.result, data.result_type);
        }
      } catch (e: any) {
        handleResultUpdate(cell.id, { error: e.message }, 'text');
      }
    }
    setRunProgress(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0714] w-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-[#0a0714]/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-white/50 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          
          {titleEditing ? (
            <input
              autoFocus
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
              className="bg-transparent text-xl font-display font-bold text-white outline-none border-b border-natwest-primary/50 w-64 px-1"
            />
          ) : (
            <h2 
              onClick={() => setTitleEditing(true)}
              className="text-xl font-display font-bold text-white cursor-text hover:text-white/80 transition-colors px-1"
            >
              {notebook.title}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-3">
          {runProgress && (
            <span className="text-sm text-natwest-teal font-medium mr-2 animate-pulse">
              Running cell {runProgress.current} of {runProgress.total}...
            </span>
          )}
          {saveMessage && (
            <span className="text-xs text-white/50 mr-2">{saveMessage}</span>
          )}
          
          <button
            onClick={() => handleSave()}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/90 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          
          <button
            onClick={() => setShowScheduleModal(true)}
            disabled={!notebook.session_id}
            title={notebook.session_id ? "Schedule Report" : "Connect a data source first"}
            className="flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Clock className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleRunAll}
            disabled={!!runProgress}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-natwest-primary/20 hover:bg-natwest-primary/40 text-natwest-primary text-sm font-bold transition-colors disabled:opacity-50"
          >
            {runProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run All
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {!notebook.session_id && (
          <div className="mb-8 max-w-4xl mx-auto">
             <div className="bg-natwest-surface border-2 border-natwest-primary/30 p-8 rounded-xl shadow-[0_0_30px_rgba(134,110,255,0.15)] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-natwest-primary"></div>
               <h3 className="text-xl font-display font-bold text-white mb-2">Connect a Data Source</h3>
               <p className="text-white/60 text-sm mb-6">Before you can run prompts or SQL cells, this Notebook needs a dataset or database connection.</p>
               
               <FileUploader 
                 onUpload={async (f) => {
                   const sid = await onUploadFile(f);
                   if (sid) {
                     setNotebook(prev => {
                       const nb = { ...prev, session_id: sid };
                       handleSave(nb);
                       return nb;
                     });
                   }
                 }} 
                 isUploading={isUploading} 
                 uploadProgress={uploadProgress} 
               />
               
               <div className="flex items-center gap-4 my-6">
                 <div className="flex-1 h-px bg-white/10" />
                 <span className="text-white/30 text-xs font-medium uppercase tracking-widest">or</span>
                 <div className="flex-1 h-px bg-white/10" />
               </div>

               <button
                 onClick={onOpenConnector}
                 className="w-full py-4 px-6 rounded-xl bg-[#0a0714] border border-white/10 hover:border-natwest-primary hover:bg-white/5 transition-all group flex items-center justify-center gap-3"
               >
                 <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Database className="w-5 h-5 text-natwest-teal" />
                 </div>
                 <div className="text-left">
                   <p className="text-white font-bold text-sm">Connect External Database</p>
                   <p className="text-white/40 text-xs">PostgreSQL or MySQL</p>
                 </div>
               </button>
             </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          {notebook.cells.map((cell) => (
            <CellWrapper
              key={cell.id}
              cell={cell}
              onDelete={handleDeleteCell}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            >
              {cell.type === 'text' && (
                <TextCell cell={cell} onChange={handleCellContentChange} />
              )}
              {cell.type === 'prompt' && (
                <PromptCell 
                  cell={cell} 
                  notebookId={notebook.id}
                  sessionId={notebook.session_id}
                  onChange={handleCellContentChange}
                  onResultUpdate={handleResultUpdate}
                />
              )}
              {cell.type === 'code' && (
                <CodeCell 
                  cell={cell} 
                  notebookId={notebook.id}
                  sessionId={notebook.session_id}
                  onChange={handleCellContentChange}
                  onResultUpdate={handleResultUpdate}
                />
              )}
            </CellWrapper>
          ))}

          {/* Add Cell Row */}
          <div className="flex items-center justify-center gap-4 mt-8 pb-12">
            <button onClick={() => handleAddCell('text')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-all border border-white/10">
              <Plus className="w-4 h-4" /> Text
            </button>
            <button onClick={() => handleAddCell('prompt')} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-natwest-medium to-natwest-light hover:from-natwest-light hover:to-natwest-light text-white text-sm font-medium transition-all shadow-lg shadow-natwest-primary/40 transform hover:-translate-y-0.5 border border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <Plus className="w-4 h-4 relative z-10" /> 
              <span className="relative z-10">Prompt</span>
            </button>
            <button onClick={() => handleAddCell('code')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 text-sm font-medium transition-all border border-blue-500/20">
              <Plus className="w-4 h-4" /> Code
            </button>
          </div>
        </div>
      </div>
      
      {showScheduleModal && (
        <ScheduleModal
          notebookId={notebook.id}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
};
