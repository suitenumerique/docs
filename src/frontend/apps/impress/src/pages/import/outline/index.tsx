import { Button, Loader } from '@openfun/cunningham-react';
import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { baseApiUrl } from '@/api';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t('Please select a .zip file'));
      return;
    }
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch(`${baseApiUrl('1.0')}imports/outline/upload`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      const data = (await resp.json()) as { created_document_ids: string[] };
      const first = data.created_document_ids?.[0];
      if (first) {
        void router.replace(`/docs/${first}`);
      } else {
        void router.replace('/');
      }
    } catch (e) {
      setError(t('Something bad happens, please retry.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box $padding={{ top: 'large' }} $width="100%" $height="100%" $align="center">
      <Text as="p" $margin={{ bottom: '12px' }}>
        {t('Import Outline archive')}
      </Text>
      <form onSubmit={onSubmit}>
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label={t('Select a .zip file')}
        />
        <Box $margin={{ top: '16px' }} $direction="row" $gap="8px" $align="center">
          <Button type="submit" disabled={!file || isUploading}>
            {t('Import')}
          </Button>
          {isUploading && <Loader />}
        </Box>
        {error && (
          <Text as="p" $margin={{ top: '10px' }}>
            {error}
          </Text>
        )}
      </form>
    </Box>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
