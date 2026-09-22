/** Percentiles of what was measured, for the final report. */

export interface Summary {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export class Samples {
  private values: number[] = [];

  add(value: number): void {
    this.values.push(value);
  }

  get count(): number {
    return this.values.length;
  }

  summary(): Summary | null {
    if (this.values.length === 0) return null;
    const sorted = [...this.values].sort((a, b) => a - b);
    const at = (q: number): number =>
      sorted[
        Math.min(
          sorted.length - 1,
          Math.max(0, Math.ceil(q * sorted.length) - 1),
        )
      ];
    return {
      count: sorted.length,
      min: sorted[0],
      p50: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      max: sorted[sorted.length - 1],
      mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    };
  }
}
