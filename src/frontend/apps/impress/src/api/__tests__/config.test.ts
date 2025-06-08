import { baseApiUrl } from '@/api';

describe('config', () => {
  it('constructs URL with default version', () => {
    expect(baseApiUrl()).toBe('http://test.jest/api/v1.0/');
  });

  it('constructs URL with custom version', () => {
    expect(baseApiUrl('2.0')).toBe('http://test.jest/api/v2.0/');
  });

  it('uses env origin if available', () => {
    process.env.NEXT_PUBLIC_API_ORIGIN = 'https://env.example.com';
    expect(baseApiUrl('3.0')).toBe('https://env.example.com/api/v3.0/');
  });
});
