import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "@rollup/plugin-terser";
import babel from "@rollup/plugin-babel";

const isProduction = process.env.NODE_ENV === "production";

export default [
  // ES Module build
  {
    input: "src/index.js",
    output: {
      file: "dist/pavekit.esm.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      babel({
        babelHelpers: "bundled",
        exclude: "node_modules/**",
        presets: [
          [
            "@babel/preset-env",
            {
              targets: {
                esmodules: true,
              },
            },
          ],
        ],
      }),
      isProduction &&
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
          mangle: {
            reserved: ["PaveKit", "PaveKitSDK"],
          },
        }),
    ].filter(Boolean),
  },

  // UMD build (minified)
  {
    input: "src/index.js",
    output: {
      file: "dist/pavekit.umd.min.js",
      format: "umd",
      name: "PaveKit",
      sourcemap: true,
      exports: "default",
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      babel({
        babelHelpers: "bundled",
        exclude: "node_modules/**",
        presets: [
          [
            "@babel/preset-env",
            {
              targets: {
                browsers: ["> 1%", "last 2 versions", "not dead", "not ie 11"],
              },
            },
          ],
        ],
      }),
      terser({
        compress: {
          drop_console: isProduction,
          drop_debugger: true,
          pure_funcs: isProduction ? ["console.log", "console.info"] : [],
        },
        mangle: {
          reserved: ["PaveKit", "PaveKitSDK"],
        },
        format: {
          comments: false,
        },
      }),
    ],
  },
];
