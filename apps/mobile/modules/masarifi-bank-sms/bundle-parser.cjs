const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function bundleBankSmsParser(projectRoot) {
  const parser = join(projectRoot, '../../packages/transaction-parser');
  const sources = {
    './parser': readFileSync(join(parser, 'index.js'), 'utf8'),
    './nominal-tracking': readFileSync(
      join(parser, 'nominal-tracking.js'),
      'utf8'
    ),
    './default-rules.json': `module.exports = ${JSON.stringify(JSON.parse(readFileSync(join(parser, 'default-rules.json'), 'utf8')))};`,
    './corpus.json': 'module.exports = [];',
    './classifier': readFileSync(
      join(__dirname, 'ios/classify-bank-sms.cjs'),
      'utf8'
    )
  };
  const modules = Object.entries(sources).map(
    ([id, source]) =>
      `${JSON.stringify(id)}: function(module, require) {\n${source}\n}`
  );
  return `globalThis.masarifiClassifyBankSms = (function () {
    const modules = {${modules.join(',\n')}};
    const cache = Object.create(null);
    function load(id) {
      if (!Object.hasOwn(modules, id)) throw new Error('Unexpected parser dependency');
      if (!cache[id]) {
        const module = {exports: {}};
        cache[id] = module;
        modules[id](module, load);
      }
      return cache[id].exports;
    }
    return load('./classifier');
  })();`;
}

module.exports = { bundleBankSmsParser };
