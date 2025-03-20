const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/LoginScreen.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const program = ts.createProgram([filePath], {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.React,
  esModuleInterop: true,
  skipLibCheck: true,
});

const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length > 0) {
  console.error('TypeScript errors found:');
  diagnostics.forEach((diagnostic) => {
    console.error(diagnostic.messageText);
  });
} else {
  console.log('No TypeScript errors found');
}
