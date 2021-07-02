// see https://remarkablemark.org/blog/2019/07/12/rollup-commonjs-umd/

import svelte         from 'rollup-plugin-svelte'
import commonjs       from '@rollup/plugin-commonjs'
import resolve        from '@rollup/plugin-node-resolve'
import autoPreprocess from 'svelte-preprocess'
import typescript     from '@rollup/plugin-typescript'
import postcss        from 'rollup-plugin-postcss'
import saveToFile     from 'save-to-file'

export default {
  input: './src/index.ts',
  output: [
    {
      file:     './dist/svelte-sortable-flat-list-view.esm.js',
      format:   'esm',
      sourcemap:true,
    }
  ],
  plugins: [
    svelte({ preprocess:[
      autoPreprocess({ aliases:[['ts','typescript']] }),
      saveToFile('./dist/svelte-sortable-flat-list-view.svelte')
    ]}),
    resolve({ browser:true, dedupe:['svelte'] }), commonjs(), typescript(),
    postcss({ extract:false, inject:{insertAt:'top'} }),
  ],
};