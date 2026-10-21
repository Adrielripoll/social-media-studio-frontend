import { useLayoutEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useMotionExiting } from "./MotionPresence";

export default function Dialog({
  title,
  onClose,
  children,
  className = "",
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const exiting = useMotionExiting();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    const trigger = document.activeElement;
    dialog.showModal();
    const candidates = dialog.querySelectorAll<HTMLElement>(
      '[autofocus], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])',
    );
    const initialFocus = [...candidates].find(
      (element) =>
        element.getClientRects().length > 0 && !element.closest("[inert]"),
    );
    initialFocus?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) {
        dialog.close();
      }
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        !document.querySelector("dialog[open]")
      ) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <dialog
      ref={ref}
      data-motion-state={exiting ? "exit" : "enter"}
      aria-hidden={exiting || undefined}
      inert={exiting}
      aria-labelledby={titleId}
      className={"dialog " + className}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
