import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { Box } from '../Box';

describe('<Box />', () => {
  it('has the padding from prop', () => {
    const { unmount } = render(<Box $padding="10px">My Box</Box>);

    expect(screen.getByText('My Box')).toHaveStyle('padding: 10px');

    unmount();

    render(
      <Box $padding={{ horizontal: 'xl', all: 'large', bottom: 'tiny' }}>
        My Box
      </Box>,
    );

    expect(screen.getByText('My Box')).toHaveStyle(`
      padding-left: 40px;
      padding-right: 40px;
      padding-top: 48px;
      padding-bottom: 8px;`);
  });

  it('has the margin from prop', () => {
    const { unmount } = render(<Box $margin="10px">My Box</Box>);
    expect(screen.getByText('My Box')).toHaveStyle('margin: 10px');

    unmount();

    render(
      <Box
        $margin={{
          horizontal: 'auto',
          vertical: 'big',
          bottom: 'full',
          all: 'xtiny',
        }}
      >
        My Box
      </Box>,
    );

    expect(screen.getByText('My Box')).toHaveStyle(`
      margin-left: auto;
      margin-right: auto;
      margin-top: 26px;
      margin-bottom: 100%;`);
  });
});
