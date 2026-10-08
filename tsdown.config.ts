import { defineConfig } from 'tsdown'
const banner = 'window.__ModuleLoader__.load({id:"dsh-input-assist",factory:(require)=>{var module={exports:{}};var exports=module.exports;'
const footer = 'return module.exports;}});'
export default defineConfig([
  {
    entry: { index: 'src/index.ts', 'native-host': 'src/native-host.ts' }, outDir: 'lib',
    format: 'esm', dts: true, sourcemap: true, target: 'node22', clean: false,
    external: [/^@deepseek-ai\//, 'react'], outputOptions: { entryFileNames: '[name].js' },
  },
  ...['client', 'native-client'].map(entry => ({
    entry: { [entry]: `src/${entry}.ts` }, outDir: 'lib', format: 'cjs' as const,
    dts: false, sourcemap: true, target: 'chrome110', clean: false,
    external: ['react', '@deepseek-ai/dsh-client-ui-primitives'],
    outputOptions: { entryFileNames: '[name].js', banner, footer },
  })),
])
