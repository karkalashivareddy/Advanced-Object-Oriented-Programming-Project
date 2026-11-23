import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'normal' | 'wide';
  variant?: 'modal' | 'drawer';
  /** Point at an existing heading id when the dialog title lives outside the default header. */
  labelledBy?: string;
  describedBy?: string;
  titleId?: string;
  descriptionId?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogKind = 'modal' | 'drawer';
interface DialogEntry {
  id: symbol;
  kind: DialogKind;
  label: string;
}

/** Last opened dialog is the only one allowed to handle Escape/Tab. */
const dialogStack: DialogEntry[] = [];
let bodyLockCount = 0;
let bodyOverflowBeforeLock = '';

function lockBodyScroll(): () => void {
  if (bodyLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    bodyLockCount = Math.max(0, bodyLockCount - 1);
    if (bodyLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
  };
}

/**
 * Registers an open dialog and reports whether it is the topmost one.
 *
 * Page agents: close a drawer (`setDetailOpen(false)`) before opening a confirm
 * modal. Nested dialogs confuse focus restoration and Escape handling, so the
 * guard warns in development and only the top dialog responds to the keyboard.
 * Call this hook directly when a page owns a custom overlay:
 *
 * ```tsx
 * const isTopDialog = useNestedDialogGuard(open, 'Confirm release', 'modal');
 * ```
 */
export function useNestedDialogGuard(
  open: boolean,
  label: string,
  kind: DialogKind = 'modal',
): () => boolean {
  const idRef = useRef<symbol | null>(null);
  if (!idRef.current) idRef.current = Symbol(label);
  const id = idRef.current;

  useEffect(() => {
    if (!open) return;
    const top = dialogStack[dialogStack.length - 1];
    if (top && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[dialog] "${label}" opened while "${top.label}" is still open. Close the ${
          top.kind === 'drawer' ? 'drawer' : 'dialog'
        } first to keep focus restoration predictable.`,
      );
    }
    dialogStack.push({ id, kind, label });
    return () => {
      const index = dialogStack.findIndex((entry) => entry.id === id);
      if (index >= 0) dialogStack.splice(index, 1);
    };
  }, [open, label, kind, id]);

  return useCallback(() => dialogStack[dialogStack.length - 1]?.id === id, [id]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'normal',
  variant = 'modal',
  labelledBy,
  describedBy,
  titleId,
  descriptionId,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const resolvedDescriptionId = descriptionId ?? generatedDescriptionId;
  const isTopDialog = useNestedDialogGuard(open, title, variant);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const releaseScrollLock = lockBodyScroll();

    const focusables = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    (focusables[0] ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      releaseScrollLock();
      previouslyFocused?.focus();
    };
  }, [open, isTopDialog]);

  if (!open) return null;

  return createPortal(
    <div
      className={cx('overlay', variant === 'drawer' && 'drawer-overlay')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div
        ref={dialogRef}
        className={cx('modal', variant === 'drawer' && 'drawer', size === 'wide' && 'modal-wide')}
        data-dialog-kind={variant}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? resolvedTitleId}
        aria-describedby={describedBy ?? (description ? resolvedDescriptionId : undefined)}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h2 id={resolvedTitleId}>{title}</h2>
            {description && (
              <p id={resolvedDescriptionId} className="text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer(props: Omit<ModalProps, 'variant'>) {
  return <Modal {...props} variant="drawer" size="normal" />;
}
