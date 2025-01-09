import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocDefaultFilter } from '@/features/docs';
import { useLeftPanelStore } from '@/features/left-panel';

export const LeftPanelTargetFilters = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { togglePanel } = useLeftPanelStore();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();
  const spacing = spacingsTokens();
  const colors = colorsTokens();

  const searchParams = useSearchParams();
  const target =
    (searchParams.get('target') as DocDefaultFilter) ??
    DocDefaultFilter.ALL_DOCS;

  const router = useRouter();

  const defaultQueries = useMemo(() => {
    return [
      {
        icon: 'apps',
        label: t('All docs'),
        targetQuery: DocDefaultFilter.ALL_DOCS,
      },
      {
        icon: 'lock',
        label: t('My docs'),
        targetQuery: DocDefaultFilter.MY_DOCS,
      },
      {
        icon: 'group',
        label: t('Shared with me'),
        targetQuery: DocDefaultFilter.SHARED_WITH_ME,
      },
    ];
  }, [t]);

  const onSelectQuery = (query: DocDefaultFilter) => {
    const params = new URLSearchParams(searchParams);
    params.set('target', query);
    router.replace(`${pathname}?${params.toString()}`);
    togglePanel();
  };

  return (
    <Box
      $justify="center"
      $padding={{ horizontal: 'sm' }}
      $gap={spacing['2xs']}
    >
      {defaultQueries.map((query) => {
        const isActive = target === query.targetQuery;

        return (
          <BoxButton
            aria-label={query.label}
            key={query.label}
            onClick={() => onSelectQuery(query.targetQuery)}
            $direction="row"
            aria-selected={isActive}
            $align="center"
            $justify="flex-start"
            $gap={spacing['xs']}
            $radius={spacing['3xs']}
            $padding={{ all: '2xs' }}
            $css={css`
              cursor: pointer;
              background-color: ${isActive
                ? colors['greyscale-100']
                : undefined};
              font-weight: ${isActive ? 700 : undefined};
              &:hover {
                background-color: ${colors['greyscale-100']};
              }
            `}
          >
            <Icon
              $variation={isActive ? '1000' : '700'}
              iconName={query.icon}
            />
            <Text $variation={isActive ? '1000' : '700'} $size="sm">
              {query.label}
            </Text>
          </BoxButton>
        );
      })}
    </Box>
  );
};
