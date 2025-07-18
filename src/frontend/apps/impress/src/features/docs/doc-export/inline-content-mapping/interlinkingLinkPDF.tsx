/* eslint-disable jsx-a11y/alt-text */
import { Image, Link } from '@react-pdf/renderer';

import DocSelectedIcon from '../assets/doc-selected.png';
import { DocsExporterPDF } from '../types';

export const inlineContentMappingInterlinkingLinkPDF: DocsExporterPDF['mappings']['inlineContentMapping']['interlinkingLinkInline'] =
  (inline) => {
    return (
      <Link
        src={window.location.origin + inline.props.url}
        style={{
          textDecoration: 'none',
          color: 'black',
        }}
      >
        {' '}
        <Image src={DocSelectedIcon.src} />
        {inline.props.title}{' '}
      </Link>
    );
  };
