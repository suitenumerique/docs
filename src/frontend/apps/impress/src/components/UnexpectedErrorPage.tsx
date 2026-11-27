import { useTranslation } from 'react-i18next';

import Error500Svg from '@/assets/icons/error-500.svg';

import { ErrorPage } from './ErrorPage';

interface UnexpectedErrorPageProps {
  description?: string;
}

/**
 * Shown for an error nothing else handled: by `_error.tsx` in place of the
 * whole page, and by the editor error boundary in place of the editor only.
 */
export const UnexpectedErrorPage = ({
  description,
}: UnexpectedErrorPageProps) => {
  const { t } = useTranslation();

  return (
    <ErrorPage
      illustration={<Error500Svg aria-hidden="true" />}
      title={t('An unexpected error occurred.', {
        description: 'Generic error page title and message',
      })}
      description={
        description ??
        t(
          'An unexpected error occurred. Go grab a coffee or try to refresh the page.',
          { description: 'Message of the server error page, informal tone' },
        )
      }
    />
  );
};
