import React, {memo} from 'react';
import clsx from 'clsx';
import {translate} from '@docusaurus/Translate';
import Link from '@docusaurus/Link';
import {useVisibleBlogSidebarItems} from '@docusaurus/plugin-content-blog/client';
import BlogSidebarContent from '@theme/BlogSidebar/Content';
import type {Props as BlogSidebarContentProps} from '@theme/BlogSidebar/Content';
import type {Props} from '@theme/BlogSidebar/Desktop';

import {
  type FormattedBlogSidebarItem,
  useFormattedSidebarItems,
} from '../useFormattedSidebarItems';
import styles from './styles.module.css';

const ListComponent: BlogSidebarContentProps['ListComponent'] = ({items}) => {
  return (
    <ul className={clsx(styles.sidebarItemList, 'clean-list')}>
      {(items as FormattedBlogSidebarItem[]).map((item) => (
        <li key={item.permalink} className={styles.sidebarItem}>
          <Link
            isNavLink
            to={item.permalink}
            className={styles.sidebarItemLink}
            activeClassName={styles.sidebarItemLinkActive}>
            <span className={styles.sidebarItemPrimary}>
              {item.title}
              {item.tooltipTitle && item.tooltipTitle !== item.title ? (
                <span className={styles.sidebarItemSecondary}>
                  {item.tooltipTitle}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

function BlogSidebarDesktop({sidebar}: Props) {
  const visibleItems = useVisibleBlogSidebarItems(sidebar.items);
  const items = useFormattedSidebarItems(visibleItems);

  return (
    <aside className="col col--3">
      <nav
        className={clsx(styles.sidebar, 'thin-scrollbar')}
        aria-label={translate({
          id: 'theme.blog.sidebar.navAriaLabel',
          message: 'Blog recent posts navigation',
          description: 'The ARIA label for recent posts in the blog sidebar',
        })}>
        <div className={clsx(styles.sidebarItemTitle, 'margin-bottom--md')}>
          {sidebar.title}
        </div>
        <BlogSidebarContent
          items={items}
          ListComponent={ListComponent}
          enableHoverExpand={true}
          yearGroupHeadingClassName={styles.yearGroupHeading}
        />
      </nav>
    </aside>
  );
}

export default memo(BlogSidebarDesktop);
