import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react';
import { cx } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
  busy?: boolean;
}

interface ToastApi {
  show: (tone: ToastTone, title: string, detail?: string) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  warning: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  /** Announces an in-flight operation without implying success. */
  busy: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRefCounter();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((tone: ToastTone, title: string, detail?: string) => {
    const id = nextId();
    setToasts((current) => [...current.slice(-3), { id, tone, title, detail }]);
  }, [nextId]);

  const showBusy = useCallback((title: string, detail?: string) => {
    const id = nextId();
    setToasts((current) => [...current.slice(-3), { id, tone: 'info', title, detail, busy: true }]);
  }, [nextId]);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, detail) => show('success', title, detail),
      error: (title, detail) => show('error', title, detail),
      warning: (title, detail) => show('warning', title, detail),
      info: (title, detail) => show('info', title, detail),
      busy: showBusy,
    }),
    [show, showBusy],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useRefCounter() {
  const counter = useRef(0);
  return useCallback(() => ++counter.current, []);
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 6000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const Icon = toast.busy ? LoaderCircle : ICONS[toast.tone];
  return (
    <div
      className={cx('toast', `toast-${toast.tone}`, toast.busy && 'toast-busy')}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-busy={toast.busy || undefined}
    >
      <span className="toast-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="toast-content">
        <p className="toast-title">{toast.title}</p>
        {toast.detail && <small className="toast-detail">{toast.detail}</small>}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
