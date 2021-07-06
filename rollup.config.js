// see https://github.com/rozek/build-configuration-study

import svelte         from 'rollup-plugin-svelte'
import commonjs       from '@rollup/plugin-commonjs'
import resolve        from '@rollup/plugin-node-resolve'
import autoPreprocess from 'svelte-preprocess'
import typescript     from '@rollup/plugin-typescript'
import postcss        from 'rollup-plugin-postcss'
import saveToFile     from 'save-to-file'

export default {
  input: './src/index.ts',
  external: [
    'javascript-interface-library', 'locally-unique-id-generator',
    'svelte-device-info', 'svelte-coordinate-conversion',
    'svelte-drag-and-drop-actions'
  ],
  output: [
    {
      file:     './dist/svelte-sortable-flat-list-view.js',
      format:    'umd', // builds for both Node.js and Browser
      name:      'sortableFlatListView', // required for UMD modules
      globals: {
        'javascript-interface-library':'JIL',
        'locally-unique-id-generator': 'newUniqueId',
        'svelte-device-info':          'Device',
        'svelte-coordinate-conversion':'Conversion',
        'svelte-drag-and-drop-actions':'DragAndDropActions'
      },
      noConflict:true,
      sourcemap: true,
      exports:   'default',
    },{
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