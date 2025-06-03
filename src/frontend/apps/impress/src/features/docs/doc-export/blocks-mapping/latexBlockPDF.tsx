import { Image, View } from '@react-pdf/renderer';
import tex2svg from 'tex-to-svg';

import { DocsExporterPDF } from '../types';
import { convertSvgToPng } from '../utils';

export const blockMappingLatexBlockPDF: DocsExporterPDF['mappings']['blockMapping']['latex'] =
  async (block, _exporter) => {
    const _svgString = tex2svg(block.props.formula);
    const dataUri = await convertSvgToPng(_svgString, 1000);
    //TODO finish implementation of latex block
    return (
      <View wrap={false}>
        <Image src={dataUri} />
      </View>
    );
  };
