import { Button } from '@gouvfr-lasuite/ui-components';
import { QuestionMark } from '@gouvfr-lasuite/ui-components/icons';
import { useTranslation } from 'react-i18next';

export const FeedbackButton = ({ url }: { url: string }) => {
  const { t } = useTranslation();

  return (
    <Button
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      color="error"
      variant="secondary"
      size="small"
      icon={<QuestionMark aria-hidden size={20} />}
    >
      {t('Give feedback')}
    </Button>
  );
};
