import { Alert, VariantType } from '@openfun/cunningham-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Box, Text, TextType } from '@/components';

const AlertStyled = styled(Alert)`
  & .c__button--tertiary:hover {
    background-color: var(--c--theme--colors--greyscale-200);
  }
`;

interface TextErrorsProps extends TextType {
  causes?: string[];
  defaultMessage?: string;
  icon?: ReactNode;
  canClose?: boolean;
}

export const TextErrors = ({
  causes,
  defaultMessage,
  icon,
  canClose = false,
  ...textProps
}: TextErrorsProps) => {
  const { t } = useTranslation();

  return (
    <AlertStyled
      canClose={canClose}
      type={VariantType.ERROR}
      icon={icon}
      className="--docs--text-errors"
    >
      <Box $direction="column" $gap="0.2rem">
        {causes &&
          causes.map((cause, i) => (
            <Text
              key={`causes-${i}`}
              $theme="danger"
              $variation="600"
              $textAlign="center"
              {...textProps}
            >
              {cause}
            </Text>
          ))}

        {!causes && (
          <Text
            $theme="danger"
            $variation="600"
            $textAlign="center"
            {...textProps}
          >
            {defaultMessage || t('Something bad happens, please retry.')}
          </Text>
        )}
      </Box>
    </AlertStyled>
  );
};
