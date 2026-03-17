import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc } from '@/docs/doc-management';

import { Versions } from '../types';

const ModalConfirmationVersion = dynamic(
  () =>
    import('./ModalConfirmationVersion').then((mod) => ({
      default: mod.ModalConfirmationVersion,
    })),
  { ssr: false },
);

interface VersionItemProps {
  docId: Doc['id'];
  text: string;
  versionId?: Versions['version_id'];
  isActive: boolean;
  onSelect?: () => void;
}

export const VersionItem = ({
  docId,
  versionId,
  text,
  isActive,
  onSelect,
}: VersionItemProps) => {
  const { t } = useTranslation();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();

  const [isModalVersionOpen, setIsModalVersionOpen] = useState(false);

  return (
    <>
      <BoxButton
        aria-label={t('Restore version of {{date}}', { date: text })}
        aria-pressed={isActive}
        $width="100%"
        $css={`
          &:focus-visible {
            background: var(--c--globals--colors--gray-100);
            border-radius: var(--c--globals--spacings--st);
          }
        `}
        className="version-item"
        onClick={onSelect}
      >
        <Box
          $width="100%"
          as="span"
          $background={isActive ? colorsTokens['gray-100'] : 'transparent'}
          $radius={spacingsTokens['3xs']}
          $css={`
            cursor: pointer;

            &:hover {
              background: ${colorsTokens['gray-100']};
            }
          `}
          $hasTransition
          $minWidth="13rem"
          className="--docs--version-item"
        >
          <Box
            $padding={{ vertical: '0.7rem', horizontal: 'small' }}
            $align="center"
            $direction="row"
            $justify="space-between"
            $width="100%"
          >
            <Box $direction="row" $gap="0.5rem" $align="center">
              <Text $weight="bold" $size="sm">
                {text}
              </Text>
            </Box>
          </Box>
        </Box>
      </BoxButton>
      {isModalVersionOpen && versionId && (
        <ModalConfirmationVersion
          onClose={() => setIsModalVersionOpen(false)}
          docId={docId}
          versionId={versionId}
        />
      )}
    </>
  );
};
