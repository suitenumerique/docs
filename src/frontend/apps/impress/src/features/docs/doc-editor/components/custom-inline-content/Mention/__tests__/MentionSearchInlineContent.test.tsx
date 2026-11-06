import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MentionSearchRender } from '../MentionSearchInlineContent';

vi.mock('../Search', () => ({ Search: () => <div>search</div> }));

const renderSearch = ({ isEditable = true, disabled = false } = {}) =>
  render(
    <MentionSearchRender
      editor={{ isEditable } as any}
      inlineContent={{ props: { disabled, trigger: '@' } } as any}
      updateInlineContent={vi.fn()}
      contentRef={vi.fn()}
      node={{} as any}
      getPos={() => 1}
    />,
  );

describe('MentionSearchRender', () => {
  it('renders the search in an editable editor', () => {
    renderSearch();

    expect(screen.getByText('search')).toBeInTheDocument();
  });

  it.each([
    ['the editor is read-only', { isEditable: false }],
    ['the search is disabled', { disabled: true }],
  ])('renders nothing when %s', (_, options) => {
    renderSearch(options);

    expect(screen.queryByText('search')).not.toBeInTheDocument();
  });
});
