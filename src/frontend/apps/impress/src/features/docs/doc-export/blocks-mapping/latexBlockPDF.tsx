import { Image, View } from '@react-pdf/renderer';
import tex2svg from 'tex-to-svg';

import { DocsExporterPDF } from '../types';
import { convertSvgToPng } from '../utils';

export const blockMappingLatexBlockPDF: DocsExporterPDF['mappings']['blockMapping']['latex'] =
  async (block, _exporter) => {
    const svgString = tex2svg(block.props.formula);
    const baseWidth = parseFloat(
      svgString.match(/width="([^"]+)"/)?.[1].replace('ex', '') || '0',
    );
    // const baseHeight = parseFloat(
    //   svgString.match(/height="([^"]+)"/)?.[1].replace('ex', '') || '0',
    // );

    const dataUri = await convertSvgToPng(svgString, baseWidth * 30);

    //TODO finish implementation of latex block
    return (
      <View
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Image src={dataUri} style={{ width: baseWidth * 7 }} />
      </View>
    );
  };
