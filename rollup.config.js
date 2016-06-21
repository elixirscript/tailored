import { rollup } from 'rollup';
import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/index.js',
  dest: 'lib/tailored.js',
  sourceMap: 'inline',
  format: 'cjs',
  plugins: [
    babel({
      babelrc: false
    })
  ]
};
