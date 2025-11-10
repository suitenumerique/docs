const config = {
  customValueTemplate: {
    message: '${key}',
    description: '${description}',
  },
  keepRemoved: false,
  keySeparator: false,
  nsSeparator: false,
  namespaceSeparator: false,
  lexers: {
    tsx: [
      {
        lexer: 'JsxLexer',
        functions: ['t'],
        transSupportBasicHtmlNodes: true, // Disable automatic conversion
        transKeepBasicHtmlNodesFor: ['strong', 'b', 'i', 'code', 'br'],
      },
    ],
  },
};

export default config;
