import React from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MAX_FILE_SIZE_MB, SUPPORTED_BANKS } from '../../constants';

const SupportedBanksStrip: React.FC = () => (
  <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-70">
    {SUPPORTED_BANKS.map((b) => (
      <span
        key={b.name}
        className="rounded-md border border-line bg-surface-muted px-2 py-1 text-[10px] text-muted"
      >
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
  <div className="w-full max-w-2xl mx-auto">
    <div
      className={cn(
        'relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer bg-surface',
        dragActive
          ? 'border-accent bg-accent-light/30'
          : 'border-line-strong hover:border-accent hover:bg-surface-muted',
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
        <div className="rounded-full border border-line bg-surface-muted p-4">
          {isProcessing ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          ) : (
            <Upload className="w-8 h-8 text-muted" />
          )}
        </div>
        <div className="space-y-1">
          <p className="font-display text-lg text-ink">
            {isProcessing ? 'Analyzing file…' : 'Drop your bank statement here'}
          </p>
          <p className="text-sm text-muted">Supports .csv (max {MAX_FILE_SIZE_MB}MB)</p>
        </div>

        {error && (
          <div className="mt-2 flex items-center gap-2 rounded-full bg-negative/10 px-3 py-1 text-sm text-negative">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <SupportedBanksStrip />
      </div>
    </div>

    <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface-muted p-3 text-xs text-ink-soft">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
      <p>Your data is processed locally. We perform duplicate detection before importing.</p>
    </div>
  </div>
);
