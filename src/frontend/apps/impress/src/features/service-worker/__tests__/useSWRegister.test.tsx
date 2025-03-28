import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import { useSWRegister } from '../hooks/useSWRegister';

const TestComponent = () => {
  useSWRegister();

  return <div>Test Page</div>;
};

describe('useSWRegister', () => {
  it('checks service-worker is register', () => {
    process.env.NEXT_PUBLIC_BUILD_ID = '123456';
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const registerSpy = jest.fn();
    registerSpy.mockImplementation(
      () =>
        new Promise((reject) => {
          reject('error');
        }),
    );

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: registerSpy,
        addEventListener: jest.fn(),
      },
      writable: true,
    });

    render(<TestComponent />);

    expect(registerSpy).toHaveBeenCalledWith('/service-worker.js?v=123456');
    expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
      'controllerchange',
      expect.any(Function),
    );
  });

  it('checks service-worker is not register', () => {
    process.env.NEXT_PUBLIC_SW_DEACTIVATED = 'true';
    process.env.NEXT_PUBLIC_BUILD_ID = '123456';

    const registerSpy = jest.fn();
    registerSpy.mockImplementation(
      () =>
        new Promise((reject) => {
          reject('error');
        }),
    );
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: registerSpy,
      },
      writable: true,
    });

    render(<TestComponent />);

    expect(registerSpy).not.toHaveBeenCalledWith('/service-worker.js?v=123456');
  });
});
