import { PRESENTER_SLIDE_DESIGN_WIDTH } from '../constants';
import { PresenterSlideData } from '../types';

import { PresenterDocsLogo } from './PresenterDocsLogo';
import { PresenterSlideContent } from './PresenterSlideContent';

interface PresenterPrintDocumentProps {
  slides: PresenterSlideData[];
}

export const PRESENTER_PRINT_ROOT_ID = 'presenter-print-root';
export const PRESENTER_PRINT_STYLES_ID = 'presenter-print-styles';
export const PRESENTER_PRINT_PAGE_SELECTOR = '[data-presenter-print-page]';
export const PRESENTER_PRINT_PAGE_CLASS = '--docs--presenter-print-page';
export const PRESENTER_PRINT_CONTENT_CLASS = '--docs--presenter-print-content';
export const PRESENTER_PRINT_LOGO_CLASS = '--docs--presenter-print-logo';
export const PRESENTER_PRINT_TITLE_CLASS = '--docs--presenter-print-title';

export const PRESENTER_PRINT_CSS = `
@media screen {
  #${PRESENTER_PRINT_ROOT_ID} {
    position: fixed;
    top: 0;
    left: -100000px;
    width: 297mm;
    min-height: 210mm;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
}

@media print {
  @page {
    size: A4 landscape;
    margin: 0;
  }

  html,
  body {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: white !important;
  }

  body > *:not(#${PRESENTER_PRINT_ROOT_ID}) {
    display: none !important;
  }

  #${PRESENTER_PRINT_ROOT_ID} {
    display: block !important;
    position: static !important;
    width: auto !important;
    min-height: 0 !important;
    opacity: 1 !important;
    overflow: visible !important;
    pointer-events: auto !important;
    background: white !important;
  }

  .${PRESENTER_PRINT_PAGE_CLASS} {
    position: relative;
    width: 297mm;
    height: 210mm;
    box-sizing: border-box;
    padding: 18mm 24mm;
    display: flex;
    flex-direction: column;
    justify-content: safe center;
    overflow: hidden !important;
    background: white !important;
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .${PRESENTER_PRINT_PAGE_CLASS}:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .${PRESENTER_PRINT_CONTENT_CLASS} {
    width: ${PRESENTER_SLIDE_DESIGN_WIDTH}px;
    max-width: 100%;
    max-height: 100%;
    margin: 0 auto;
    overflow: hidden !important;
  }

  .${PRESENTER_PRINT_CONTENT_CLASS} .bn-editor,
  .${PRESENTER_PRINT_CONTENT_CLASS} .bn-root,
  .${PRESENTER_PRINT_CONTENT_CLASS} .ProseMirror {
    min-height: 0 !important;
  }

  .${PRESENTER_PRINT_CONTENT_CLASS} .bn-editor {
    padding: 0 !important;
  }

  .${PRESENTER_PRINT_CONTENT_CLASS} [data-content-type="file"] .bn-file-block-content-wrapper,
  .${PRESENTER_PRINT_CONTENT_CLASS} [data-content-type="pdf"] .bn-file-block-content-wrapper,
  .${PRESENTER_PRINT_CONTENT_CLASS} [data-content-type="audio"] .bn-file-block-content-wrapper,
  .${PRESENTER_PRINT_CONTENT_CLASS} [data-content-type="video"] .bn-file-block-content-wrapper {
    display: none !important;
  }

  .${PRESENTER_PRINT_CONTENT_CLASS} .print-url-label {
    text-decoration: none !important;
  }

  .${PRESENTER_PRINT_CONTENT_CLASS} * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .${PRESENTER_PRINT_LOGO_CLASS} {
    position: absolute;
    bottom: 16px;
    left: 16px;
    width: 80px;
    height: 32px;
  }

  .${PRESENTER_PRINT_TITLE_CLASS} {
    width: ${PRESENTER_SLIDE_DESIGN_WIDTH}px;
    max-width: 100%;
    margin: 0 auto;
    color: var(--c--contextuals--content--semantic--neutral--primary, #222631);
    font-size: 40px;
    font-weight: 700;
    line-height: 48px;
    text-align: center;
    overflow-wrap: anywhere;
  }
}
`;

export const PresenterPrintDocument = ({
  slides,
}: PresenterPrintDocumentProps) => (
  <div aria-hidden="true">
    {slides.map((slide, index) => (
      <section
        key={index}
        className={PRESENTER_PRINT_PAGE_CLASS}
        data-presenter-print-page
      >
        {slide.kind === 'title' ? (
          <h1 className={PRESENTER_PRINT_TITLE_CLASS}>{slide.title}</h1>
        ) : (
          <PresenterSlideContent
            blocks={slide.blocks}
            className={PRESENTER_PRINT_CONTENT_CLASS}
          />
        )}
        <div className={PRESENTER_PRINT_LOGO_CLASS}>
          <PresenterDocsLogo />
        </div>
      </section>
    ))}
  </div>
);
