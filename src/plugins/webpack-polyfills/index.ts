import type { LoadContext, Plugin } from "@docusaurus/types";

export default function webpackPolyfillsPlugin(
  _context: LoadContext
): Plugin {
  return {
    name: "stellar-docs-webpack-polyfills",
    configureWebpack(_config, isServer) {
      if (isServer) {
        return {};
      }

      return {
        resolve: {
          fallback: {
            path: require.resolve("path-browserify"),
          },
        },
      };
    },
  };
}
