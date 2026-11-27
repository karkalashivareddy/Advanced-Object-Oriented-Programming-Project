import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
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

const FORM_CONTROL_TAGS = new Set(['input', 'select', 'textarea']);
const CONTROL_COMPONENT_NAMES = new Set(['Input', 'Select', 'Textarea']);
const CONTROL_MARKER = 'data-form-control';

type MarkedControl = ReactElement<Record<string, unknown>>;

function asElement(node: ReactNode): MarkedControl | undefined {
  return isValidElement(node) ? (node as MarkedControl) : undefined;
}

function componentName(type: unknown): string | undefined {
  if (typeof type === 'string') return type;
  if (!type || typeof type !== 'object') return undefined;
  const candidate = type as {
    displayName?: unknown;
    name?: unknown;
    render?: { name?: unknown };
  };
  if (typeof candidate.displayName === 'string') return candidate.displayName;
  if (candidate.render && typeof candidate.render.name === 'string') return candidate.render.name;
  return typeof candidate.name === 'string' ? candidate.name : undefined;
}

/** Native controls and shared wrappers both identify the control they render. */
function isFormControl(node: MarkedControl): boolean {
  const name = componentName(node.type);
  if (name && (FORM_CONTROL_TAGS.has(name) || CONTROL_COMPONENT_NAMES.has(name))) return true;
  const marker = node.props[CONTROL_MARKER];
  return marker === 'input' || marker === 'select' || marker === 'textarea';
}

function findControl(node: ReactNode): MarkedControl | undefined {
  const element = asElement(node);
  if (!element) return undefined;
  if (isFormControl(element)) return element;

  let found: MarkedControl | undefined;
  Children.forEach((element.props as { children?: ReactNode }).children, (child) => {
    found ??= findControl(child);
  });
  return found;
}

const CONTROL_CLASSES: Record<string, string> = {
  input: 'input',
  select: 'select',
  textarea: 'textarea',
};

function withControlClass(tag: string, existing: unknown): string {
  const current = typeof existing === 'string' ? existing : '';
  const expected = CONTROL_CLASSES[tag];
  if (!expected || current.split(/\s+/).includes(expected)) return current;
  return [expected, current].filter(Boolean).join(' ');
}

function controlTag(node: MarkedControl): string {
  const name = componentName(node.type);
  if (name && FORM_CONTROL_TAGS.has(name)) return name;
  if (name && CONTROL_COMPONENT_NAMES.has(name)) return name.toLowerCase();
  const marker = node.props[CONTROL_MARKER];
  return typeof marker === 'string' ? marker : '';
}

function wireControl(node: ReactNode, props: Record<string, unknown>): [ReactNode, boolean] {
  const element = asElement(node);
  if (!element) return [node, false];
  if (isFormControl(element)) {
    const control = element;
    const previousDescribedBy = typeof control.props['aria-describedby'] === 'string'
      ? control.props['aria-describedby'].split(/\s+/)
      : [];
    const nextDescribedBy = [...new Set([
      ...previousDescribedBy,
      ...String(props['aria-describedby'] ?? '').split(/\s+/).filter(Boolean),
    ])].join(' ');
    return [cloneElement(control, {
      ...props,
      id: control.props.id ?? props.id,
      className: withControlClass(controlTag(control), control.props.className),
      'aria-describedby': nextDescribedBy || undefined,
      'aria-invalid': props['aria-invalid'] ?? control.props['aria-invalid'],
      'aria-required': props['aria-required'] ?? control.props['aria-required'],
    }), true];
  }

  let found = false;
  const nextChildren = Children.map((element.props as { children?: ReactNode }).children, (child) => {
    if (found) return child;
    const [next, wired] = wireControl(child, props);
    found = wired;
    return next;
  });
  return found ? [cloneElement(element, undefined, nextChildren), true] : [node, false];
}

/** Wires a label and accessible state to the first form control, including shared wrappers. */
export function FormField({ label, children, error, hint, required, full, className }: FormFieldProps) {
  const generatedId = useId();
  const controlId = (findControl(children)?.props.id as string | undefined) ?? generatedId;
  const describedBy = [hint ? `${controlId}-hint` : null, error ? `${controlId}-error` : null]
    .filter(Boolean)
    .join(' ');

  const [control] = wireControl(children, {
    id: controlId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    'aria-required': required ? true : undefined,
  });

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
