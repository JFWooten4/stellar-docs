import type { Plugin } from '@docusaurus/types';

/**
 * On Windows, Watchpack can error when it accidentally tries to lstat protected
 * system folders on the root of a drive (e.g. "System Volume Information").
 * We explicitly ignore those paths for the dev server watch mode.
 */
export default function webpackWatchIgnorePlugin(): Plugin {
  return {
    name: 'stellar-docs-webpack-watch-ignore',
    configureWebpack() {
      return {
        watchOptions: {
          // Webpack only accepts either a single RegExp OR an array of strings (glob patterns).
          ignored: /[\\/]((System Volume Information)|(\\$RECYCLE\\.BIN))[\\/]/,
        },
      };
    },
  };
}
