import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../components/ConfirmDialog';

describe('ConfirmDialog', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(() => {
    if (root) React.act(() => root.unmount());
    container?.remove();
  });

  it('renders nothing when closed', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<ConfirmDialog isOpen={false} title="Test" message="Msg" onConfirm={() => {}} onCancel={() => {}} />);
    });
    expect(container.textContent).not.toContain('Test');
  });

  it('renders title and message when open', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<ConfirmDialog isOpen={true} title="Delete" message="Are you sure?" onConfirm={() => {}} onCancel={() => {}} />);
    });
    expect(container.textContent).toContain('Delete');
    expect(container.textContent).toContain('Are you sure?');
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<ConfirmDialog isOpen={true} title="Delete" message="Msg" onConfirm={onConfirm} onCancel={() => {}} />);
    });
    const btns = container.querySelectorAll('button');
    expect(btns.length).toBeGreaterThanOrEqual(2);
    React.act(() => btns[1].click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<ConfirmDialog isOpen={true} title="Delete" message="Msg" onConfirm={() => {}} onCancel={onCancel} />);
    });
    const btns = container.querySelectorAll('button');
    expect(btns.length).toBeGreaterThanOrEqual(2);
    React.act(() => btns[0].click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders danger variant with red styling', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<ConfirmDialog isOpen={true} title="Danger" message="Msg" onConfirm={() => {}} onCancel={() => {}} variant="danger" />);
    });
    // The confirm button is the last button in the dialog
    const btns = container.querySelectorAll('button');
    expect(btns.length).toBeGreaterThanOrEqual(2);
    const confirmBtn = btns[btns.length - 1] as HTMLElement;
    expect(confirmBtn.className).toContain('bg-red-600');
  });

  it('renders custom confirm and cancel text', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<ConfirmDialog isOpen={true} title="Test" message="Msg" onConfirm={() => {}} onCancel={() => {}} confirmText="Delete" cancelText="Go Back" />);
    });
    const btns = container.querySelectorAll('button');
    expect(btns.length).toBeGreaterThanOrEqual(2);
    expect(btns[0].textContent).toBe('Go Back');
    expect(btns[btns.length - 1].textContent).toBe('Delete');
  });
});
