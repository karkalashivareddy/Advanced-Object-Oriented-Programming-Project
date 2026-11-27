import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/utils';

export type SurfaceVariant = 'flat' | 'raised' | 'glass' | 'tint';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

type SurfaceTag = 'div' | 'section' | 'article' | 'aside';

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  tone?: 'default' | 'danger';
  as?: SurfaceTag;
  children?: ReactNode;
}

/** One card vocabulary for every app surface. Padding is part of the contract. */
export function Surface({
  variant = 'flat',
  padding = 'md',
  tone = 'default',
  as = 'div',
  className,
  children,
  ...rest
}: SurfaceProps) {
  return createElement(
    as,
    {
      ...rest,
      className: cx(
        'surface',
        `surface--${variant}`,
        `surface--pad-${padding}`,
        tone === 'danger' && 'surface--danger',
        className,
      ),
    },
    children,
  );
}
