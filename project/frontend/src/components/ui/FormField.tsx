import { cloneElement, isValidElement, useId, type ReactElement } from 'react';
import { cx } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  children: ReactElement;
  error?: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  className?: string;
}

/** Wraps a single control and wires label, aria-invalid and aria-describedby for accessibility. */
export function FormField({ label, children, error, hint, required, full, className }: FormFieldProps) {
  const generatedId = useId();
  const controlId = (children.props as { id?: string })?.id ?? generatedId;
  const describedBy = [hint ? `${controlId}-hint` : null, error ? `${controlId}-error` : null]
    .filter(Boolean)
    .join(' ');

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })
    : children;

  return (
    <div className={cx('form-field', full && 'form-field-full', className)}>
      <label htmlFor={controlId}>
        {label}
        {required && (
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <span className="field-hint" id={`${controlId}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${controlId}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
