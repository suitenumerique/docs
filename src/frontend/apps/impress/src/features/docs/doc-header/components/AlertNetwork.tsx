import {
  Button,
  ButtonElement,
  Modal,
  ModalSize,
} from '@gouvfr-lasuite/cunningham-react';
import { t } from 'i18next';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Card, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useFocusOnMount } from '@/hooks';

export const AlertNetwork = () => {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Box>
        <Card
          $direction="row"
          $justify="space-between"
          $width="100%"
          $radius={spacingsTokens['3xs']}
          $padding="xs"
          $flex={1}
          $align="center"
          $gap={spacingsTokens['2xs']}
          $theme="warning"
        >
          <Box
            $direction="row"
            $gap={spacingsTokens['2xs']}
            $align="center"
            $withThemeInherited
          >
            <Icon iconName="mobiledata_off" $withThemeInherited />
            <Text $withThemeInherited $weight={500}>
              {t('Others are editing. Your network prevent changes.')}
            </Text>
          </Box>
          <BoxButton
            $direction="row"
            $gap={spacingsTokens['3xs']}
            $align="center"
            onClick={() => setIsModalOpen(true)}
            $withThemeInherited
          >
            <Icon
              iconName="info"
              $withThemeInherited
              $size="md"
              $weight="500"
              $margin={{ top: 'auto' }}
            />
            <Text $withThemeInherited $weight="500" $size="xs">
              {t('Learn more')}
            </Text>
          </BoxButton>
        </Card>
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
  const okButtonRef = useRef<ButtonElement>(null);
  useFocusOnMount(okButtonRef);

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={() => onClose()}
      rightActions={
        <>
          <Button
            ref={okButtonRef}
            aria-label={t('OK')}
            onClick={onClose}
            color="error"
          >
            {t('I understand')}
          </Button>
        </>
      }
      size={ModalSize.MEDIUM}
      title={
        <Text $size="h6" as="h6" $margin={{ all: '0' }} $align="flex-start">
          {t("Why you can't edit the document?")}
        </Text>
      }
    >
      <Box
        aria-label={t('Content modal to explain why the user cannot edit')}
        className="--docs--modal-alert-network"
        $margin={{ top: 'md' }}
      >
        <Text $size="sm" $variation="secondary">
          {t(
            'Others are editing this document. Unfortunately your network blocks WebSockets, the technology enabling real-time co-editing.',
          )}
        </Text>
        <Text
          $size="sm"
          $variation="secondary"
          $margin={{ top: 'xs' }}
          $weight="bold"
          $display="inline"
        >
          {t("This means you can't edit until others leave.")}{' '}
          <Text
            $size="sm"
            $variation="secondary"
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
