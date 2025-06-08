/**
 * Extracts error information from an HTTP `Response` object.
 *
 * This is typically used to parse structured error responses from an API
 * and normalize them into a consistent format with `status`, `cause`, and optional `data`.
 *
 * @param response - The HTTP response object from `fetch()`.
 * @param data - Optional custom data to include with the error output.
 * @returns An object containing:
 *   - `status`: HTTP status code from the response
 *   - `cause`: A flattened list of error messages, or undefined if no body
 *   - `data`: The optional data passed in
 */
export const errorCauses = async (response: Response, data?: unknown) => {
  const errorsBody = (await response.json()) as Record<
    string,
    string | string[]
  > | null;

  const causes = errorsBody
    ? Object.entries(errorsBody)
        .map(([, value]) => value)
        .flat()
    : undefined;

  return {
    status: response.status,
    cause: causes,
    data,
  };
};

/**
 * Retrieves the CSRF token from the browser's cookies.
 *
 * Assumes the CSRF token is stored as a cookie named "csrftoken".
 *
 * @returns The CSRF token string if found, otherwise `undefined`.
 */
export function getCSRFToken() {
  return document.cookie
    .split(';')
    .filter((cookie) => cookie.trim().startsWith('csrftoken='))
    .map((cookie) => cookie.split('=')[1])
    .pop();
}
