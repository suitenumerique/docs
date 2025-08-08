import { useKeyboardActivation } from './useKeyboardActivation';

export const useTreeItemKeyboardActivate = (
  focused: boolean,
  activate: () => void,
) => {
  useKeyboardActivation(['Enter', ' '], focused, activate, true);
};
