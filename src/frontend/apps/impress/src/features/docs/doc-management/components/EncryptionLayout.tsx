import type { StaticImageData } from 'next/image';
import { ReactNode } from 'react';
import { css } from 'styled-components';

import DocumentEncrypted from '@/assets/encryption/document-encrypted.svg';
import DocumentEncrypting from '@/assets/encryption/document-encrypting.svg';
import documentShieldCheck from '@/assets/encryption/document-shield-check.png';
import documentShieldX from '@/assets/encryption/document-shield-x.png';
import shieldCheck from '@/assets/encryption/shield-check.png';
import shieldX from '@/assets/encryption/shield-x.png';
import { Box, Text } from '@/components';

const MODAL_ILLUSTRATIONS = {
  'shield-check': shieldCheck,
  'shield-x': shieldX,
  'document-shield-check': documentShieldCheck,
  'document-shield-x': documentShieldX,
} satisfies Record<string, StaticImageData>;

const STATE_ILLUSTRATIONS = {
  'document-encrypted': DocumentEncrypted,
  'document-encrypting': DocumentEncrypting,
};

export type ModalIllustration = keyof typeof MODAL_ILLUSTRATIONS;
export type StateIllustration = keyof typeof STATE_ILLUSTRATIONS;

interface EncryptionModalContentProps {
  illustration?: ModalIllustration;
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  actionsLayout?: 'stack' | 'row';
}

/**
 * The content of an encryption modal: illustration, title, description, body
 * and stacked full-width actions. Rendered inside a Cunningham small modal
 * (widened to 350px by `globals.css`) with the modal's own close control.
 */
export const EncryptionModalContent = ({
  illustration,
  title,
  titleId,
  description,
  children,
  actions,
  actionsLayout = 'stack',
}: EncryptionModalContentProps) => (
  <Box className="--docs--encryption-modal" $gap="base">
    {illustration && (
      <Box $align="center">
        <img
          src={MODAL_ILLUSTRATIONS[illustration].src}
          alt=""
          width={142}
          height={100}
          style={{ display: 'block', objectFit: 'contain' }}
        />
      </Box>
    )}
    <Box $gap="3xs" $padding={{ right: 'base' }}>
      <Text
        as="h2"
        id={titleId}
        $size="18px"
        $weight="700"
        $margin="0"
        $css="line-height: 24px; overflow-wrap: anywhere;"
      >
        {title}
      </Text>
      {description && (
        <Text
          $size="sm"
          $variation="secondary"
          $css="line-height: 18px; overflow-wrap: anywhere;"
        >
          {description}
        </Text>
      )}
    </Box>
    {children && <Box $gap="sm">{children}</Box>}
    {actions && (
      <Box
        $direction={actionsLayout === 'row' ? 'row' : 'column'}
        $justify={actionsLayout === 'row' ? 'flex-end' : undefined}
        $gap={actionsLayout === 'row' ? 'sm' : 'xs'}
        $wrap="wrap"
        $css={
          actionsLayout === 'row'
            ? undefined
            : css`
                > .c__button {
                  width: 100%;
                  justify-content: center;
                }
              `
        }
      >
        {actions}
      </Box>
    )}
  </Box>
);

interface EncryptionEmptyStateProps {
  illustration?: StateIllustration;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

/**
 * A compact centered state on a page or in a panel: small illustration, bold
 * title, short description and text-link actions.
 */
export const EncryptionEmptyState = ({
  illustration = 'document-encrypted',
  title,
  description,
  children,
  actions,
}: EncryptionEmptyStateProps) => {
  const Illustration = STATE_ILLUSTRATIONS[illustration];

  return (
    <Box
      className="--docs--encryption-empty-state"
      $align="center"
      $justify="center"
      $margin="auto"
      $gap="base"
      $padding="md"
      $css="text-align: center;"
    >
      <Box $align="center" $gap="3xs" $maxWidth="320px">
        <Illustration aria-hidden="true" width={102} height={72} />
        <Text as="p" $size="sm" $weight="700" $margin="0" $textAlign="center">
          {title}
        </Text>
        {description && (
          <Text
            as="p"
            $size="xs"
            $variation="secondary"
            $margin="0"
            $textAlign="center"
          >
            {description}
          </Text>
        )}
      </Box>
      {children}
      {actions && (
        <Box $direction="row" $gap="xs" $wrap="wrap" $justify="center">
          {actions}
        </Box>
      )}
    </Box>
  );
};
