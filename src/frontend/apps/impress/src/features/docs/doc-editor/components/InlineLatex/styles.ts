export const styles = {
  container: {
    cursor: 'pointer',
    padding: '0 2px',
    borderRadius: '2px',
    transition: 'all 0.2s ease',
  },
  containerHovered: {
    backgroundColor: '#f5f5f5',
    border: '1px dashed #ccc',
  },
  containerDefault: {
    backgroundColor: 'transparent',
    border: '1px solid transparent',
  },
  editor: {
    minWidth: '1em',
    display: 'inline-block',
    padding: '0 2px',
    border: '1px solid #ccc',
    borderRadius: '2px',
    backgroundColor: '#fff',
  },
} as const;
