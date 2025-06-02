export const containerStyles = {
  position: 'absolute',
  zIndex: 1000,
  padding: '1rem',
  background: 'white',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  boxSizing: 'border-box',
} as const;

export const editorContainerStyles = {
  width: '100%',
  marginRight: '1rem',
} as const;
