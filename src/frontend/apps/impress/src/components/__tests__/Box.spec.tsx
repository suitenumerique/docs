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
      padding-left: 2.5rem;
      padding-right: 2.5rem;
      padding-top: 3rem;
      padding-bottom: 0.5rem;`);
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
      margin-top: 1.625rem;
      margin-bottom: 100%;`);
  });
});
