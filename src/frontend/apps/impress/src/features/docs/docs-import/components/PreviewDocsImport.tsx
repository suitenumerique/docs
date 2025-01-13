import styled from 'styled-components';
import { Box } from '@/components/Box';
import { Text } from '@/components/Text';
import { DocToImport } from "../types";
import { useMemo } from 'react';

const PreviewContainer = styled(Box)`
  max-height: 400px;
  overflow-y: auto;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
`;

const DocItem = styled(Box)`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
`;

const StatusDot = styled.div<{ $state: DocToImport['state'] }>`
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background-color: ${({ $state }) => 
    $state === 'success' ? '#34D399' :
    $state === 'error' ? '#F87171' :
    '#60A5FA'
  };
`;

const StatusBadge = styled(Text)<{ $state: DocToImport['state'] }>`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  ${({ $state }) => {
    switch ($state) {
      case 'success':
        return 'background-color: #D1FAE5; color: #047857;';
      case 'error':
        return 'background-color: #FEE2E2; color: #B91C1C;';
      default:
        return 'background-color: #DBEAFE; color: #1D4ED8;';
    }
  }}
`;

const ProgressContainer = styled(Box)`
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 0.5rem;
  background-color: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
`;

const ProgressSegment = styled.div<{ $width: number; $type: 'success' | 'error' | 'pending' }>`
  height: 100%;
  width: ${({ $width }) => `${$width}%`};
  background-color: ${({ $type }) =>
    $type === 'success' ? '#34D399' :
    $type === 'error' ? '#F87171' :
    '#60A5FA'
  };
  transition: width 0.3s ease;
`;

const DocTreeItem = ({ docToImport, depth = 0 }: { docToImport: DocToImport; depth?: number }) => {
  return (
    <Box>
      <DocItem 
        key={docToImport.doc.title} 
        $background="white"
        style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
      >
        <StatusDot $state={docToImport.state} aria-hidden="true" />
        <Text style={{ 
          fontWeight: 500, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          flexGrow: 1
        }}>
          {docToImport.doc.title}
        </Text>
        <StatusBadge $state={docToImport.state}>
          {docToImport.state}
        </StatusBadge>
        {docToImport.error && (
          <Text 
            color="danger"
            style={{ fontSize: '0.875rem' }}
          >
            {docToImport.error.message || String(docToImport.error)}
          </Text>
        )}
      </DocItem>
      {docToImport.children?.map((child) => (
        <DocTreeItem 
          key={child.doc.title}
          docToImport={child}
          depth={depth + 1}
        />
      ))}
    </Box>
  );
};

export const PreviewDocsImport = ({ extractedDocs }: { extractedDocs: DocToImport[] }) => {
  const stats = useMemo(() => {
    const calculateStats = (docs: DocToImport[]): { total: number; success: number; error: number } => {
      return docs.reduce((acc, doc) => {
        const childStats = doc.children ? calculateStats(doc.children) : { total: 0, success: 0, error: 0 };
        return {
          total: acc.total + 1 + childStats.total,
          success: acc.success + (doc.state === 'success' ? 1 : 0) + childStats.success,
          error: acc.error + (doc.state === 'error' ? 1 : 0) + childStats.error,
        };
      }, { total: 0, success: 0, error: 0 });
    };

    return calculateStats(extractedDocs);
  }, [extractedDocs]);

  const successPercentage = (stats.success / stats.total) * 100;
  const errorPercentage = (stats.error / stats.total) * 100;
  const pendingPercentage = 100 - successPercentage - errorPercentage;

  return (
    <Box>
      <PreviewContainer $background="white" $padding="none">
        <Box $padding="small">
          {extractedDocs.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#6B7280', padding: '1rem 0' }}>
              No documents to import
            </Text>
          ) : (
            <Box>
              {extractedDocs.map((docToImport) => (
                <DocTreeItem 
                  key={docToImport.doc.title}
                  docToImport={docToImport}
                />
              ))}
            </Box>
          )}
        </Box>
      </PreviewContainer>

      {extractedDocs.length > 0 && (
        <ProgressContainer>
          <ProgressBar>
            <ProgressSegment $width={successPercentage} $type="success" />
            <ProgressSegment $width={errorPercentage} $type="error" />
            <ProgressSegment $width={pendingPercentage} $type="pending" />
          </ProgressBar>
          <Box $display="flex" $justifyContent="space-between" $marginTop="small">
            <Text style={{ fontSize: '0.875rem', color: '#6B7280' }}>
              {Math.round(successPercentage)}% completed
            </Text>
            {errorPercentage > 0 && (
              <Text style={{ fontSize: '0.875rem', color: '#B91C1C' }}>
                {Math.round(errorPercentage)}% failed
              </Text>
            )}
          </Box>
        </ProgressContainer>
      )}
    </Box>
  );
};