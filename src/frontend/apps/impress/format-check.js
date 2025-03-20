const prettier = require('prettier');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/LoginScreen.tsx');
const content = fs.readFileSync(filePath, 'utf8');

try {
  prettier.check(content, {
    parser: 'typescript',
    semi: true,
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 80,
    tabWidth: 2,
  });
  console.log('File is properly formatted');
} catch (error) {
  console.error('Formatting issues found:', error);
}
