/**
 * @fileOverview This module provides utilities to interact with storage.
 */

/**
 * @namespace safeLocalStorage
 * @description A utility for safely interacting with localStorage.
 * It checks if the `window` object is defined before attempting to access localStorage,
 * preventing errors in environments where `window` is not available.
 */
export const safeLocalStorage = {
  /**
   * Retrieves an item from localStorage.
   * @param {string} key - The key of the item to retrieve.
   * @returns {string | null} The item's value, or null if the item does not exist or if localStorage is not available.
   */
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  },
  /**
   * Sets an item in localStorage.
   * @param {string} key - The key of the item to set.
   * @param {string} value - The value to set for the item.
   * @returns {void}
   */
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  },
};
