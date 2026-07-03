/** Minimal shape of a BlockNote block as consumed by the presenter. */
export type PresenterBlock = {
  id?: string;
  type: string;
  content?: unknown;
  children?: PresenterBlock[];
};

export type PresenterTitleSlide = {
  kind: 'title';
  showDividerHint: boolean;
  title: string;
};

export type PresenterContentSlide = {
  blocks: unknown[];
  kind: 'content';
};

export type PresenterSlideData = PresenterTitleSlide | PresenterContentSlide;
