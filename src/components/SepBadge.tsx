import React from "react";

type ProductProps = {
  tags: string;
};

export const SepBadge: React.FC<ProductProps> = (props) => {
  const tags = props.tags.split(",").map((tag) => tag.trim());
  const seps = tags.filter((w) => w.toLowerCase().includes("sep")).sort();

  if (seps.length === 0) {
    return <></>;
  }

  return (
    <div style={{ marginBottom: "var(--ifm-spacing-vertical)" }}>
      {seps.map((sep) => {
        const number = Number.parseInt(sep.split("-")[1], 10);
        const href = `https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-${number.toString().padStart(4, "0")}.md`;

        return (
          <a
            key={sep}
            href={href}
            style={{
              borderRadius: "var(--ifm-global-radius)",
              marginRight: "var(--ifm-global-spacing)",
            }}
            className="badge badge--primary"
          >
            {sep}
          </a>
        );
      })}
    </div>
  );
};
