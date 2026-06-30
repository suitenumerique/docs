import { css } from 'styled-components';

import { Box, Text } from '@/components';

interface PresenterTitleSlideProps {
  title: string;
}

const titleSlideCss = css`
  position: relative;
  width: 100%;
  min-height: 520px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 96px 32px;
`;

const titleCss = css`
  max-width: 720px;
  margin: 0;
  color: var(--c--contextuals--content--semantic--neutral--primary);
  font-size: 40px;
  font-weight: 700;
  line-height: 48px;
  text-align: center;
  overflow-wrap: anywhere;
`;

export const PresenterTitleSlide = ({ title }: PresenterTitleSlideProps) => (
  <Box $css={titleSlideCss}>
    <Text as="h1" $css={titleCss}>
      {title}
    </Text>
  </Box>
);
