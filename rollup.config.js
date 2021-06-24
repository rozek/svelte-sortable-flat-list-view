// see https://remarkablemark.org/blog/2019/07/12/rollup-commonjs-umd/

import commonjs   from '@rollup/plugin-commonjs'
import resolve    from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript';

export default {
  input: './src/svelte-sortable-flat-list-view.ts',
  output: {
    file:     './dist/svelte-sortable-flat-list-view.esm.js',
    format:   'esm',
    sourcemap:true,
  },
  plugins: [
    resolve(), commonjs(), typescript(),
  ],
};