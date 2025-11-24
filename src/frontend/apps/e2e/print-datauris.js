//utilitary script to print the datauris of the targeted assets

const fs = require('fs');
const path = require('path');

const ASSETS_ROOT = path.resolve(__dirname, '__tests__/app-impress/assets');

function saveDataUrl(file, mime, outName) {
    const abs = path.join(ASSETS_ROOT, file);
    const base64 = fs.readFileSync(abs).toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    const outPath = path.join(ASSETS_ROOT, outName);
    fs.writeFileSync(outPath, dataUrl, 'utf8');
    console.log(`Wrote ${outName}`);
}

// PNG
saveDataUrl('panopng.png', 'image/png', 'pano-png-dataurl.txt');

// JPG
saveDataUrl('panojpg.jpeg', 'image/jpeg', 'pano-jpg-dataurl.txt');

// SVG
const svgPath = path.join(ASSETS_ROOT, 'test.svg');
const svgText = fs.readFileSync(svgPath, 'utf8');
const svgDataUrl =
    'data:image/svg+xml;base64,' + Buffer.from(svgText).toString('base64');
fs.writeFileSync(path.join(ASSETS_ROOT, 'test-svg-dataurl.txt'), svgDataUrl, 'utf8');
console.log('Wrote test-svg-dataurl.txt');