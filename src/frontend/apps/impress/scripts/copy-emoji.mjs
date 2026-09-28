/**
 * Copies Apple emoji images from emoji-datasource-apple into the public directory.
 * Used as a pre-step for both `dev` (Turbopack) and `build` (webpack) so that
 * neither pipeline needs a webpack CopyPlugin for this purpose.
 */
import { cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const src = resolve(
  __dirname,
  '../../../node_modules/emoji-datasource-apple/img/apple/64',
);
const dest = resolve(__dirname, '../public/assets/fonts/emoji');

cpSync(src, dest, { recursive: true, force: true });

console.log('✔ Emoji assets copied to public/assets/fonts/emoji');
