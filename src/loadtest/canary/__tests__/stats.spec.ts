import { describe, expect, it } from 'vitest';

import { Samples } from '../src/stats.js';

describe('Samples', () => {
  it('summarises nothing as null', () => {
    expect(new Samples().summary()).toBeNull();
  });

  it('computes the percentiles', () => {
    const samples = new Samples();
    for (let i = 1; i <= 100; i++) samples.add(i);
    expect(samples.summary()).toEqual({
      count: 100,
      min: 1,
      p50: 50,
      p95: 95,
      p99: 99,
      max: 100,
      mean: 50.5,
    });
  });
});
