import React, {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import {useThemeConfig} from '@docusaurus/theme-common';
import {isSamePath} from '@docusaurus/theme-common/internal';
import {groupBlogSidebarItemsByYear} from '@docusaurus/plugin-content-blog/client';
import {useLocation} from '@docusaurus/router';
import Heading from '@theme/Heading';
import type {Props} from '@theme/BlogSidebar/Content';

import styles from './styles.module.css';

type YearGroupProps = {
  year: string;
  isExpanded: boolean;
  onToggle: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  yearGroupHeadingClassName?: string;
  children: ReactNode;
};

type ContentProps = Props & {
  enableHoverExpand?: boolean;
};

const HOVER_EXPAND_DELAY_MS = 500;

function BlogSidebarYearGroup({
  year,
  isExpanded,
  onToggle,
  onMouseEnter,
  onMouseLeave,
  yearGroupHeadingClassName,
  children,
}: YearGroupProps) {
  const contentInnerRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    if (!contentInnerRef.current) {
      return;
    }
    setContentHeight(contentInnerRef.current.scrollHeight);
  }, [children, isExpanded]);

  return (
    <div
      role="group"
      className={styles.yearGroup}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      <Heading as="h3" className={yearGroupHeadingClassName}>
        <button
          type="button"
          className={clsx(styles.yearToggle, {'is-expanded': isExpanded})}
          aria-expanded={isExpanded}
          onClick={onToggle}>
          <span>{year}</span>
          <span className={styles.yearToggleIndicator} aria-hidden="true">
            {isExpanded ? '−' : '+'}
          </span>
        </button>
      </Heading>
      <div
        className={clsx(styles.yearGroupContent, {
          [styles.yearGroupContentHidden]: !isExpanded,
        })}
        style={{maxHeight: isExpanded ? `${contentHeight}px` : '0px'}}
        aria-hidden={!isExpanded}>
        <div ref={contentInnerRef} className={styles.yearGroupContentInner}>
          {children}
        </div>
      </div>
    </div>
  );
}

function BlogSidebarContent({
  items,
  yearGroupHeadingClassName,
  ListComponent,
  enableHoverExpand = false,
}: ContentProps): ReactNode {
  const themeConfig = useThemeConfig();
  const {pathname} = useLocation();

  const shouldGroupByYear = themeConfig.blog.sidebar.groupByYear;
  const itemsByYear = useMemo(
    () => (shouldGroupByYear ? groupBlogSidebarItemsByYear(items) : []),
    [items, shouldGroupByYear],
  );

  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>(
    {},
  );
  const [hoveredYear, setHoveredYear] = useState<string | null>(null);
  const hoverDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!itemsByYear.length) {
      return;
    }
    const activeEntry = itemsByYear.find(([, yearItems]) =>
      yearItems.some((item) => isSamePath(item.permalink, pathname)),
    );
    if (activeEntry) {
      const [activeYear] = activeEntry;
      setExpandedYears((prev) =>
        prev[activeYear] ? prev : {...prev, [activeYear]: true},
      );
    }
  }, [itemsByYear, pathname]);

  useEffect(() => {
    return () => {
      if (hoverDelayTimeoutRef.current) {
        clearTimeout(hoverDelayTimeoutRef.current);
      }
    };
  }, []);

  const toggleYear = useCallback((year: string) => {
    setExpandedYears((prev) => ({...prev, [year]: !prev[year]}));
  }, []);

  const handleMouseEnter = useCallback(
    (year: string) => {
      if (!enableHoverExpand) {
        return;
      }
      if (hoverDelayTimeoutRef.current) {
        clearTimeout(hoverDelayTimeoutRef.current);
      }
      hoverDelayTimeoutRef.current = setTimeout(() => {
        setHoveredYear(year);
        hoverDelayTimeoutRef.current = null;
      }, HOVER_EXPAND_DELAY_MS);
    },
    [enableHoverExpand],
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverDelayTimeoutRef.current) {
      clearTimeout(hoverDelayTimeoutRef.current);
      hoverDelayTimeoutRef.current = null;
    }
    setHoveredYear(null);
  }, []);

  if (!shouldGroupByYear) {
    return <ListComponent items={items} />;
  }

  return (
    <>
      {itemsByYear.map(([year, yearItems]) => (
        <BlogSidebarYearGroup
          key={year}
          year={year}
          isExpanded={!!expandedYears[year] || hoveredYear === year}
          onToggle={() => toggleYear(year)}
          onMouseEnter={
            enableHoverExpand ? () => handleMouseEnter(year) : undefined
          }
          onMouseLeave={enableHoverExpand ? handleMouseLeave : undefined}
          yearGroupHeadingClassName={yearGroupHeadingClassName}>
          <ListComponent items={yearItems} />
        </BlogSidebarYearGroup>
      ))}
    </>
  );
}

export default memo(BlogSidebarContent);
