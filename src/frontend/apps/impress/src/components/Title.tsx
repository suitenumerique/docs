import { useTranslation } from 'react-i18next';

import { Text, TextType } from '@/components/';

type TitleSemanticsProps = TextType & {
  headingLevel?: 'h1' | 'h2' | 'h3';
  className?: string;
};

export const Title = ({
  headingLevel = 'h2',
  ...props
}: TitleSemanticsProps) => {
  const { t } = useTranslation();

  return (
    <Text
      className={`--docs--title${props.className ? ` ${props.className}` : ''}`}
      $direction="row"
      $align="center"
      $margin="none"
      as={headingLevel}
      $zIndex={1}
      $size="1.375rem"
      $color="var(--c--contextuals--content--logo1)"
      {...props}
    >
      {t('Docs')}
    </Text>
  );
};
