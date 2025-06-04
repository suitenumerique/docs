import { Image, View } from '@react-pdf/renderer';
import tex2svg from 'tex-to-svg';

import { DocsExporterPDF } from '../types';
import { convertSvgToPng } from '../utils';

export const blockMappingInlineLatexPDF: DocsExporterPDF['mappings']['inlineContentMapping']['inlineLatex'] =
  (content) => {
    const svgString = tex2svg(content.props.formula);
    const baseWidth = parseFloat(
      svgString.match(/width="([^"]+)"/)?.[1].replace('ex', '') || '0',
    );

    // Convert SVG to PNG synchronously
    const dataUri = convertSvgToPng(svgString, baseWidth * 30);

    return (
      <View>
        <Image src={dataUri} style={{ width: baseWidth * 10 }} />
      </View>
    );
  };
