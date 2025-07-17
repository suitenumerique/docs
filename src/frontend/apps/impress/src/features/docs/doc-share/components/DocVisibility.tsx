import { useMemo } from 'react';
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
  getDocLinkReach,
  useUpdateDocLink,
} from '@/docs/doc-management';
import { useTreeUtils } from '@/docs/doc-tree';
import { useResponsiveStore } from '@/stores';

import { useTranslatedShareSettings } from '../hooks/';

import { DocDesynchronized } from './DocDesynchronized';

interface DocVisibilityProps {
  doc: Doc;
}

export const DocVisibility = ({ doc }: DocVisibilityProps) => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const canManage = doc.abilities.accesses_manage;
  const docLinkReach = getDocLinkReach(doc);
  const docLinkRole = doc.computed_link_role ?? LinkRole.READER;
  const { isDesynchronized } = useTreeUtils(doc);
  const { linkModeTranslations, linkReachChoices, linkReachTranslations } =
    useTranslatedShareSettings();

  const description =
    docLinkRole === LinkRole.READER
      ? linkReachChoices[docLinkReach].descriptionReadOnly
      : linkReachChoices[docLinkReach].descriptionEdit;

  const { mutate: updateDocLink } = useUpdateDocLink({
    listInvalideQueries: [KEY_LIST_DOC, KEY_DOC],
  });

  const linkReachOptions: DropdownMenuOption[] = useMemo(() => {
    return Object.values(LinkReach).map((key) => {
      const isDisabled = doc.abilities.link_select_options[key] === undefined;

      return {
        label: linkReachTranslations[key],
        callback: () =>
          updateDocLink({
            id: doc.id,
            link_reach: key,
          }),
        isSelected: docLinkReach === key,
        disabled: isDisabled,
      };
    });
  }, [
    doc.abilities.link_select_options,
    doc.id,
    docLinkReach,
    linkReachTranslations,
    updateDocLink,
  ]);

  const haveDisabledOptions = linkReachOptions.some(
    (option) => option.disabled,
  );

  const showLinkRoleOptions = doc.computed_link_reach !== LinkReach.RESTRICTED;

  const linkRoleOptions: DropdownMenuOption[] = useMemo(() => {
    const options = doc.abilities.link_select_options[docLinkReach] ?? [];
    return Object.values(LinkRole).map((key) => {
      const isDisabled = !options.includes(key);
      return {
        label: linkModeTranslations[key],
        callback: () => updateDocLink({ id: doc.id, link_role: key }),
        isSelected: docLinkRole === key,
        disabled: isDisabled,
      };
    });
  }, [
    doc.abilities.link_select_options,
    doc.id,
    docLinkReach,
    docLinkRole,
    linkModeTranslations,
    updateDocLink,
  ]);

  const haveDisabledLinkRoleOptions = linkRoleOptions.some(
    (option) => option.disabled,
  );

  return (
    <Box
      $padding={{ horizontal: 'base' }}
      aria-label={t('Doc visibility card')}
      $gap={spacingsTokens['base']}
      className="--docs--doc-visibility"
    >
      <Text $weight="700" $size="sm" $variation="700">
        {t('Link settings')}
      </Text>
      {isDesynchronized && <DocDesynchronized doc={doc} />}
      <Box
        $direction="row"
        $align="center"
        $justify="space-between"
        $gap={spacingsTokens['xs']}
        $width="100%"
        $wrap="nowrap"
      >
        <Box
          $direction="row"
          $align={isDesktop ? 'center' : undefined}
          $padding={{ horizontal: '2xs' }}
          $gap={canManage ? spacingsTokens['3xs'] : spacingsTokens['base']}
        >
          <DropdownMenu
            label={t('Visibility')}
            arrowCss={css`
              color: ${colorsTokens['primary-800']} !important;
            `}
            disabled={!canManage}
            showArrow={true}
            topMessage={
              haveDisabledOptions
                ? t(
                    'You cannot restrict access to a subpage relative to its parent page.',
                  )
                : undefined
            }
            options={linkReachOptions}
          >
            <Box $direction="row" $align="center" $gap={spacingsTokens['3xs']}>
              <Icon
                $theme={canManage ? 'primary' : 'greyscale'}
                $variation={canManage ? '800' : '600'}
                iconName={linkReachChoices[docLinkReach].icon}
              />
              <Text
                $theme={canManage ? 'primary' : 'greyscale'}
                $variation={canManage ? '800' : '600'}
                $weight="500"
                $size="md"
              >
                {linkReachChoices[docLinkReach].label}
              </Text>
            </Box>
          </DropdownMenu>
          {isDesktop && (
            <Text $size="xs" $variation="600" $weight="400">
              {description}
            </Text>
          )}
        </Box>
        {showLinkRoleOptions && (
          <Box $direction="row" $align="center" $gap={spacingsTokens['3xs']}>
            {docLinkReach !== LinkReach.RESTRICTED && (
              <DropdownMenu
                disabled={!canManage}
                showArrow={true}
                options={linkRoleOptions}
                topMessage={
                  haveDisabledLinkRoleOptions
                    ? t(
                        'You cannot restrict access to a subpage relative to its parent page.',
                      )
                    : undefined
                }
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
