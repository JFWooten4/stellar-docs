const MARKER_CLASS = "markdown-actions-hidden-marker";

module.exports = function markdownActions() {
  return (tree, file) => {
    if (file.data.frontMatter?.open_markdown !== false) {
      return;
    }

    tree.children.push({
      type: "mdxJsxFlowElement",
      name: "span",
      attributes: [
        {
          type: "mdxJsxAttribute",
          name: "className",
          value: MARKER_CLASS,
        },
      ],
      children: [],
    });
  };
};
