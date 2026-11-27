import type { ReactNode } from 'react';
import { cx } from '@/lib/utils';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/** A quiet opacity/translate entry; never delays access to the page content. */
export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={cx('page-transition', className)}>{children}</div>;
}
