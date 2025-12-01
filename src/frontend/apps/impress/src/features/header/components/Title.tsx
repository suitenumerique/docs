import { useTranslation } from 'react-i18next';

import { Text } from '@/components/';

type TitleSemanticsProps = {
  headingLevel?: 'h1' | 'h2' | 'h3';
};

export const Title = ({ headingLevel = 'h2' }: TitleSemanticsProps) => {
  const { t } = useTranslation();

  return (
    <Text
      className="--docs--title"
      $direction="row"
      $align="center"
      $margin="none"
      as={headingLevel}
      $zIndex={1}
      $size="1.375rem"
      $color="var(--c--contextuals--content--logo1)"
    >
      {t('Docs')}
    </Text>
  );
};
