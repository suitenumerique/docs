import { Button } from '@openfun/cunningham-react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { gotoLogin } from '@/features/auth';

export function LoginScreen() {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();

  return (
    <Box
      $css={css`
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: linear-gradient(
          135deg,
          ${colorsTokens()['primary-100']} 0%,
          ${colorsTokens()['primary-200']} 100%
        );
      `}
    >
      <Box
        $css={css`
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
          width: 90%;
          max-width: 400px;
        `}
      >
        <Text
          as="h1"
          $css={css`
            color: ${colorsTokens()['primary-600']};
            font-size: 2.5rem;
            margin-bottom: 2rem;
            font-weight: 700;
          `}
        >
          Areum Docs
        </Text>
        <Button
          color="primary"
          fullWidth
          size="medium"
          onClick={() => gotoLogin()}
        >
          {t('Login')}
        </Button>
        <Text
          as="p"
          $css={css`
            margin-top: 1.5rem;
            font-size: 0.875rem;
            color: ${colorsTokens()['secondary-text']};

            a {
              color: ${colorsTokens()['primary-600']};
              text-decoration: none;

              &:hover {
                text-decoration: underline;
              }
            }
          `}
        >
          Powered by{' '}
          <a
            href="https://github.com/suitenumerique/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </a>
        </Text>
      </Box>
    </Box>
  );
}
