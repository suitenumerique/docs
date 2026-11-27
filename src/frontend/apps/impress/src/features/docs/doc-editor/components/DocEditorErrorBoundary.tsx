import * as Sentry from '@sentry/nextjs';
import { PropsWithChildren } from 'react';

import { UnexpectedErrorPage } from '@/components';

interface DocEditorErrorBoundaryProps {
  description?: string;
}

/**
 * Catches a render error of the editor, so that only the editor is replaced
 * by the error page: the header and its menu, with the history, stay usable.
 */
export const DocEditorErrorBoundary = ({
  children,
  description,
}: PropsWithChildren<DocEditorErrorBoundaryProps>) => (
  <Sentry.ErrorBoundary
    fallback={<UnexpectedErrorPage description={description} />}
    beforeCapture={(scope) => {
      scope.setTag('errorBoundary', 'doc-editor');
    }}
  >
    {children}
  </Sentry.ErrorBoundary>
);
