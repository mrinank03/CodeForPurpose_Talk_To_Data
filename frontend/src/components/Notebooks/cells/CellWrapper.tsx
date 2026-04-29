import React, { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { NotebookCell } from '../../../types/notebook';

interface CellWrapperProps {
  cell: NotebookCell;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDrop: (targetId: string) => void;
  children: React.ReactNode;
}

export const CellWrapper: React.FC<CellWrapperProps> = ({
  cell,
  onDelete,
  onDragStart,
  onDrop,
  children
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStartEvent = (e: React.DragEvent) => {
    // Only set standard drag data to please HTML5 drag and drop
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(cell.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(cell.id);
  };

  // Colour-coded badges based on type
  let badgeColor = '';
  if (cell.type === 'prompt') badgeColor = 'bg-natwest-primary';
  else if (cell.type === 'code') badgeColor = 'bg-blue-500';
  else badgeColor = 'bg-gray-500';

  return (
    <div
      className={`relative group bg-natwest-surface border rounded-xl mb-4 transition-colors ${
        isDragOver ? 'border-t-2 border-t-natwest-primary border-x-white/10 border-b-white/10' : 'border-white/10'
      }`}
      draggable={true}
      onDragStart={handleDragStartEvent}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`absolute -left-[1px] top-4 w-1 h-6 rounded-r-md ${badgeColor}`} />

      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <div className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 transition-colors">
            <GripVertical className="w-4 h-4" />
          </div>
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
            {cell.type}
          </span>
        </div>
        <button
          onClick={() => onDelete(cell.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10"
          title="Delete cell"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 pt-1">
        {children}
      </div>
    </div>
  );
};
