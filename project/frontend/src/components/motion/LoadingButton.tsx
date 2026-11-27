import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from '@/lib/utils';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

/** Button with an ECG-adjacent spinner and honest busy state. */
export function LoadingButton({
  loading = false,
  loadingLabel,
  children,
  className,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      className={cx('btn', 'btn-primary', 'btn-loading', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <LoaderCircle size={17} className="ll-spin" aria-hidden="true" />
          <span>{loadingLabel ?? 'Working…'}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
