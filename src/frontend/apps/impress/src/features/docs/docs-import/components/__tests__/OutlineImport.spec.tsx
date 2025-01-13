import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OutlineImport } from '../OutlineImport';
import JSZip from 'jszip';
import React from 'react';
import { CunninghamProvider } from "@openfun/cunningham-react";
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

// Setup i18next
i18next
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['translations'],
    defaultNS: 'translations',
    resources: {
      en: {
        translations: {
          'Outline exported .zip file': 'Outline exported .zip file',
        },
      },
    },
  });

// Mock Cunningham FileUploader
jest.mock('@openfun/cunningham-react', () => ({
  ...jest.requireActual('@openfun/cunningham-react'),
  FileUploader: ({ onChange, state }: any) => (
    <div data-testid="file-uploader" data-state={state}>
      <input
        type="file"
        onChange={(e) => onChange && onChange(e)}
        data-testid="file-input"
      />
    </div>
  ),
}));

// Mock JSZip
jest.mock('jszip', () => {
  return jest.fn().mockImplementation(() => ({
    loadAsync: jest.fn(),
  }));
});

// Mock @blocknote/mantine
jest.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({ editor }) => <div data-testid="blocknote-view">Mocked BlockNote View</div>
}));

// Modifions les mocks pour mieux contrôler le comportement
let mockParseMarkdownResult = [{ type: 'paragraph', content: 'Test content' }];
let mockParseMarkdownError: Error | null = null;

jest.mock('@blocknote/react', () => ({
  useCreateBlockNote: () => ({
    tryParseMarkdownToBlocks: jest.fn().mockImplementation(async (text: string) => {
      if (mockParseMarkdownError) {
        return Promise.reject(mockParseMarkdownError);
      }
      return Promise.resolve(mockParseMarkdownResult);
    }),
  }),
}));

describe('<OutlineImport />', () => {
  const mockSetExtractedDocs = jest.fn();
  const mockOnNewUpload = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockParseMarkdownError = null;
    mockParseMarkdownResult = [{ type: 'paragraph', content: 'Test content' }];
  });

  it('handles successful file upload with nested structure', async () => {
    const mockFiles = {
      'folder/doc1.md': { 
        async: () => Promise.resolve('# Doc 1'),
        dir: false,
        name: 'folder/doc1.md'
      },
      'folder/doc2.md': { 
        async: () => Promise.resolve('# Doc 2'),
        dir: false,
        name: 'folder/doc2.md'
      },
      'doc3.md': { 
        async: () => Promise.resolve('# Doc 3'),
        dir: false,
        name: 'doc3.md'
      },
    };

    const mockZipInstance = {
      loadAsync: jest.fn().mockResolvedValue({
        files: mockFiles,
      }),
    };
    (JSZip as jest.Mock).mockImplementation(() => mockZipInstance);

    render(
      <I18nextProvider i18n={i18next}>
        <CunninghamProvider>
          <OutlineImport 
            setExtractedDocs={mockSetExtractedDocs} 
            onNewUpload={mockOnNewUpload} 
          />
        </CunninghamProvider>
      </I18nextProvider>
    );

    const file = new File(['content'], 'test.zip', { type: 'application/zip' });
    const input = screen.getByTestId('file-input');
    
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSetExtractedDocs).toHaveBeenCalled();
      const calls = mockSetExtractedDocs.mock.calls[0][0];
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            doc: expect.objectContaining({ title: 'doc3' }),
          }),
        ])
      );
    });
  });

  it('handles successful file upload with single file', async () => {
    const mockFiles = {
      'doc1.md': { 
        async: () => Promise.resolve('# Single Doc'),
        dir: false,
        name: 'doc1.md'
      },
    };

    const mockZipInstance = {
      loadAsync: jest.fn().mockResolvedValue({
        files: mockFiles,
      }),
    };
    (JSZip as jest.Mock).mockImplementation(() => mockZipInstance);

    render(
      <I18nextProvider i18n={i18next}>
        <CunninghamProvider>
          <OutlineImport 
            setExtractedDocs={mockSetExtractedDocs} 
            onNewUpload={mockOnNewUpload} 
          />
        </CunninghamProvider>
      </I18nextProvider>
    );

    const file = new File(['content'], 'test.zip', { type: 'application/zip' });
    const input = screen.getByTestId('file-input');
    
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSetExtractedDocs).toHaveBeenCalledWith([
        expect.objectContaining({
          doc: expect.objectContaining({ title: 'doc1' }),
        }),
      ]);
    });
  });

  it('handles error when markdown parsing fails', async () => {
    mockParseMarkdownError = new Error('Invalid markdown');
    
    const mockFiles = {
      'invalid.md': { 
        async: () => Promise.resolve('Invalid content'),
        dir: false,
        name: 'invalid.md'
      },
    };

    const mockZipInstance = {
      loadAsync: jest.fn().mockResolvedValue({
        files: mockFiles,
      }),
    };
    (JSZip as jest.Mock).mockImplementation(() => mockZipInstance);

    render(
      <I18nextProvider i18n={i18next}>
        <CunninghamProvider>
          <OutlineImport 
            setExtractedDocs={mockSetExtractedDocs} 
            onNewUpload={mockOnNewUpload} 
          />
        </CunninghamProvider>
      </I18nextProvider>
    );

    const file = new File(['invalid content'], 'test.zip', { type: 'application/zip' });
    const input = screen.getByTestId('file-input');
    
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const calls = mockSetExtractedDocs.mock.calls[0][0];
      expect(calls[0]).toEqual(
        expect.objectContaining({
          state: 'error',
          error: mockParseMarkdownError,
          doc: expect.objectContaining({
            title: 'invalid'
          })
        })
      );
    }, { timeout: 3000 });
  });

  it('handles error when processing invalid file', async () => {
    const mockZipInstance = {
      loadAsync: jest.fn().mockRejectedValue(new Error('Invalid ZIP file')),
    };
    (JSZip as jest.Mock).mockImplementation(() => mockZipInstance);

    render(
      <I18nextProvider i18n={i18next}>
        <CunninghamProvider>
          <OutlineImport 
            setExtractedDocs={mockSetExtractedDocs} 
            onNewUpload={mockOnNewUpload} 
          />
        </CunninghamProvider>
      </I18nextProvider>
    );

    const file = new File(['invalid content'], 'test.zip', { type: 'application/zip' });
    const input = screen.getByTestId('file-input');
    
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSetExtractedDocs).not.toHaveBeenCalled();
      expect(screen.getByTestId('file-uploader')).toHaveAttribute('data-state', 'error');
    });
  });

  it('handles empty zip file', async () => {
    const mockZipInstance = {
      loadAsync: jest.fn().mockResolvedValue({
        files: {},
      }),
    };
    (JSZip as jest.Mock).mockImplementation(() => mockZipInstance);

    render(
      <I18nextProvider i18n={i18next}>
        <CunninghamProvider>
          <OutlineImport 
            setExtractedDocs={mockSetExtractedDocs} 
            onNewUpload={mockOnNewUpload} 
          />
        </CunninghamProvider>
      </I18nextProvider>
    );

    const file = new File([''], 'empty.zip', { type: 'application/zip' });
    const input = screen.getByTestId('file-input');
    
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSetExtractedDocs).toHaveBeenCalledWith([]);
      expect(screen.getByTestId('file-uploader')).toHaveAttribute('data-state', 'success');
    });
  });
});