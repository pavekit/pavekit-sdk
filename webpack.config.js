const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    entry: {
      pavekit: "./src/index.js",
    },

    output: {
      path: path.resolve(__dirname, "dist"),
      filename: isProduction ? "[name].min.js" : "[name].js",
      library: "PaveKit",
      libraryTarget: "umd",
      libraryExport: "default",
      globalObject: "typeof self !== 'undefined' ? self : this",
      clean: true,
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                [
                  "@babel/preset-env",
                  {
                    targets: {
                      browsers: [
                        "> 1%",
                        "last 2 versions",
                        "not dead",
                        "not ie 11",
                      ],
                    },
                    useBuiltIns: "usage",
                    corejs: 3,
                  },
                ],
              ],
              plugins: ["@babel/plugin-transform-runtime"],
            },
          },
        },
      ],
    },

    resolve: {
      extensions: [".js"],
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@core": path.resolve(__dirname, "src/core"),
        "@detectors": path.resolve(__dirname, "src/detectors"),
      },
    },

    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
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
          },
          extractComments: false,
        }),
      ],
    },

    devServer: {
      static: {
        directory: path.join(__dirname, "dist"),
      },
      port: 3001,
      hot: true,
      open: true,
      compress: true,
      historyApiFallback: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers":
          "X-Requested-With, content-type, Authorization",
      },
    },

    plugins: [
      // Generate test HTML file for development
      new HtmlWebpackPlugin({
        template: "./tests/test.html",
        filename: "test.html",
        inject: "head",
        chunks: ["pavekit"],
      }),

      // Copy static assets
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "src/assets",
            to: "assets",
            noErrorOnMissing: true,
          },
        ],
      }),
    ],

    devtool: isProduction ? "source-map" : "eval-source-map",

    performance: {
      maxAssetSize: 20000, // 20kb
      maxEntrypointSize: 20000,
      hints: isProduction ? "warning" : false,
    },

    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false,
    },
  };
};
