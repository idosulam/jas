import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);
const TICK_MS = 40;
const DEFAULT_DURATION = 4800;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function GlassToastCard({ toast, onPause, onResume, onDismiss }) {
  const dragState = useRef({ active: false, startX: 0, offsetX: 0 });
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    setDragging(false);
    setOffsetX(0);
    dragState.current = { active: false, startX: 0, offsetX: 0 };
  }, []);

  const handlePointerDown = useCallback((event) => {
    dragState.current.active = true;
    dragState.current.startX = event.clientX;
    dragState.current.offsetX = 0;
    setDragging(true);
  }, []);

  const handlePointerMove = useCallback((event) => {
    if (!dragState.current.active) return;
    const deltaX = event.clientX - dragState.current.startX;
    dragState.current.offsetX = deltaX;
    setOffsetX(deltaX);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragState.current.active) return;
    const shouldDismiss = Math.abs(dragState.current.offsetX) > 110;
    if (shouldDismiss) {
      onDismiss(toast.id);
      reset();
      return;
    }
    reset();
  }, [onDismiss, reset, toast.id]);

  const progress = clamp((toast.remaining / toast.duration) * 100, 0, 100);
  const opacity = dragging ? clamp(1 - Math.abs(offsetX) / 180, 0.35, 1) : 1;
  const barLabel = toast.type === "success" ? "Success timer" : "Error timer";

  return (
    <div
      className={`glass-toast glass-toast--${toast.type}${dragging ? " glass-toast--dragging" : ""}`}
      style={{ transform: `translate3d(${offsetX}px, 0, 0)`, opacity }}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="status"
      aria-live="polite"
    >
      <div className="glass-toast__halo" />
      <div className="glass-toast__content">
        <div className="glass-toast__top">
          <div
            className="glass-toast__icon"
            aria-hidden="true"
            onMouseEnter={() => onPause(toast.id)}
            onMouseLeave={() => onResume(toast.id)}
          >
            {toast.type === "success" ? "✓" : "!"}
          </div>
          <div className="glass-toast__copy">
            <strong className="glass-toast__title">{toast.title}</strong>
            <p className="glass-toast__message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="glass-toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
        <div className="glass-toast__timer" aria-label={barLabel}>
          <div
            className="glass-toast__timer-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setToasts((current) =>
        current
          .map((toast) => {
            if (toast.paused) return toast;
            const remaining = toast.remaining - delta;
            return { ...toast, remaining };
          })
          .filter((toast) => toast.remaining > 0),
      );
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pause = useCallback((id) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, paused: true } : toast,
      ),
    );
  }, []);

  const resume = useCallback((id) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, paused: false } : toast,
      ),
    );
  }, []);

  const push = useCallback(
    ({ type = "success", title, message, duration = DEFAULT_DURATION }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [
        ...current,
        {
          id,
          type,
          title:
            title ?? (type === "success" ? "Done" : "Something went wrong"),
          message,
          duration,
          remaining: duration,
          paused: false,
        },
      ]);
      return id;
    },
    [],
  );

  const api = useMemo(
    () => ({
      show: push,
      success: (message, options = {}) =>
        push({
          type: "success",
          title: options.title ?? "Success",
          message,
          duration: options.duration,
        }),
      error: (message, options = {}) =>
        push({
          type: "error",
          title: options.title ?? "Error",
          message,
          duration: options.duration ?? 5600,
        }),
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="glass-toast-viewport"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <GlassToastCard
            key={toast.id}
            toast={toast}
            onPause={pause}
            onResume={resume}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useGlassToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useGlassToast must be used inside ToastProvider.");
  }
  return value;
}
