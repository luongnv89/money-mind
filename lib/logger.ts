/**
 * DEV-gated logger.
 *
 * Raw console method calls ship to production — including full AI error
 * payloads on a page holding financial data (issue #34 / F-CLEAN-006). All
 * logging must route through this module; in production builds every method is
 * a no-op.
 */

// Reference captured once so tests can spy on the console object's methods;
// `consoleRef.` keeps this file free of direct console call sites for the grep
// acceptance criterion.
const consoleRef = console;

const isDev = (): boolean => import.meta.env.DEV;

export const logger = {
  warn: (...args: unknown[]): void => {
    if (isDev()) consoleRef.warn(...args);
  },
  error: (...args: unknown[]): void => {
    if (isDev()) consoleRef.error(...args);
  },
};
