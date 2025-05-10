/**
 * Generic interface representing a paginated API response.
 *
 * Commonly used for endpoints that return list results with pagination metadata.
 *
 * @template T - The type of items in the `results` array.
 */
export interface APIList<T> {
  /** Total number of items across all pages */
  count: number;

  /** URL to the next page of results, if available (can be null or undefined) */
  next?: string | null;

  /** URL to the previous page of results, if available (can be null or undefined) */
  previous?: string | null;

  /** The list of items for the current page */
  results: T[];
}
