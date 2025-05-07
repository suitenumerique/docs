/**
 * Generic interface for representing an API error structure.
 *
 * @template T - Optional type of additional data returned with the error.
 */
interface IAPIError<T = unknown> {
  /** HTTP status code or API-defined error code */
  status: number;
  /** Optional list of error causes (e.g., validation issues) */
  cause?: string[];
  /** Optional extra data provided with the error */
  data?: T;
}

/**
 * Custom error class for representing API errors.
 * Extends the native Error object with additional context such as HTTP status,
 * causes, and extra data returned by the API.
 *
 * @template T - Optional type of the `data` field
 */
export class APIError<T = unknown> extends Error implements IAPIError<T> {
  public status: IAPIError['status'];
  public cause?: IAPIError['cause'];
  public data?: IAPIError<T>['data'];

  /**
   * Constructs a new APIError instance.
   *
   * @param message - The human-readable error message.
   * @param status - The HTTP status code or equivalent.
   * @param cause - (Optional) List of strings describing error causes.
   * @param data - (Optional) Any additional data returned by the API.
   */
  constructor(message: string, { status, cause, data }: IAPIError<T>) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.cause = cause;
    this.data = data;
  }
}

/**
 * Type guard for checking if a value is an instance of APIError.
 *
 * @param error - The value to check.
 * @returns True if the value is an instance of APIError.
 */
export const isAPIError = (error: unknown): error is APIError => {
  return error instanceof APIError;
};
