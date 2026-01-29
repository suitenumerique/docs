import { Alert, VariantType } from '@gouvfr-lasuite/cunningham-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Box, Text, TextType } from '@/components';

const AlertStyled = styled(Alert)`
  & .c__button--tertiary:hover {
    background-color: var(--c--globals--colors--gray-200);
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
  return (
    <AlertStyled
      canClose={canClose}
      type={VariantType.ERROR}
      icon={icon}
      className="--docs--text-errors"
    >
      <TextOnlyErrors
        causes={causes}
        defaultMessage={defaultMessage}
        {...textProps}
      />
    </AlertStyled>
  );
};

export const TextOnlyErrors = ({
  causes,
  defaultMessage,
  ...textProps
}: TextErrorsProps) => {
  const { t } = useTranslation();

  return (
    <Box $direction="column" $gap="0.2rem">
      {causes &&
        causes.map((cause, i) => (
          <Text
            key={`causes-${i}`}
            $theme="error"
            $textAlign="center"
            {...textProps}
          >
            {cause}
          </Text>
        ))}

      {!causes && (
        <Text $theme="error" $textAlign="center" {...textProps}>
          {defaultMessage || t('Something bad happens, please retry.')}
        </Text>
      )}
    </Box>
  );
};
