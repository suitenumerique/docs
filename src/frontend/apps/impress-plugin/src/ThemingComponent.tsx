import React, { useEffect } from 'react';

interface ThemeColors {
  // Primary colors
  'primary-100'?: string;
  'primary-200'?: string;
  'primary-300'?: string;
  'primary-400'?: string;
  'primary-500'?: string;
  'primary-600'?: string;
  'primary-700'?: string;
  'primary-800'?: string;
  'primary-900'?: string;
  'primary-text'?: string;
  'primary-bg'?: string;
  
  // Secondary colors
  'secondary-100'?: string;
  'secondary-200'?: string;
  'secondary-300'?: string;
  'secondary-400'?: string;
  'secondary-500'?: string;
  'secondary-600'?: string;
  'secondary-700'?: string;
  'secondary-800'?: string;
  'secondary-900'?: string;
  'secondary-text'?: string;
  'secondary-bg'?: string;
  
  // Info colors
  'info-100'?: string;
  'info-200'?: string;
  'info-300'?: string;
  'info-400'?: string;
  'info-500'?: string;
  'info-600'?: string;
  'info-700'?: string;
  'info-800'?: string;
  'info-900'?: string;
  'info-text'?: string;
  
  // Success colors
  'success-100'?: string;
  'success-200'?: string;
  'success-300'?: string;
  'success-400'?: string;
  'success-500'?: string;
  'success-600'?: string;
  
  // Warning colors
  'warning-100'?: string;
  'warning-200'?: string;
  'warning-300'?: string;
  'warning-400'?: string;
  'warning-500'?: string;
  'warning-600'?: string;
  
  // Error colors
  'error-100'?: string;
  'error-200'?: string;
  'error-300'?: string;
  'error-400'?: string;
  'error-500'?: string;
  'error-600'?: string;
  
  // Greyscale
  'greyscale-000'?: string;
  'greyscale-100'?: string;
  'greyscale-200'?: string;
  'greyscale-300'?: string;
  'greyscale-400'?: string;
  'greyscale-500'?: string;
  'greyscale-600'?: string;
  'greyscale-700'?: string;
  'greyscale-800'?: string;
  'greyscale-900'?: string;
}

interface ThemeSpacings {
  'xxxxs'?: string;
  'xxxs'?: string;
  'xxs'?: string;
  'xs'?: string;
  's'?: string;
  'b'?: string;
  'st'?: string;
  't'?: string;
  'l'?: string;
  'xl'?: string;
  'xxl'?: string;
  'xxxl'?: string;
}

interface ThemeFontSizes {
  'xxxxs'?: string;
  'xxxs'?: string;
  'xxs'?: string;
  'xs'?: string;
  's'?: string;
  'm'?: string;
  'l'?: string;
  'xl'?: string;
  'xxl'?: string;
  'xxxl'?: string;
  'xxxxl'?: string;
}

interface ThemingComponentProps {
  colors?: ThemeColors;
  spacings?: ThemeSpacings;
  fontSizes?: ThemeFontSizes;
  customVars?: Record<string, string>;
}

/**
 * ThemingComponent - Override Cunningham design tokens from a plugin
 * 
 * This component allows plugins to customize the host application's theme by
 * setting CSS custom properties (CSS variables).
 * 
 * ⚠️ IMPORTANT: This component ONLY updates CSS variables, not the Zustand store.
 * This means:
 * - ✅ Components using CSS variables like `var(--c--theme--colors--primary-text)` WILL update
 * - ❌ Components using JS values like `colorsTokens['primary-text']` will NOT update
 * 
 * For host components to be themeable by plugins, they must use CSS variables instead of
 * JS token values. Example:
 * 
 * ❌ Don't use: `$color={colorsTokens['primary-text']}`
 * ✅ Use instead: `$theme="primary" $variation="text"` (which generates CSS vars)
 * 
 * @example
 * ```tsx
 * <ThemingComponent
 *   colors={{
 *     'primary-500': '#FF6B6B',
 *     'primary-600': '#EE5A6F',
 *     'primary-text': '#FF6B6B',
 *     'secondary-500': '#4ECDC4',
 *   }}
 *   spacings={{
 *     's': '12px',
 *     'm': '24px',
 *   }}
 *   customVars={{
 *     '--custom-header-height': '80px',
 *   }}
 * />
 * ```
 */
const ThemingComponent: React.FC<ThemingComponentProps> = ({
  colors = {},
  spacings = {},
  fontSizes = {},
  customVars = {},
}) => {
  useEffect(() => {
    const root = document.documentElement;
    
    // Store original values for cleanup
    const originalValues: Record<string, string> = {};
    
    console.log('[ThemingComponent] Applying CSS variable overrides');
    
    // Apply CSS custom properties (for CSS variable-based usage)
    Object.entries(colors).forEach(([key, value]) => {
      const cssVar = `--c--theme--colors--${key}`;
      originalValues[cssVar] = root.style.getPropertyValue(cssVar);
      root.style.setProperty(cssVar, value);
    });
    
    // Apply spacing tokens
    Object.entries(spacings).forEach(([key, value]) => {
      const cssVar = `--c--theme--spacings--${key}`;
      originalValues[cssVar] = root.style.getPropertyValue(cssVar);
      root.style.setProperty(cssVar, value);
    });
    
    // Apply font size tokens
    Object.entries(fontSizes).forEach(([key, value]) => {
      const cssVar = `--c--theme--font--sizes--${key}`;
      originalValues[cssVar] = root.style.getPropertyValue(cssVar);
      root.style.setProperty(cssVar, value);
    });
    
    // Apply custom CSS variables
    Object.entries(customVars).forEach(([key, value]) => {
      originalValues[key] = root.style.getPropertyValue(key);
      root.style.setProperty(key, value);
    });
    
    console.log('[ThemingComponent] Applied CSS variable overrides:', {
      colors: Object.keys(colors).length,
      spacings: Object.keys(spacings).length,
      fontSizes: Object.keys(fontSizes).length,
      customVars: Object.keys(customVars).length,
    });
    
    // Cleanup: restore original values on unmount
    return () => {
      console.log('[ThemingComponent] Restoring original CSS variables');
      
      // Restore CSS variables
      Object.entries(originalValues).forEach(([cssVar, originalValue]) => {
        if (originalValue) {
          root.style.setProperty(cssVar, originalValue);
        } else {
          root.style.removeProperty(cssVar);
        }
      });
      
      console.log('[ThemingComponent] Restored original CSS variables');
    };
  }, [colors, spacings, fontSizes, customVars]);
  
  // This component doesn't render anything visible
  return null;
};

export default ThemingComponent;
