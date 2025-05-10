/**
 * @param ms - The number of milliseconds to wait.
 * @description A utility function that returns a promise that resolves after a specified number of milliseconds.
 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param condition - The condition to check.
 * @param msg - The error message to throw if the condition is false.
 * @throws {Error} If the condition is false.
 * @description Throws an error if the condition is false.
 * Important: The `asserts condition` return type informs TypeScript
 * that the condition must be true after this call if no error is thrown.
 */
export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg || 'Assertion failed: Condition should be truthy.');
  }
}
