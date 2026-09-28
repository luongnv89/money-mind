import React from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '../../components/UI';

interface RulesSectionProps {
  patternCount: number;
  onExport: () => void;
  onImportClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** Learned-rules backup card — export/import. */
export const RulesSection: React.FC<RulesSectionProps> = ({
  patternCount,
  onExport,
  onImportClick,
  fileInputRef,
  onFileChange,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Your rules</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-soft">
        {patternCount} learned rules. MoneyMind learns a rule when you correct a category or verify
        a transaction, and applies it to matching merchants. Export them as a backup or to move to
        another browser.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download className="w-3.5 h-3.5 mr-2" />
          Export
        </Button>
        <Button size="sm" variant="outline" onClick={onImportClick}>
          <Upload className="w-3.5 h-3.5 mr-2" />
          Import
        </Button>
        <Input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".json"
          onChange={onFileChange}
        />
      </div>
    </CardContent>
  </Card>
);
