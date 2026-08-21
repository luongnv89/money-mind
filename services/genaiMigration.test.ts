import { describe, it, expect } from 'vitest';
import { GoogleGenAI, Type } from '@google/genai';

describe('@google/genai v2 migration surface', () => {
  it('exports GoogleGenAI and Type used by aiService', () => {
    expect(typeof GoogleGenAI).toBe('function');
    expect(Type).toBeDefined();
  });

  it('keeps the Type enum values the responseSchema relies on', () => {
    expect(Type.ARRAY).toBe('ARRAY');
    expect(Type.OBJECT).toBe('OBJECT');
    expect(Type.STRING).toBe('STRING');
    expect(Type.NUMBER).toBe('NUMBER');
  });
});
