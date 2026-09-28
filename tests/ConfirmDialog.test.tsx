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
      root.render(
        <ConfirmDialog
          isOpen={false}
          title="Test"
          message="Msg"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );
    });
    expect(container.textContent).not.toContain('Test');
  });

  it('renders title and message when open', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Delete"
          message="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );
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
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Delete"
          message="Msg"
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      );
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
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Delete"
          message="Msg"
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      );
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
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Danger"
          message="Msg"
          onConfirm={() => {}}
          onCancel={() => {}}
          variant="danger"
        />
      );
    });
    // The confirm button is the last button in the dialog
    const btns = container.querySelectorAll('button');
    expect(btns.length).toBeGreaterThanOrEqual(2);
    const confirmBtn = btns[btns.length - 1] as HTMLElement;
    expect(confirmBtn.className).toContain('bg-negative');
  });

  it('renders custom confirm and cancel text', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Msg"
          onConfirm={() => {}}
          onCancel={() => {}}
          confirmText="Delete"
          cancelText="Go Back"
        />
      );
    });
    const btns = container.querySelectorAll('button');
    expect(btns.length).toBeGreaterThanOrEqual(2);
    expect(btns[0].textContent).toBe('Go Back');
    expect(btns[btns.length - 1].textContent).toBe('Delete');
  });

  it('exposes modal dialog semantics (role, aria-modal, aria-labelledby)', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Delete data"
          message="Msg"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );
    });
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe('Delete data');
  });

  it('closes on Escape and on backdrop click', () => {
    const onCancel = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Delete"
          message="Msg"
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      );
    });
    React.act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Backdrop click: the overlay is the fixed-position parent of the dialog.
    const overlay = container.querySelector('.fixed.inset-0') as HTMLElement;
    React.act(() => {
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(2);

    // Clicking inside the panel must not close it.
    React.act(() => {
      (container.querySelector('[role="dialog"]') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('moves focus inside the dialog on open, traps Tab, and restores focus on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(
        <ConfirmDialog
          isOpen={true}
          title="Delete"
          message="Msg"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );
    });

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    // Focus lands on the first control inside the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tab from the last control wraps back to the first.
    const controls = Array.from(dialog.querySelectorAll('button')) as HTMLElement[];
    controls[controls.length - 1].focus();
    React.act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    });
    expect(document.activeElement).toBe(controls[0]);

    // Shift+Tab from the first control wraps to the last.
    React.act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    });
    expect(document.activeElement).toBe(controls[controls.length - 1]);

    // Closing restores focus to the invoking element.
    React.act(() => {
      root.render(
        <ConfirmDialog
          isOpen={false}
          title="Delete"
          message="Msg"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );
    });
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
