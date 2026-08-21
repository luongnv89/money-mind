import React from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MAX_FILE_SIZE_MB, SUPPORTED_BANKS } from '../../constants';

const SupportedBanksStrip: React.FC = () => (
  <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-50">
    {SUPPORTED_BANKS.map((b) => (
      <span key={b.name} className="text-[10px] px-2 py-1 bg-gray-200 rounded text-gray-600">
        {b.name}
      </span>
    ))}
  </div>
);

export interface DropzoneViewProps {
  dragActive: boolean;
  isProcessing: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelected: (file: File) => void;
}

/** Idle-state dropzone (also renders the processing overlay state). */
export const DropzoneView: React.FC<DropzoneViewProps> = ({
  dragActive,
  isProcessing,
  error,
  inputRef,
  onDrag,
  onDrop,
  onFileSelected,
}) => (
  <div className="w-full max-w-2xl mx-auto mt-10">
    <div
      className={cn(
        'relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer bg-white',
        dragActive
          ? 'border-accent bg-accent-light/10'
          : 'border-gray-300 hover:border-accent hover:bg-gray-50',
        isProcessing ? 'opacity-50 pointer-events-none' : ''
      )}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDragOver={onDrag}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFileSelected(e.target.files[0])}
      />

      <div className="flex flex-col items-center space-y-3 text-center p-6">
        <div className="p-4 rounded-full bg-gray-100">
          {isProcessing ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          ) : (
            <Upload className="w-8 h-8 text-gray-500" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium text-gray-700">
            {isProcessing ? 'Analyzing file...' : 'Drop your bank statement here'}
          </p>
          <p className="text-sm text-gray-500">Supports .csv (max {MAX_FILE_SIZE_MB}MB)</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm mt-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <SupportedBanksStrip />
      </div>
    </div>

    <div className="flex items-start gap-2 mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
      <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
      <p>Your data is processed locally. We perform duplicate detection before importing.</p>
    </div>
  </div>
);
