import { describe, expect, it } from 'vitest';
import { parseLinesFactory } from '../hooks/useSerial';

describe('serial line parser', () => {
  it('handles CR/LF and chunks', () => {
    const out: string[] = [];
    const push = parseLinesFactory(l => out.push(l));
    push('PAY,1\r\nPON');
    push('G\n\nBAT,85\r\n');
    expect(out).toEqual(['PAY,1', 'PONG', 'BAT,85']);
  });
});