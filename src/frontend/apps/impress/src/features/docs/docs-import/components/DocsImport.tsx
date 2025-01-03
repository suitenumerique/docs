import { Button, Select } from "@openfun/cunningham-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchAPI } from "@/api";
import { Box } from "@/components";
import styled from 'styled-components';
import { useRouter } from 'next/router';
import { DocToImport } from "../types";
import { OutlineImport } from "./OutlineImport";
import { PreviewDocsImport } from "./PreviewDocsImport";


const ImportContainer = styled.div`
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
`;

type Source = 'outline';

type ImportState = 'idle' | 'importing' | 'completed';

export const DocsImport = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [source, setSource] = useState<Source>('outline');
  const [extractedDocs, setExtractedDocs] = useState<DocToImport[]>([]);
  const [importState, setImportState] = useState<ImportState>('idle');

  const updateDocState = (
    docs: DocToImport[],
    updatedDoc: DocToImport,
    parentPath: number[] = []
  ): DocToImport[] => {
    return docs.map((doc, index) => {
      if (parentPath[0] === index) {
        if (parentPath.length === 1) {
          return updatedDoc;
        }
        return {
          ...doc,
          children: updateDocState(doc.children || [], updatedDoc, parentPath.slice(1))
        };
      }
      return doc;
    });
  };

  const importDocument = async (
    doc: DocToImport, 
    parentId?: string,
    parentPath: number[] = []
  ): Promise<DocToImport> => {
    setExtractedDocs(prev => 
      updateDocState(
        prev,
        { ...doc, state: 'importing' as const },
        parentPath
      )
    );

    try {
      const response = await fetchAPI('documents/', {
        method: 'POST',
        body: JSON.stringify({ 
          title: doc.doc.title,
          content: doc.doc.content,
          parent: parentId 
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const { id } = await response.json();
      
      const successDoc = {
        ...doc,
        state: 'success' as const,
        doc: { ...doc.doc, id }
      };

      setExtractedDocs(prev => 
        updateDocState(prev, successDoc, parentPath)
      );

      if (doc.children?.length) {
        const processedChildren = [];
        for (let i = 0; i < doc.children.length; i++) {
          const childDoc = await importDocument(doc.children[i], id, [...parentPath, i]);
          processedChildren.push(childDoc);
        }
        successDoc.children = processedChildren;
      }

      return successDoc;
    } catch (error) {
      const failedDoc = {
        ...doc,
        state: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
        children: doc.children
      };

      setExtractedDocs(prev => 
        updateDocState(prev, failedDoc, parentPath)
      );

      return failedDoc;
    }
  };

  const handleImport = async () => {
    setImportState('importing');
    try {
      await Promise.all(
        extractedDocs.map((doc, index) => importDocument(doc, undefined, [index]))
      );
      setImportState('completed');
    } catch (error) {
      console.error('Import failed:', error);
      setImportState('idle');
    }
  };

  const handleBackToDocs = () => {
    router.push('/docs');
  };

  const handleReset = () => {
    setExtractedDocs([]);
    setImportState('idle');
  };

  return (
    <ImportContainer>
      <h1 className="text-2xl font-bold mb-6">{t('Import documents')}</h1>
      <Box
        $margin={{ bottom: 'small' }}
        aria-label={t('Import documents from')}
        $gap="1.5rem"
      >
        <Select
          clearable={false}
          label={t('Source')}
          options={[{
            label: 'Outline',
            value: 'outline',
          }]}
          value={source}
          onChange={(options) =>
            setSource(options.target.value as Source)
          }
          text={t('Import documents from this source')}
        />
        { source === 'outline' && <OutlineImport setExtractedDocs={setExtractedDocs} onNewUpload={handleReset}/> }
        <PreviewDocsImport extractedDocs={extractedDocs} />
        <Box $display="flex" $gap="medium">
          <Button 
            onClick={handleImport}
            fullWidth={true}
            disabled={importState !== 'idle'}
            active={importState === 'importing'}
          >
            {t('Import documents')}
          </Button>
          {importState === 'completed' && (
            <Button 
              onClick={handleBackToDocs}
              fullWidth={true}
              color="secondary"
            >
              {t('Back to documents')}
            </Button>
          )}
        </Box>
      </Box>
    </ImportContainer>
  );
};
