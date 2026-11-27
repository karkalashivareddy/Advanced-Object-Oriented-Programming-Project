import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { cx } from '@/lib/utils';
import { FormField } from './FormField';

interface FieldProps {
  label: string;
  children: ReactElement;
  error?: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  className?: string;
}

/** Shared label/error shell. Native controls receive `.input`/`.select` via FormField. */
export function Field(props: FieldProps) {
  return <FormField {...props} className={cx('field', props.className)} />;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx('input', className)} {...props} data-form-control="input" />;
});
Input.displayName = 'Input';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <span className="select-wrap">
      <select ref={ref} className={cx('select', className)} {...props} data-form-control="select">
        {children}
      </select>
      <ChevronDown size={16} aria-hidden="true" className="select-wrap__icon" />
    </span>
  );
});
Select.displayName = 'Select';

interface PasswordFieldProps {
  label: string;
  name?: string;
  value: string;
  onChange: InputHTMLAttributes<HTMLInputElement>['onChange'];
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  disabled?: boolean;
  onBlur?: InputHTMLAttributes<HTMLInputElement>['onBlur'];
  className?: string;
}

/** Password control with a right-side, keyboard-operable visibility toggle. */
export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder,
  error,
  hint,
  required,
  full = true,
  disabled,
  onBlur,
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const id = generatedId;

  return (
    <Field label={label} error={error} hint={hint} required={required} full={full} className={className}>
      <span className="password-wrap">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </span>
    </Field>
  );
}
