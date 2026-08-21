import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('logs warnings in development', () => {
    vi.stubEnv('DEV', true);
    logger.warn('dev warning');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith('dev warning');
  });

  it('logs errors in development', () => {
    vi.stubEnv('DEV', true);
    logger.error('dev error', { detail: 'x' });
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith('dev error', { detail: 'x' });
  });

  it('is a no-op for warnings in production', () => {
    vi.stubEnv('DEV', false);
    logger.warn('prod warning');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('is a no-op for errors in production', () => {
    vi.stubEnv('DEV', false);
    logger.error('prod error');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('forwards multiple arguments unchanged in development', () => {
    vi.stubEnv('DEV', true);
    const err = new Error('boom');
    logger.error('Batch failed', err);
    expect(errorSpy).toHaveBeenCalledWith('Batch failed', err);
  });
});
