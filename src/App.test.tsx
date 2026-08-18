import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';

describe('App', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    container?.remove();
  });

  it('mounts without throwing and renders the upload view when empty', () => {
    container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);
    expect(() => {
      React.act(() => {
        root.render(<App />);
      });
    }).not.toThrow();

    expect(container.textContent).toContain('MoneyMind');
    expect(container.textContent).toContain('Drop your bank statement here');

    React.act(() => {
      root.unmount();
    });
  });
});
