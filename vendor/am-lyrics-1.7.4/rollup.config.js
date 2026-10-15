import path from 'node:path';
import { fileURLToPath } from 'node:url';
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { transform } from 'lightningcss';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(packageRoot, '../..');

export default {
  input: path.join(packageRoot, 'src/am-lyrics.ts'),
  output: {
    file: path.join(projectRoot, 'dist/vendor/am-lyrics-1.7.4.js'),
    format: 'esm',
    sourcemap: false,
  },
  plugins: [
    resolve({ browser: true }),
    typescript({ tsconfig: path.join(packageRoot, 'tsconfig.build.json') }),
    babel({
      babelrc: false,
      configFile: false,
      exclude: 'node_modules/**',
      extensions: ['.ts', '.tsx'],
      babelHelpers: 'bundled',
      plugins: [
        [
          'template-html-minifier',
          {
            modules: {
              lit: ['html', { name: 'css', encapsulation: 'style' }],
            },
            htmlMinifier: {
              collapseWhitespace: true,
              conservativeCollapse: true,
              removeComments: true,
              caseSensitive: true,
              minifyCSS: (source, type) =>
                type
                  ? source
                  : transform({
                      filename: 'component.css',
                      code: Buffer.from(source),
                      minify: true,
                    }).code.toString(),
            },
          },
        ],
      ],
    }),
  ],
};
