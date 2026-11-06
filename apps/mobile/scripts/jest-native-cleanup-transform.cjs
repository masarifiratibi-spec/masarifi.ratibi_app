const babel = require('babel-jest').createTransformer({
  caller: { name: 'metro', bundler: 'metro', platform: 'ios' }
});
const ts = require('typescript');

module.exports = {
  ...babel,
  process(source, filename, options) {
    // Node/Jest cannot execute Metro's deferred native import. Compile this
    // plain service to CommonJS so Android tests exercise its real cleanup.
    if (
      filename
        .replaceAll('\\', '/')
        .endsWith('/services/account-data-erasure.ts')
    )
      return {
        code: ts.transpileModule(source, {
          fileName: filename,
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true
          }
        }).outputText
      };
    return babel.process(source, filename, options);
  }
};
