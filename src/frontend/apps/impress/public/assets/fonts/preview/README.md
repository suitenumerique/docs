Fonts of the link preview card (`src/pages/api/doc-preview/[id].tsx`), all
under the SIL Open Font License 1.1:

- `Geist-Regular.ttf`: Geist, from `next/og`, https://github.com/vercel/geist-font
- `NotoSansHebrew-Regular.ttf`: Noto Sans Hebrew, https://github.com/notofonts/hebrew
- `Vazirmatn-Regular.ttf`: Vazirmatn, https://github.com/rastikerdar/vazirmatn

Vazirmatn rather than Noto Sans Arabic: the font engine of `next/og` fails on
some of Noto's Arabic tables, and Vazirmatn has the presentation forms the card
draws Arabic with.
