import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MappingView } from './MappingView';
import { CsvMapping } from '../../types';

const mapping: CsvMapping = {
  dateCol: 'Date',
  descCol: 'Description',
  amountCol: 'Amount',
  categoryCol: '',
  hasHeader: true,
  delimiter: ',',
};

const render = (autoDetected: boolean) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  React.act(() => {
    root.render(
      <MappingView
        headers={['Date', 'Description', 'Amount']}
        mapping={mapping}
        autoDetected={autoDetected}
        mappingPreview={[]}
        onMappingChange={vi.fn()}
        onCancel={vi.fn()}
        onNext={vi.fn()}
      />
    );
  });
  return {
    container,
    root,
    heading: container.querySelector('.text-sm.text-gray-500')?.textContent ?? '',
  };
};

describe('MappingView heading branches on detection success (issue #41, F-UX-005)', () => {
  const roots: Array<ReturnType<typeof createRoot>> = [];

  afterEach(() => {
    roots.forEach((r) => React.act(() => r.unmount()));
    document.body.innerHTML = '';
  });

  it('does not blame auto-detection when detection succeeded', () => {
    const { heading, root } = render(true);
    roots.push(root);
    expect(heading).toContain('auto-detected your columns');
    expect(heading).not.toMatch(/couldn't/i);
  });

  it('asks for manual mapping only when detection actually failed', () => {
    const { heading, root } = render(false);
    roots.push(root);
    expect(heading).toContain("couldn't auto-detect");
  });
});
