export const promiseDone = <T = void>() => {
  let done: (value: T | PromiseLike<T>) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    done = resolve;
  });

  return { done, promise };
};
