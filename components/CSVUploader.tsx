import React from 'react';
import { useCSVUploader } from './csvUploader/useCSVUploader';
import { MappingView } from './csvUploader/MappingView';
import { PreviewView } from './csvUploader/PreviewView';
import { DropzoneView } from './csvUploader/DropzoneView';
import { CsvMapping, Transaction } from '../types';
import type { DuplicateTransaction } from './csvUploader/dedupe';
import type { PreviewTab } from './csvUploader/PreviewView';

interface CSVUploaderProps {
  onUploadComplete?: () => void;
}

interface ScreenProps {
  headers: string[];
  mapping: CsvMapping;
  mappingPreview: Transaction[];
  onMappingChange: (m: CsvMapping) => void;
  onReset: () => void;
  onProcessFile: (f: File, m: CsvMapping) => void;
  file: File | null;
}

const MappingScreen: React.FC<ScreenProps> = ({
  headers,
  mapping,
  mappingPreview,
  onMappingChange,
  onReset,
  onProcessFile,
  file,
}) => (
  <MappingView
    headers={headers}
    mapping={mapping}
    mappingPreview={mappingPreview}
    onMappingChange={onMappingChange}
    onCancel={onReset}
    onNext={() => file && onProcessFile(file, mapping)}
  />
);

interface PreviewScreenProps {
  stagedTransactions: Transaction[];
  duplicateTransactions: DuplicateTransaction[];
  existingTransactions: Transaction[];
  activeTab: PreviewTab;
  currentPage: number;
  rejectedCount: number;
  selectedDuplicate: DuplicateTransaction | null;
  onSelectTab: (tab: PreviewTab) => void;
  onPageChange: (page: number) => void;
  onRemoveStaged: (id: string) => void;
  onRestoreDuplicate: (t: DuplicateTransaction) => void;
  onSelectDuplicate: (t: DuplicateTransaction | null) => void;
  onReset: () => void;
  onBackToMapping: () => void;
  onConfirmImport: () => void;
}

const PreviewScreen: React.FC<PreviewScreenProps> = (p) => (
  <PreviewView
    stagedTransactions={p.stagedTransactions}
    duplicateTransactions={p.duplicateTransactions}
    existingTransactions={p.existingTransactions}
    activeTab={p.activeTab}
    currentPage={p.currentPage}
    rejectedCount={p.rejectedCount}
    selectedDuplicate={p.selectedDuplicate}
    onSelectTab={p.onSelectTab}
    onPageChange={p.onPageChange}
    onRemoveStaged={p.onRemoveStaged}
    onRestoreDuplicate={p.onRestoreDuplicate}
    onSelectDuplicate={p.onSelectDuplicate}
    onCancel={p.onReset}
    onBackToMapping={p.onBackToMapping}
    onConfirmImport={p.onConfirmImport}
  />
);

type UploaderFlow = ReturnType<typeof useCSVUploader>;

/** Assemble PreviewScreen props from the uploader flow. */
const previewPropsFrom = (u: UploaderFlow) => ({
  stagedTransactions: u.s.stagedTransactions,
  duplicateTransactions: u.s.duplicateTransactions,
  existingTransactions: u.s.existingTransactions,
  activeTab: u.s.activeTab,
  currentPage: u.s.currentPage,
  rejectedCount: u.s.rejectedCount,
  selectedDuplicate: u.s.selectedDuplicate,
  onSelectTab: u.selectTab,
  onPageChange: u.s.setCurrentPage,
  onRemoveStaged: u.removeStagedTransaction,
  onRestoreDuplicate: u.restoreDuplicate,
  onSelectDuplicate: u.s.setSelectedDuplicate,
  onReset: u.reset,
  onBackToMapping: () => u.s.setState('mapping'),
  onConfirmImport: u.confirmImport,
});

export const CSVUploader: React.FC<CSVUploaderProps> = ({ onUploadComplete }) => {
  const u = useCSVUploader(onUploadComplete);
  const { s, reset, processFile, handleFileSelection, handleDrag, handleDrop } = u;

  if (s.state === 'mapping') {
    return (
      <MappingScreen
        headers={s.headers}
        mapping={s.mapping}
        mappingPreview={s.mappingPreview}
        onMappingChange={s.setMapping}
        onReset={reset}
        onProcessFile={processFile}
        file={s.file}
      />
    );
  }

  if (s.state === 'preview') {
    return <PreviewScreen {...previewPropsFrom(u)} />;
  }

  // Idle State (Default Dropzone)
  return (
    <DropzoneView
      dragActive={s.dragActive}
      isProcessing={s.state === 'processing'}
      error={s.error}
      inputRef={s.inputRef}
      onDrag={handleDrag}
      onDrop={handleDrop}
      onFileSelected={handleFileSelection}
    />
  );
};
