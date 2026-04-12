import React, { useCallback, useState } from 'react';

interface FileUploaderProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUpload, isUploading, uploadProgress }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setErrorMsg(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        await onUpload(e.dataTransfer.files[0]);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.detail || err.message || "Failed to upload file");
      }
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files.length > 0) {
      try {
        await onUpload(e.target.files[0]);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.detail || err.message || "Failed to upload file");
      }
    }
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors text-center relative ${
        isDragOver ? 'border-natwest-primary bg-natwest-surface' : 'border-natwest-border bg-natwest-bg hover:border-natwest-light'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="w-16 h-16 rounded-full bg-natwest-surface flex items-center justify-center mb-4 border border-natwest-border">
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-natwest-light">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
        </svg>
      </div>
      
      {!isUploading ? (
        <>
          <h3 className="text-xl font-bold font-display text-white mb-2">Drop tabular data or documents</h3>
          <p className="text-white/50 text-sm mb-6">CSV, Excel, PDF, or Image format (under 20MB)</p>
          <label className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 px-6 py-2.5 rounded-lg font-medium text-white cursor-pointer transition-all">
            Browse Files
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg" onChange={handleChange} />
          </label>
        </>
      ) : (
        <div className="w-full max-w-md">
          <h3 className="text-lg font-bold text-white mb-4">Uploading and Profiling...</h3>
          <div className="w-full bg-natwest-border rounded-full h-2.5 overflow-hidden">
            <div className="bg-natwest-teal h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <p className="text-natwest-textSecondary text-sm mt-3 animate-pulse">This might take a minute as DataLens analyzes your schema...</p>
        </div>
      )}
      
      {errorMsg && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
