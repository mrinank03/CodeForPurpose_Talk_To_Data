import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Check } from 'lucide-react';
import { NotebookCell } from '../../../types/notebook';

interface TextCellProps {
  cell: NotebookCell;
  onChange: (id: string, content: string) => void;
}

export const TextCell: React.FC<TextCellProps> = ({ cell, onChange }) => {
  const [isEditing, setIsEditing] = useState(cell.content === '');
  const [content, setContent] = useState(cell.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state if cell content changes from outside
  useEffect(() => {
    if (!isEditing) {
      setContent(cell.content);
    }
  }, [cell.content, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`;
    }
  }, [isEditing]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    if (content !== cell.content) {
      onChange(cell.id, content);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize as you type
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`;
    }
  };

  if (isEditing) {
    return (
      <div className="relative group/text">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onBlur={(e) => {
            // Prevent blur if we clicked the check button
            if (e.relatedTarget?.getAttribute('data-check-btn')) return;
            handleFinishEditing();
          }}
          placeholder="Type markdown or HTML here... (e.g. # Heading, <b>Bold</b>)"
          className="w-full bg-[#1A1525] border border-natwest-primary/30 rounded-lg outline-none text-white/90 resize-none font-sans text-sm min-h-[80px] focus:ring-1 focus:ring-natwest-primary p-3 pr-10 transition-all"
        />
        <button
          data-check-btn="true"
          onClick={handleFinishEditing}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-natwest-primary/20 text-natwest-primary hover:bg-natwest-primary hover:text-white transition-all shadow-lg"
          title="Finish editing"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="cursor-text min-h-[32px] text-white/90 text-sm markdown-body prose prose-invert max-w-none hover:bg-white/5 p-2 rounded-lg transition-colors"
      onClick={() => setIsEditing(true)}
    >
      {content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2 text-white" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-3 mb-2 text-white/90" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-2 mb-1 text-white/80" {...props} />,
            p: ({node, ...props}) => <p className="mb-2 leading-relaxed text-white/70" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-white/70" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-white/70" {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />,
            a: ({node, ...props}) => <a className="text-natwest-primary hover:underline font-medium" {...props} />,
            strong: ({node, ...props}) => <strong className="text-white font-bold" {...props} />,
            em: ({node, ...props}) => <em className="text-white/90 italic" {...props} />,
            code: ({node, inline, ...props}: any) => 
              inline 
                ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-natwest-tealLight" {...props} />
                : <pre className="bg-[#0D0915] border border-white/5 p-4 rounded-xl overflow-x-auto text-xs font-mono mb-4 my-2"><code {...props} /></pre>,
            table: ({node, ...props}) => <table className="w-full border-collapse mb-4 text-xs" {...props} />,
            th: ({node, ...props}) => <th className="border border-white/10 p-2 bg-white/5 text-left font-bold" {...props} />,
            td: ({node, ...props}) => <td className="border border-white/10 p-2" {...props} />,
            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-natwest-primary pl-4 py-1 italic text-white/50 mb-4 bg-white/5 rounded-r-lg" {...props} />
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <span className="text-white/20 italic flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Click to add notes or HTML content...
        </span>
      )}
    </div>
  );
};
