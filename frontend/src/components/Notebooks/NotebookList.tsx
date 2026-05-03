import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, FileText } from 'lucide-react';
import { NotebookSummary } from '../../types/notebook';
import { listNotebooks, createNotebook, deleteNotebook } from '../../services/notebookApi';

interface NotebookListProps {
  activeNotebookId?: string | null;
  onOpenNotebook: (id: string) => void;
  onDeleteNotebook?: (id: string) => void;
  refreshTrigger?: number;
}

export const NotebookList: React.FC<NotebookListProps> = ({ 
  activeNotebookId, onOpenNotebook, onDeleteNotebook = () => {}, refreshTrigger = 0 
}) => {
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      setIsLoading(true);
      const data = await listNotebooks();
      setNotebooks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [refreshTrigger]);

  const handleCreate = async () => {
    try {
      const nb = await createNotebook();
      setNotebooks([{ id: nb.id, title: nb.title, created_at: nb.created_at, updated_at: nb.updated_at, cell_count: 0 }, ...notebooks]);
      onOpenNotebook(nb.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotebook(id);
      setNotebooks(notebooks.filter(n => n.id !== id));
      setDeleteConfirmId(null);
      onDeleteNotebook(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mt-4 pt-2">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-1 py-2 text-white/50 hover:text-white/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-xs font-bold uppercase tracking-wider text-white/50">Notebooks</span>
        </div>
      </button>

      {isExpanded && (
        <div className="pb-2 space-y-1 mt-1">
          <button
            id="new-notebook-btn"
            onClick={handleCreate}
            className="w-full py-2 px-3 rounded-lg bg-natwest-teal hover:bg-natwest-teal/80 text-white shadow-lg shadow-natwest-teal/20 transition-all text-xs font-bold flex items-center justify-center gap-2 mb-2"
          >
            <Plus className="w-4 h-4" />
            New Notebook
          </button>

          {notebooks.map(nb => (
            <div
              key={nb.id}
              onClick={() => onOpenNotebook(nb.id)}
              className={`w-full text-left p-2.5 rounded-lg transition-all group cursor-pointer relative ${
                activeNotebookId === nb.id
                  ? 'bg-natwest-primary/20 border border-natwest-primary/40'
                  : 'bg-transparent border border-transparent hover:bg-white/5 hover:border-white/10'
              }`}
            >
              {deleteConfirmId === nb.id ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-white/80">Delete this notebook?</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => handleDelete(nb.id, e)}
                      className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded hover:bg-red-500/40"
                    >
                      Yes
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                      className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded hover:bg-white/20"
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${activeNotebookId === nb.id ? 'text-natwest-tealLight' : 'text-white/30 group-hover:text-white/50'}`} />
                    <span className={`text-sm font-medium truncate ${activeNotebookId === nb.id ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                      {nb.title}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50 group-hover:hidden">
                      {nb.cell_count} cells
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(nb.id); }}
                      className="hidden group-hover:flex p-1 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {notebooks.length === 0 && (
             <div className="text-center py-4 text-xs text-white/30 italic">
               No notebooks yet.
             </div>
          )}
        </div>
      )}
    </div>
  );
};
