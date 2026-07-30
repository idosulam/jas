import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const toast_context = createContext(null);
const TICK_MS = 40;
const DEFAULT_DURATION = 4800;
const MAX_VISIBLE = 3;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function GlassToastCard({ toast, onPause, onResume, onDismiss }) {
  const Drag_state = useRef({ active: false, start_x: 0, Offset_x: 0 });
  const [Offset_x, Set_offset_x] = useState(0);
  const [dragging, Set_dragging] = useState(false);

  const reset = useCallback(() => {
    Set_dragging(false);
    Set_offset_x(0);
    Drag_state.current = { active: false, start_x: 0, Offset_x: 0 };
  }, []);

  const Handle_pointer_down = useCallback((event) => {
    Drag_state.current.active = true;
    Drag_state.current.start_x = event.clientX;
    Drag_state.current.Offset_x = 0;
    Set_dragging(true);
  }, []);

  const Handle_pointer_move = useCallback((event) => {
    if (!Drag_state.current.active) return;
    const delta_x = event.clientX - Drag_state.current.start_x;
    Drag_state.current.Offset_x = delta_x;
    Set_offset_x(delta_x);
  }, []);

  const Handle_pointer_up = useCallback(() => {
    if (!Drag_state.current.active) return;
    const should_dismiss = Math.abs(Drag_state.current.Offset_x) > 110;
    if (should_dismiss) {
      onDismiss(toast.id);
      reset();
      return;
    }
    reset();
  }, [onDismiss, reset, toast.id]);

  const progress = clamp((toast.remaining / toast.duration) * 100, 0, 100);
  const opacity = dragging ? clamp(1 - Math.abs(Offset_x) / 180, 0.35, 1) : 1;
  const Bar_label = toast.type === "success" ? "Success timer" : "Error timer";

  return (
    <div
      className={`glass-toast glass-toast--${toast.type}${dragging ? " glass-toast--dragging" : ""}`}
      style={{ transform: `translate3d(${Offset_x}px, 0, 0)`, opacity }}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      onPointerDown={Handle_pointer_down}
      onPointerMove={Handle_pointer_move}
      onPointerUp={Handle_pointer_up}
      onPointerCancel={Handle_pointer_up}
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
        <div className="glass-toast__timer" aria-label={Bar_label}>
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
  const [toasts, Set_toasts] = useState([]);
  const Last_tick_ref = useRef(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - Last_tick_ref.current;
      Last_tick_ref.current = now;
      Set_toasts((current) =>
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
    Set_toasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pause = useCallback((id) => {
    Set_toasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, paused: true } : toast,
      ),
    );
  }, []);

  const resume = useCallback((id) => {
    Set_toasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, paused: false } : toast,
      ),
    );
  }, []);

  const push = useCallback(
    ({ type = "success", title, message, duration = DEFAULT_DURATION }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      Set_toasts((current) => {
        const next = [
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
        ];
        // Keep only the newest MAX_VISIBLE toasts
        return next.length > MAX_VISIBLE
          ? next.slice(next.length - MAX_VISIBLE)
          : next;
      });
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
    <toast_context.Provider value={api}>
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
    </toast_context.Provider>
  );
}

export function Use_glass_toast() {
  const value = useContext(toast_context);
  if (!value) {
    throw new Error("Use_glass_toast must be used inside ToastProvider.");
  }
  return value;
}
