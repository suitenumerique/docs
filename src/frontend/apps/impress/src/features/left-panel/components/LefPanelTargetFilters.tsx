import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocDefaultFilter } from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';

export const LeftPanelTargetFilters = () => {
  const { t } = useTranslation();

  const pathname = usePathname();
  const { togglePanel } = useLeftPanelStore();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();

  const searchParams = useSearchParams();
  const target =
    (searchParams.get('target') as DocDefaultFilter) ??
    DocDefaultFilter.ALL_DOCS;

  const router = useRouter();

  const defaultQueries = [
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

  const onSelectQuery = (query: DocDefaultFilter) => {
    const params = new URLSearchParams(searchParams);
    params.set('target', query);
    router.push(`${pathname}?${params.toString()}`);
    togglePanel();
  };

  return (
    <Box
      $justify="center"
      $padding={{ horizontal: 'sm' }}
      $gap={spacingsTokens['2xs']}
      className="--docs--left-panel-target-filters"
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
            $gap={spacingsTokens['xs']}
            $radius={spacingsTokens['3xs']}
            $padding={{ all: '2xs' }}
            $css={css`
              cursor: pointer;
              background-color: ${isActive
                ? colorsTokens['greyscale-100']
                : undefined};
              font-weight: ${isActive ? 700 : undefined};
              &:hover {
                background-color: ${colorsTokens['greyscale-100']};
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
