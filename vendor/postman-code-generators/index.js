'use strict';

const LANGUAGE_LIST = [
  {
    key: 'curl',
    label: 'curl',
    syntax_mode: 'bash',
    variants: [{ key: 'curl' }]
  }
];

function getLanguageList() {
  return LANGUAGE_LIST;
}

function convert(language, variant, request, options, cb) {
  const header = '// Code generation disabled by policy.\n';
  const body = `// language: ${language}, variant: ${variant}\n`;
  const snippet = header + body;
  if (typeof cb === 'function') {
    cb(null, snippet);
  }
}

module.exports = {
  getLanguageList,
  convert
};
