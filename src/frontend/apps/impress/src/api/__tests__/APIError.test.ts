import { APIError, isAPIError } from '@/api';

describe('APIError', () => {
  it('should correctly instantiate with required fields', () => {
    const error = new APIError('Something went wrong', { status: 500 });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(APIError);
    expect(error.message).toBe('Something went wrong');
    expect(error.status).toBe(500);
    expect(error.cause).toBeUndefined();
    expect(error.data).toBeUndefined();
  });

  it('should correctly instantiate with all fields', () => {
    const details = { field: 'email' };
    const error = new APIError('Validation failed', {
      status: 400,
      cause: ['Invalid email format'],
      data: details,
    });

    expect(error.name).toBe('APIError');
    expect(error.status).toBe(400);
    expect(error.cause).toEqual(['Invalid email format']);
    expect(error.data).toEqual(details);
  });

  it('should be detected by isAPIError type guard', () => {
    const error = new APIError('Unauthorized', { status: 401 });
    const notAnError = { message: 'Fake error' };

    expect(isAPIError(error)).toBe(true);
    expect(isAPIError(notAnError)).toBe(false);
  });
});
