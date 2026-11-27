import { Link } from 'react-router-dom';
import { cx } from '@/lib/utils';
import { BloodDrop } from './BloodDrop';

interface WordmarkProps {
  to?: string;
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

export function Wordmark({ to, compact = false, inverse = false, className }: WordmarkProps) {
  const content = (
    <>
      <BloodDrop className="wordmark__drop" size={compact ? 24 : 30} />
      <span className="wordmark__type">
        <span className="wordmark__name">LifeLink</span>
        {!compact && <span className="wordmark__descriptor">The living blood network</span>}
      </span>
    </>
  );

  const classes = cx('wordmark', inverse && 'wordmark--inverse', compact && 'wordmark--compact', className);

  if (to) {
    return (
      <Link className={classes} to={to}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
