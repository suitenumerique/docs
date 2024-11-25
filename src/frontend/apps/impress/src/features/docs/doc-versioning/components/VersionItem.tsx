import { Button } from '@openfun/cunningham-react';
import { PropsWithChildren, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, DropButton, IconOptions, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { Doc } from '@/features/docs/doc-management';

import { Versions } from '../types';

import { ModalVersion } from './ModalVersion';

interface VersionItemProps {
  docId: Doc['id'];
  text: string;
  link: string;
  versionId?: Versions['version_id'];
  isActive: boolean;
}

export const VersionItem = ({
  docId,
  versionId,
  text,
  link,
  isActive,
}: VersionItemProps) => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const [isDropOpen, setIsDropOpen] = useState(false);
  const [isModalVersionOpen, setIsModalVersionOpen] = useState(false);

  return (
    <>
      <Box
        as="li"
        $background={isActive ? colorsTokens()['primary-300'] : 'transparent'}
        $css={`
          border-left: 4px solid transparent;
          border-bottom: 1px solid ${colorsTokens()['primary-100']};
          &:hover{
            border-left: 4px solid ${colorsTokens()['primary-400']};
            background: ${colorsTokens()['primary-300']};
          }
        `}
        $hasTransition
        $minWidth="13rem"
      >
        <Link href={link} isActive={isActive}>
          <Box
            $padding={{ vertical: '0.7rem', horizontal: 'small' }}
            $align="center"
            $direction="row"
            $justify="space-between"
            $width="100%"
          >
            <Box $direction="row" $gap="0.5rem" $align="center">
              <Text
                $isMaterialIcon
                $size="24px"
                $theme="primary"
                $variation="600"
              >
                description
              </Text>
              <Text $weight="bold" $theme="primary" $size="m" $variation="600">
                {text}
              </Text>
            </Box>
            {isActive && versionId && (
              <DropButton
                button={
                  <IconOptions aria-label={t('Open the version options')} />
                }
                onOpenChange={(isOpen) => setIsDropOpen(isOpen)}
                isOpen={isDropOpen}
              >
                <Box>
                  <Button
                    onClick={() => {
                      setIsModalVersionOpen(true);
                    }}
                    color="primary-text"
                    icon={<span className="material-icons">save</span>}
                    size="small"
                  >
                    {t('Restore the version')}
                  </Button>
                </Box>
              </DropButton>
            )}
          </Box>
        </Link>
      </Box>
      {isModalVersionOpen && versionId && (
        <ModalVersion
          onClose={() => setIsModalVersionOpen(false)}
          docId={docId}
          versionId={versionId}
        />
      )}
    </>
  );
};

interface LinkProps {
  href: string;
  isActive: boolean;
}

const Link = ({ href, children, isActive }: PropsWithChildren<LinkProps>) => {
  return isActive ? (
    <>{children}</>
  ) : (
    <StyledLink href={href}>{children}</StyledLink>
  );
};
