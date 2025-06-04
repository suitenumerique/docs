import { Image, View } from '@react-pdf/renderer';
import mermaid from 'mermaid';

import { DocsExporterPDF } from '../types';
import { convertSvgToPng } from '../utils';

export const blockMappingMermaidBlockPDF: DocsExporterPDF['mappings']['blockMapping']['mermaid'] =
  async (block, _exporter) => {
    const _svgString = async () => {
      try {
        // Initialize mermaid with default settings
        mermaid.initialize({
          startOnLoad: true,
        });

        // Generate a unique ID for the diagram
        const diagramId = `mermaid-diagram-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram to SVG
        const { svg } = await mermaid.render(diagramId, block.props.diagram);
        return svg;
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        return '<svg><text x="10" y="20" fill="red">Invalid Mermaid diagram</text></svg>';
      }
    };

    const svgString = await _svgString();
    const pngData = await convertSvgToPng(svgString, 400);

    return (
      <View style={{ margin: '10px 0' }}>
        <Image src={pngData} />
      </View>
    );
  };
