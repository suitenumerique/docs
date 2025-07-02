import {
  Button,
  VariantType,
  useToastProvider,
} from '@openfun/cunningham-react';
import { useCallback, useMemo, useState } from 'react';
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
  docLinkIsDesync,
  getDocLinkReach,
  useUpdateDocLink,
} from '@/features/docs';
import { useResponsiveStore } from '@/stores';

import { useTranslatedShareSettings } from '../hooks/';

import Desync from './../assets/desynchro.svg';
import Undo from './../assets/undo.svg';

interface DocVisibilityProps {
  doc: Doc;
  canEdit?: boolean;
}

export const DocVisibility = ({ doc, canEdit = true }: DocVisibilityProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { isDesktop } = useResponsiveStore();
  const { spacingsTokens, colorsTokens } = useCunninghamTheme();
  const canManage = doc.abilities.accesses_manage && canEdit;
  const [linkReach, setLinkReach] = useState<LinkReach>(getDocLinkReach(doc));
  const [docLinkRole, setDocLinkRole] = useState<LinkRole>(
    doc.computed_link_role ?? LinkRole.READER,
  );

  const { linkModeTranslations, linkReachChoices, linkReachTranslations } =
    useTranslatedShareSettings();

  const description =
    docLinkRole === LinkRole.READER
      ? linkReachChoices[linkReach].descriptionReadOnly
      : linkReachChoices[linkReach].descriptionEdit;

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

  const updateReach = useCallback(
    (link_reach: LinkReach, link_role?: LinkRole) => {
      const params: {
        id: string;
        link_reach: LinkReach;
        link_role?: LinkRole;
      } = {
        id: doc.id,
        link_reach,
      };

      api.mutate(params);
      setLinkReach(link_reach);
      if (link_role) {
        params.link_role = link_role;
        setDocLinkRole(link_role);
      }
    },
    [api, doc.id],
  );

  const updateLinkRole = useCallback(
    (link_role: LinkRole) => {
      api.mutate({ id: doc.id, link_role });
      setDocLinkRole(link_role);
    },
    [api, doc.id],
  );

  const linkReachOptions: DropdownMenuOption[] = useMemo(() => {
    return Object.values(LinkReach).map((key) => {
      const isDisabled =
        doc.abilities.link_select_options[key as LinkReach] === undefined;

      return {
        label: linkReachTranslations[key as LinkReach],
        callback: () => updateReach(key as LinkReach),
        isSelected: linkReach === (key as LinkReach),
        disabled: isDisabled,
      };
    });
  }, [doc, linkReach, linkReachTranslations, updateReach]);

  const haveDisabledOptions = linkReachOptions.some(
    (option) => option.disabled,
  );

  const showLinkRoleOptions = doc.computed_link_reach !== LinkReach.RESTRICTED;

  const linkRoleOptions: DropdownMenuOption[] = useMemo(() => {
    const options = doc.abilities.link_select_options[linkReach] ?? [];
    return Object.values(LinkRole).map((key) => {
      const isDisabled = !options.includes(key);
      return {
        label: linkModeTranslations[key],
        callback: () => updateLinkRole(key),
        isSelected: docLinkRole === key,
        disabled: isDisabled,
      };
    });
  }, [doc, docLinkRole, linkModeTranslations, updateLinkRole, linkReach]);

  const haveDisabledLinkRoleOptions = linkRoleOptions.some(
    (option) => option.disabled,
  );

  const undoDesync = () => {
    const params: {
      id: string;
      link_reach: LinkReach;
      link_role?: LinkRole;
    } = {
      id: doc.id,
      link_reach: doc.ancestors_link_reach,
    };
    if (doc.ancestors_link_role) {
      params.link_role = doc.ancestors_link_role;
    }
    api.mutate(params);
    setLinkReach(doc.ancestors_link_reach);
    if (doc.ancestors_link_role) {
      setDocLinkRole(doc.ancestors_link_role);
    }
  };

  const showDesync = useMemo(() => {
    return docLinkIsDesync(doc);
  }, [doc]);

  return (
    <Box
      $padding={{ horizontal: 'base' }}
      aria-label={t('Doc visibility card')}
      $gap={spacingsTokens['base']}
      className="--docs--doc-visibility"
    >
      <Text $weight="700" $size="sm" $variation="700">
        {t('Link parameters')}
      </Text>
      {showDesync && (
        <Box
          $background={colorsTokens['primary-100']}
          $padding="3xs"
          $direction="row"
          $align="center"
          $justify="space-between"
          $gap={spacingsTokens['4xs']}
          $color={colorsTokens['primary-800']}
          $css={css`
            border: 1px solid ${colorsTokens['primary-300']};
            border-radius: ${spacingsTokens['2xs']};
          `}
        >
          <Box $direction="row" $align="center" $gap={spacingsTokens['3xs']}>
            <Desync />
            <Text $size="xs" $theme="primary" $variation="800" $weight="400">
              {t('Sharing rules differ from the parent page')}
            </Text>
          </Box>
          {doc.abilities.accesses_manage && (
            <Button
              onClick={undoDesync}
              size="small"
              color="primary-text"
              icon={<Undo />}
            >
              {t('Restore')}
            </Button>
          )}
        </Box>
      )}
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
                iconName={linkReachChoices[linkReach].icon}
              />
              <Text
                $theme={canManage ? 'primary' : 'greyscale'}
                $variation={canManage ? '800' : '600'}
                $weight="500"
                $size="md"
              >
                {linkReachChoices[linkReach].label}
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
            {linkReach !== LinkReach.RESTRICTED && (
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
