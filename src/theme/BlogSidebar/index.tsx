import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import OriginalBlogSidebar from "@theme-original/BlogSidebar";
import type { Props } from "@theme/BlogSidebar";

const MEETING_ROUTE = "/meetings";

export default function BlogSidebarWrapper(props: Props): ReactNode {
  const sidebar = props.sidebar
    ? {
        ...props.sidebar,
        title: <Link to={MEETING_ROUTE}>{props.sidebar.title}</Link>,
      }
    : undefined;

  return (
    <OriginalBlogSidebar
      {...props}
      sidebar={sidebar as unknown as Props["sidebar"]}
    />
  );
}
