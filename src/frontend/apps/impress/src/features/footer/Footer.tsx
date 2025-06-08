import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { Box, StyledLink, Text } from '@/components/';
import { useConfig } from '@/core/config';

import { Title } from '../header';

import IconLink from './assets/external-link.svg';
import { ContentType } from './types';

const BlueStripe = styled.div`
  position: absolute;
  height: 2px;
  width: 100%;
  background: var(--c--theme--colors--primary-600);
  top: 0;
`;

export const Footer = () => {
  const { data: config } = useConfig();
  const footerJson = config?.theme_customization?.footer;
  const { i18n, t } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage;
  const [content, setContent] = useState<ContentType>();

  useEffect(() => {
    if (!footerJson) {
      return;
    }

    const langData = footerJson[resolvedLanguage as keyof typeof footerJson];
    const innerContent: ContentType = {};

    innerContent.logo = langData?.logo || footerJson?.default?.logo;
    innerContent.legalLinks =
      langData?.legalLinks || footerJson?.default?.legalLinks;
    innerContent.externalLinks =
      langData && 'externalLinks' in langData
        ? langData?.externalLinks
        : footerJson?.default?.externalLinks;
    innerContent.bottomInformation =
      langData && 'bottomInformation' in langData
        ? langData?.bottomInformation
        : footerJson?.default?.bottomInformation;

    setContent(innerContent);
  }, [footerJson, resolvedLanguage]);

  const { logo, legalLinks, externalLinks, bottomInformation } = content || {};

  if (!footerJson || (!legalLinks && !externalLinks && !bottomInformation)) {
    return null;
  }

  return (
    <Box $position="relative" as="footer" className="--docs--footer">
      <BlueStripe />
      <Box $padding={{ top: 'large', horizontal: 'big', bottom: 'small' }}>
        <Box
          $direction="row"
          $gap="1.5rem"
          $align="center"
          $justify="space-between"
          $css="flex-wrap: wrap;"
        >
          <Box className="--docs--footer-logo">
            <Box $align="center" $gap="6rem" $direction="row">
              {logo && (
                <Box
                  $align="center"
                  $gap="0.5rem"
                  $direction="row"
                  $position="relative"
                  $height="fit-content"
                >
                  {logo?.src && (
                    <Image
                      className="c__image-system-filter"
                      priority
                      src={logo.src}
                      alt={logo?.alt || t('Logo')}
                      width={0}
                      height={0}
                      style={{ width: logo?.width || 'auto', height: 'auto' }}
                    />
                  )}
                  {logo.withTitle && (
                    <Box $css="zoom:1.4;">
                      <Title />
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
          <Box
            $direction="row"
            $css={`
              column-gap: 1.5rem;
              row-gap: .5rem;
              flex-wrap: wrap;
            `}
            className="--docs--footer-external-links"
          >
            {externalLinks &&
              externalLinks.map(({ label, href }) => (
                <StyledLink
                  key={label}
                  href={href}
                  target="__blank"
                  $css={`
                    gap:0.2rem;
                    transition: box-shadow 0.3s;
                    &:hover {
                      box-shadow: 0px 2px 0 0 var(--c--theme--colors--greyscale-text);
                    }
                  `}
                >
                  <Text $weight="bold">{label}</Text>
                  <IconLink width={18} />
                </StyledLink>
              ))}
          </Box>
        </Box>
        <Box
          $direction="row"
          $margin={{ top: 'big' }}
          $padding={{ top: 'tiny' }}
          $css={`
            flex-wrap: wrap;
            border-top: 1px solid var(--c--theme--colors--greyscale-200); 
            column-gap: 1rem;
            row-gap: .5rem;
          `}
          className="--docs--footer-internal-links"
        >
          {legalLinks &&
            legalLinks.map(({ label, href }) => (
              <StyledLink
                key={label}
                href={href}
                $css={css`
                  padding-right: 1rem;
                  &:not(:last-child) {
                    box-shadow: inset -1px 0px 0px 0px
                      var(--c--theme--colors--greyscale-200);
                  }
                `}
              >
                <Text
                  $variation="600"
                  $size="m"
                  $transition="box-shadow 0.3s"
                  $css={css`
                    &:hover {
                      box-shadow: 0px 2px 0 0
                        var(--c--theme--colors--greyscale-text);
                    }
                  `}
                >
                  {label}
                </Text>
              </StyledLink>
            ))}
        </Box>
        {bottomInformation && (
          <Text
            as="p"
            $size="m"
            $margin={{ top: 'big' }}
            $variation="600"
            $display="inline"
            className="--docs--footer-licence"
          >
            {bottomInformation.label}{' '}
            {bottomInformation.link && (
              <StyledLink
                href={bottomInformation.link.href}
                target="__blank"
                $css={css`
                  display: inline-flex;
                  box-shadow: 0px 1px 0 0
                    var(--c--theme--colors--greyscale-text);
                  gap: 0.2rem;
                `}
              >
                <Text $variation="600">{bottomInformation.link.label}</Text>
                <IconLink width={14} />
              </StyledLink>
            )}
          </Text>
        )}
      </Box>
    </Box>
  );
};
