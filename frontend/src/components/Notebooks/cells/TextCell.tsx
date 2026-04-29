import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { NotebookCell } from '../../../types/notebook';

interface TextCellProps {
  cell: NotebookCell;
  onChange: (id: string, content: string) => void;
}

export const TextCell: React.FC<TextCellProps> = ({ cell, onChange }) => {
  const [isEditing, setIsEditing] = useState(cell.content === '');
  const [content, setContent] = useState(cell.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, content]);

  const handleBlur = () => {
    setIsEditing(false);
    if (content !== cell.content) {
      onChange(cell.id, content);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Type markdown here... (e.g. ## Heading, **bold**)"
        className="w-full bg-transparent border-none outline-none text-white/90 resize-none font-sans text-sm min-h-[40px] focus:ring-0 p-0"
        rows={1}
      />
    );
  }

  return (
    <div 
      className="cursor-text min-h-[24px] text-white/90 text-sm markdown-body"
      onClick={() => setIsEditing(true)}
    >
      {content ? (
        <ReactMarkdown
          components={{
            h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-3 mb-2" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-2 mb-1" {...props} />,
            p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
            a: ({node, ...props}) => <a className="text-natwest-primary hover:underline" {...props} />,
            code: ({node, inline, ...props}: any) => 
              inline 
                ? <code className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono" {...props} />
                : <pre className="bg-white/5 p-3 rounded-lg overflow-x-auto text-xs font-mono mb-2"><code {...props} /></pre>
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <span className="text-white/20 italic">Click to add text...</span>
      )}
    </div>
  );
};
