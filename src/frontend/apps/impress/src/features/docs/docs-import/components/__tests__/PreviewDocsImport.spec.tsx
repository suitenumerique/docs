import { render, screen } from '@testing-library/react';
import { PreviewDocsImport } from '../PreviewDocsImport';
import { DocToImport } from '../../types';

describe('<PreviewDocsImport />', () => {
  it('displays empty state message when no documents', () => {
    render(<PreviewDocsImport extractedDocs={[]} />);
    
    expect(screen.getByText('No documents to import')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders a simple list of documents with their states', () => {
    const docs: DocToImport[] = [
      { doc: { title: 'Doc 1' }, state: 'success' },
      { doc: { title: 'Doc 2' }, state: 'error', error: 'Failed to import' },
      { doc: { title: 'Doc 3' }, state: 'pending' }
    ];

    render(<PreviewDocsImport extractedDocs={docs} />);

    expect(screen.getByText('Doc 1')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('Doc 2')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('Failed to import')).toBeInTheDocument();
    expect(screen.getByText('Doc 3')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders nested document structure correctly', () => {
    const docs: DocToImport[] = [{
      doc: { title: 'Parent Doc' },
      state: 'success',
      children: [
        { doc: { title: 'Child Doc' }, state: 'success' }
      ]
    }];

    render(<PreviewDocsImport extractedDocs={docs} />);

    expect(screen.getByText('Parent Doc')).toBeInTheDocument();
    expect(screen.getByText('Child Doc')).toBeInTheDocument();
  });

  it('calculates and displays progress correctly', () => {
    const docs: DocToImport[] = [
      { doc: { title: 'Doc 1' }, state: 'success' },
      { doc: { title: 'Doc 2' }, state: 'error' },
      { doc: { title: 'Doc 3' }, state: 'pending' },
      { doc: { title: 'Doc 4' }, state: 'success' }
    ];

    render(<PreviewDocsImport extractedDocs={docs} />);

    expect(screen.getByText('50% completed')).toBeInTheDocument();
    expect(screen.getByText('25% failed')).toBeInTheDocument();
  });
});
