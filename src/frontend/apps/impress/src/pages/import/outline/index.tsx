import { Alert, Button, Loader, VariantType } from '@gouvfr-lasuite/cunningham-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { fetchAPI } from '@/api';
import { Box, Card, Icon, Text, TextErrors } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

type ImportStatus =
  | 'idle'
  | 'uploading'
  | 'pending'
  | 'scanning'
  | 'processing'
  | 'completed'
  | 'failed';

interface ImportJob {
  id: string;
  status: string;
  created_document_ids: string[];
  error_message: string;
}

const DropZone = styled(Box)<{ $isDragging: boolean; $hasFile: boolean }>`
  border: 2px dashed
    ${({ $isDragging, $hasFile, theme }) =>
      $isDragging
        ? 'var(--c--theme--colors--brand-500)'
        : $hasFile
          ? 'var(--c--theme--colors--success-500)'
          : 'var(--c--theme--colors--gray-300)'};
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--c--theme--colors--brand-400);
    background-color: var(--c--theme--colors--brand-100);
  }

  ${({ $isDragging }) =>
    $isDragging &&
    css`
      background-color: var(--c--theme--colors--brand-100);
    `}

  ${({ $hasFile }) =>
    $hasFile &&
    css`
      background-color: var(--c--theme--colors--success-100);
    `}
`;

const HiddenInput = styled.input`
  display: none;
`;

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorsTokens } = useCunninghamTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const pollJobStatus = useCallback(
    async (id: string) => {
      const maxAttempts = 120; // 2 minutes max
      let attempts = 0;

      const poll = async (): Promise<void> => {
        attempts++;
        if (attempts > maxAttempts) {
          setError(t('Import is taking too long. Please try again.'));
          setStatus('failed');
          return;
        }

        try {
          const response = await fetchAPI(`imports/outline/jobs/${id}/`);
          if (!response.ok) {
            throw new Error('Failed to fetch job status');
          }

          const job = (await response.json()) as ImportJob;

          if (job.status === 'completed') {
            setStatus('completed');
            const firstDocId = job.created_document_ids?.[0];
            if (firstDocId) {
              void router.replace(`/docs/${firstDocId}`);
            } else {
              void router.replace('/');
            }
            return;
          }

          if (job.status === 'failed') {
            setError(job.error_message || t('Import failed. Please try again.'));
            setStatus('failed');
            return;
          }

          // Update status based on job status
          if (job.status === 'scanning') {
            setStatus('scanning');
          } else if (job.status === 'processing') {
            setStatus('processing');
          } else {
            setStatus('pending');
          }

          // Continue polling
          setTimeout(() => void poll(), 1000);
        } catch {
          setError(t('Failed to check import status. Please try again.'));
          setStatus('failed');
        }
      };

      await poll();
    },
    [router, t],
  );

  const handleUpload = async () => {
    if (!file) return;

    setError(null);
    setStatus('uploading');

    try {
      const form = new FormData();
      form.append('file', file);

      const response = await fetchAPI('imports/outline/upload/', {
        method: 'POST',
        body: form,
        withoutContentType: true,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.file?.[0] || 'Upload failed');
      }

      const data = (await response.json()) as { job_id: string; status: string };
      setStatus('pending');

      // Start polling for job status
      await pollJobStatus(data.job_id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('Something went wrong. Please try again.'),
      );
      setStatus('failed');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.zip')) {
      setFile(droppedFile);
      setError(null);
      setStatus('idle');
    } else {
      setError(t('Please select a .zip file'));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setStatus('idle');
    }
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return t('Uploading archive...');
      case 'pending':
        return t('Preparing import...');
      case 'scanning':
        return t('Scanning for security...');
      case 'processing':
        return t('Creating documents...');
      case 'completed':
        return t('Import completed! Redirecting...');
      default:
        return null;
    }
  };

  const isProcessing = ['uploading', 'pending', 'scanning', 'processing', 'completed'].includes(
    status,
  );

  return (
    <>
      <Head>
        <title>{t('Import from Outline')} - {t('Docs')}</title>
      </Head>
      <Box
        $padding={{ all: 'large', top: 'xlarge' }}
        $width="100%"
        $maxWidth="600px"
        $margin="auto"
      >
        <Card $padding="large">
          <Box $gap="1.5rem">
            {/* Header */}
            <Box $align="center" $gap="0.5rem">
              <Icon
                iconName="upload_file"
                $size="2.5rem"
                $color={colorsTokens['brand-500']}
              />
              <Text as="h1" $size="1.5rem" $weight="bold" $textAlign="center">
                {t('Import from Outline')}
              </Text>
              <Text
                as="p"
                $size="0.875rem"
                $color={colorsTokens['gray-600']}
                $textAlign="center"
              >
                {t('Upload your Outline export (.zip) to import your documents')}
              </Text>
            </Box>

            {/* Drop Zone */}
            <DropZone
              $isDragging={isDragging}
              $hasFile={!!file}
              $padding="large"
              $align="center"
              $justify="center"
              $gap="1rem"
              $minHeight="200px"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleZoneClick}
              role="button"
              tabIndex={0}
              aria-label={t('Click or drag to select a file')}
            >
              <HiddenInput
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                disabled={isProcessing}
              />

              {file ? (
                <>
                  <Icon
                    iconName="check_circle"
                    $size="3rem"
                    $color={colorsTokens['success-500']}
                  />
                  <Text $weight="bold">{file.name}</Text>
                  <Text $size="0.875rem" $color={colorsTokens['gray-600']}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </>
              ) : (
                <>
                  <Icon
                    iconName="cloud_upload"
                    $size="3rem"
                    $color={colorsTokens['gray-400']}
                  />
                  <Text $weight="bold">{t('Drag and drop your file here')}</Text>
                  <Text $size="0.875rem" $color={colorsTokens['gray-600']}>
                    {t('or click to browse')}
                  </Text>
                  <Text $size="0.75rem" $color={colorsTokens['gray-500']}>
                    {t('Accepts .zip files only')}
                  </Text>
                </>
              )}
            </DropZone>

            {/* Status */}
            {isProcessing && (
              <Alert type={VariantType.INFO}>
                <Box $direction="row" $align="center" $gap="0.75rem">
                  <Loader size="small" />
                  <Text>{getStatusMessage()}</Text>
                </Box>
              </Alert>
            )}

            {/* Error */}
            {error && status === 'failed' && (
              <TextErrors causes={[error]} />
            )}

            {/* Success */}
            {status === 'completed' && (
              <Alert type={VariantType.SUCCESS}>
                <Text>{t('Import completed! Redirecting...')}</Text>
              </Alert>
            )}

            {/* Actions */}
            <Box $direction="row" $justify="flex-end" $gap="1rem">
              <Button
                color="secondary"
                onClick={() => router.back()}
                disabled={isProcessing}
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={() => void handleUpload()}
                disabled={!file || isProcessing}
                icon={isProcessing ? <Loader size="small" /> : undefined}
              >
                {isProcessing ? t('Importing...') : t('Import')}
              </Button>
            </Box>
          </Box>
        </Card>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
