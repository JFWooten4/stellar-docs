module.exports = {
  ...require("@stellar/prettier-config"),
  overrides: [
    {
      files: ["*.md", "*.mdx"],
      options: {
        proseWrap: "never", // Minimize Markdown and MDX diffs with simpler content lines
      },
    },
  ],
};
