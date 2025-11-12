import React, { useState } from 'react';
import ThemingComponent from './ThemingComponent';

/**
 * ThemingDemo - Interactive demo component to test theme overrides
 * 
 * This component demonstrates the ThemingComponent by providing
 * a UI to dynamically change theme tokens and see the results.
 */
const ThemingDemo: React.FC = () => {
  const [primaryColor, setPrimaryColor] = useState('#667eea');
  const [secondaryColor, setSecondaryColor] = useState('#764ba2');
  const [enabled, setEnabled] = useState(true);

  return (
    <>
      {enabled && (
        <ThemingComponent
          colors={{
            // Primary color variants
            'primary-500': primaryColor,
            'primary-600': secondaryColor,
            'primary-text': primaryColor,
            'primary-bg': primaryColor,
            
            // Secondary color variants
            'secondary-500': secondaryColor,
            'secondary-text': secondaryColor,
            'secondary-bg': secondaryColor,
          }}
          customVars={{
            '--demo-gradient': `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
          }}
        />
      )}
      
      <div style={{ 
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'white',
        border: '1px solid var(--c--theme--colors--greyscale-300)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 9999,
        minWidth: '300px',
      }}>
        <h3 style={{ 
          margin: '0 0 16px 0',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'var(--c--theme--colors--greyscale-900)',
        }}>
          🎨 Theme Override Demo
        </h3>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable Theme Override
          </label>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '4px',
            color: 'var(--c--theme--colors--greyscale-700)',
          }}>
            Primary Color
          </label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={!enabled}
            style={{ 
              width: '100%',
              height: '36px',
              border: '1px solid var(--c--theme--colors--greyscale-300)',
              borderRadius: '6px',
              cursor: enabled ? 'pointer' : 'not-allowed',
            }}
          />
          <span style={{ 
            fontSize: '11px',
            color: 'var(--c--theme--colors--greyscale-500)',
          }}>
            {primaryColor}
          </span>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '4px',
            color: 'var(--c--theme--colors--greyscale-700)',
          }}>
            Secondary Color
          </label>
          <input
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            disabled={!enabled}
            style={{ 
              width: '100%',
              height: '36px',
              border: '1px solid var(--c--theme--colors--greyscale-300)',
              borderRadius: '6px',
              cursor: enabled ? 'pointer' : 'not-allowed',
            }}
          />
          <span style={{ 
            fontSize: '11px',
            color: 'var(--c--theme--colors--greyscale-500)',
          }}>
            {secondaryColor}
          </span>
        </div>
        
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--demo-gradient, linear-gradient(135deg, #667eea 0%, #764ba2 100%))',
          borderRadius: '8px',
          color: 'white',
          fontSize: '12px',
          textAlign: 'center',
          fontWeight: '600',
        }}>
          Preview: Gradient with current colors
        </div>
        
        <div style={{
          marginTop: '12px',
          fontSize: '11px',
          color: 'var(--c--theme--colors--greyscale-600)',
          lineHeight: '1.4',
        }}>
          💡 This demo overrides primary-500, primary-600, and secondary-500 css variables. It only works with CSS.
        </div>
      </div>
    </>
  );
};

export default ThemingDemo;
