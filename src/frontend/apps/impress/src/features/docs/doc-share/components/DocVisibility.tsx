import { VariantType, useToastProvider } from '@openfun/cunningham-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  DropdownMenu,
  DropdownMenuOption,
  Icon,
  Text,
} from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_DOC,
  KEY_LIST_DOC,
  LinkReach,
  LinkRole,
  useUpdateDocLink,
} from '@/features/docs';
import { useResponsiveStore } from '@/stores';

import { useTranslatedShareSettings } from '../hooks/';

interface DocVisibilityProps {
  doc: Doc;
}

export const DocVisibility = ({ doc }: DocVisibilityProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();
  const colors = colorsTokens();
  const [linkReach, setLinkReach] = useState<LinkReach>(doc.link_reach);
  const [docLinkRole, setDocLinkRole] = useState<LinkRole>(doc.link_role);
  const { linkModeTranslations, linkReachChoices, linkReachTranslations } =
    useTranslatedShareSettings();

  const api = useUpdateDocLink({
    onSuccess: () => {
      toast(
        t('The document visibility has been updated.'),
        VariantType.SUCCESS,
        {
          duration: 4000,
        },
      );
    },
    listInvalideQueries: [KEY_LIST_DOC, KEY_DOC],
  });

  const updateReach = (link_reach: LinkReach) => {
    api.mutate({ id: doc.id, link_reach });
    setLinkReach(link_reach);
  };

  const updateLinkRole = (link_role: LinkRole) => {
    api.mutate({ id: doc.id, link_role });
    setDocLinkRole(link_role);
  };

  const linkReachOptions: DropdownMenuOption[] = Object.keys(
    linkReachTranslations,
  ).map((key) => ({
    label: linkReachTranslations[key as LinkReach],
    icon: linkReachChoices[key as LinkReach].icon,
    callback: () => updateReach(key as LinkReach),
    isSelected: linkReach === (key as LinkReach),
  }));

  const linkMode: DropdownMenuOption[] = Object.keys(linkModeTranslations).map(
    (key) => ({
      label: linkModeTranslations[key as LinkRole],
      callback: () => updateLinkRole(key as LinkRole),
      isSelected: docLinkRole === (key as LinkRole),
    }),
  );

  const showLinkRoleOptions = doc.link_reach !== LinkReach.RESTRICTED;
  const description =
    docLinkRole === LinkRole.READER
      ? linkReachChoices[linkReach].descriptionReadOnly
      : linkReachChoices[linkReach].descriptionEdit;

  return (
    <Box
      $padding={{ horizontal: 'base' }}
      aria-label={t('Doc visibility card')}
      $gap={spacing['base']}
    >
      <Text $weight="700" $size="sm" $variation="700">
        {t('Link parameters')}
      </Text>
      <Box
        $direction="row"
        $align="center"
        $justify="space-between"
        $gap={spacing['xs']}
        $width="100%"
        $wrap="nowrap"
      >
        <Box
          $direction="row"
          $align={isDesktop ? 'center' : undefined}
          $padding={{ horizontal: '2xs' }}
          $gap={spacing['3xs']}
        >
          <DropdownMenu
            label={t('Visibility')}
            arrowCss={css`
              color: ${colors['primary-800']} !important;
            `}
            showArrow={true}
            options={linkReachOptions}
          >
            <Box $direction="row" $align="center" $gap={spacing['3xs']}>
              <Icon
                $theme="primary"
                $variation="800"
                iconName={linkReachChoices[linkReach].icon}
              />
              <Text $theme="primary" $variation="800">
                {linkReachChoices[linkReach].label}
              </Text>
            </Box>
          </DropdownMenu>
          {isDesktop && (
            <Text $size="xs" $variation="600">
              {description}
            </Text>
          )}
        </Box>
        {showLinkRoleOptions && (
          <Box $direction="row" $align="center" $gap={spacing['3xs']}>
            {linkReach !== LinkReach.RESTRICTED && (
              <DropdownMenu
                showArrow={true}
                options={linkMode}
                label={t('Visibility mode')}
              >
                <Text $weight="initial" $variation="600">
                  {linkModeTranslations[docLinkRole]}
                </Text>
              </DropdownMenu>
            )}
          </Box>
        )}
      </Box>
      {!isDesktop && (
        <Text $size="xs" $variation="600">
          {description}
        </Text>
      )}
    </Box>
  );
};
