import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocDefaultFilter } from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';

export const LeftPanelTargetFilters = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { togglePanel } = useLeftPanelStore();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();

  const target =
    (searchParams.get('target') as DocDefaultFilter) ??
    DocDefaultFilter.ALL_DOCS;

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
    {
      icon: 'delete',
      label: t('Trashbin'),
      targetQuery: DocDefaultFilter.TRASHBIN,
    },
  ];

  const buildHref = (query: DocDefaultFilter) => {
    const params = new URLSearchParams(searchParams);
    params.set('target', query);
    return `${pathname}?${params.toString()}`;
  };

  const handleClick = () => {
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
        const href = buildHref(query.targetQuery);

        return (
          <StyledLink
            key={query.label}
            href={href}
            aria-label={query.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={handleClick}
            $css={css`
              display: flex;
              align-items: center;
              justify-content: flex-start;
              gap: ${spacingsTokens['xs']};
              padding: ${spacingsTokens['2xs']};
              border-radius: ${spacingsTokens['3xs']};
              background-color: ${isActive
                ? 'var(--c--contextuals--background--semantic--contextual--primary)'
                : 'transparent'};
              font-weight: ${isActive ? 700 : 400};
              color: inherit;
              text-decoration: none;
              cursor: pointer;
              &:hover {
                background-color: var(
                  --c--contextuals--background--semantic--contextual--primary
                );
              }
              &:focus-visible {
                outline: none !important;
                box-shadow: 0 0 0 2px ${colorsTokens['brand-400']} !important;
                border-radius: var(--c--globals--spacings--st);
              }
            `}
          >
            <Icon iconName={query.icon} />
            <Text $size="sm">{query.label}</Text>
          </StyledLink>
        );
      })}
    </Box>
  );
};
