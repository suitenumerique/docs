import { Button, Modal, ModalSize } from '@openfun/cunningham-react';
import { t } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

export const AlertNetwork = () => {
  const { t } = useTranslation();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Box>
        <Box
          $direction="row"
          $justify="space-between"
          $width="100%"
          $background={colorsTokens['warning-100']}
          $radius={spacingsTokens['3xs']}
          $padding="xs"
          $flex={1}
          $align="center"
          $gap={spacingsTokens['3xs']}
          $css={css`
            border: 1px solid var(--c--theme--colors--warning-300);
          `}
        >
          <Box $direction="row" $gap={spacingsTokens['2xs']} $align="center">
            <Icon iconName="mobiledata_off" $theme="warning" $variation="600" />
            <Text $theme="warning" $variation="600" $weight={500}>
              {t('Others are editing. Your network prevent changes.')}
            </Text>
          </Box>
          <BoxButton
            $direction="row"
            $gap={spacingsTokens['3xs']}
            $align="center"
            onClick={() => setIsModalOpen(true)}
          >
            <Icon
              iconName="info"
              $theme="warning"
              $variation="600"
              $size="16px"
              $weight="500"
              $margin={{ top: 'auto' }}
            />
            <Text $theme="warning" $variation="600" $weight="500" $size="xs">
              {t('Learn more')}
            </Text>
          </BoxButton>
        </Box>
      </Box>
      {isModalOpen && (
        <AlertNetworkModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
};

interface AlertNetworkModalProps {
  onClose: () => void;
}

export const AlertNetworkModal = ({ onClose }: AlertNetworkModalProps) => {
  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      rightActions={
        <>
          <Button aria-label={t('OK')} onClick={onClose} color="danger">
            {t('I understand')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Text
          $size="h6"
          as="h6"
          $margin={{ all: '0' }}
          $align="flex-start"
          $variation="1000"
        >
          {t("Why you can't edit the document?")}
        </Text>
      }
    >
      <Box
        aria-label={t('Content modal to explain why the user cannot edit')}
        className="--docs--modal-alert-network"
        $margin={{ top: 'md' }}
      >
        <Text $size="sm" $variation="600">
          {t(
            'Others are editing this document. Unfortunately your network blocks WebSockets, the technology enabling real-time co-editing.',
          )}
        </Text>
        <Text
          $size="sm"
          $variation="600"
          $margin={{ top: 'xs' }}
          $weight="bold"
          $display="inline"
        >
          {t("This means you can't edit until others leave.")}{' '}
          <Text
            $size="sm"
            $variation="600"
            $margin={{ top: 'xs' }}
            $weight="normal"
            $display="inline"
          >
            {t(
              'If you wish to be able to co-edit in real-time, contact your Information Systems Security Manager about allowing WebSockets.',
            )}
          </Text>
        </Text>
      </Box>
    </Modal>
  );
};
