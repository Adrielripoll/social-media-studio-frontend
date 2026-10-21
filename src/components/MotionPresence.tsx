import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

const ExitingContext = createContext(false);
const EXIT_DURATION_MS = 180;

export function useMotionExiting(): boolean {
  return useContext(ExitingContext);
}

/** Retain conditional content just long enough to finish its visual exit. */
export default function MotionPresence({ children }: { children: ReactNode }) {
  const present = Boolean(children);
  const [retained, setRetained] = useState(present);
  const previous = useRef(children);

  useLayoutEffect(() => {
    if (present) {
      previous.current = children;
      if (!retained) {
        setRetained(true);
      }
      return;
    }
    if (!retained) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRetained(false);
      return;
    }
    const timeout = window.setTimeout(
      () => setRetained(false),
      EXIT_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [children, present, retained]);

  if (!present && !retained) {
    return null;
  }
  return (
    <ExitingContext.Provider value={!present}>
      {present ? children : previous.current}
    </ExitingContext.Provider>
  );
}

function ExpansionContent({
  children,
  animate,
}: {
  children: ReactNode;
  animate: boolean;
}) {
  const exiting = useMotionExiting();
  // Do not restart initial animations when the same content receives fresh data.
  const [animateEntry] = useState(animate);
  return (
    <div
      className="motion-expand"
      data-motion-state={exiting ? "exit" : "enter"}
      data-motion-entry={animateEntry ? "animated" : "static"}
      aria-hidden={exiting || undefined}
      inert={exiting}
    >
      <div className="motion-expand-inner">{children}</div>
    </div>
  );
}

export function Expandable({
  open,
  children,
  id,
  animateInitial = true,
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
  animateInitial?: boolean;
}) {
  const initialRender = useRef(true);
  useLayoutEffect(() => {
    initialRender.current = false;
  }, []);
  const content = (
    <MotionPresence>
      {open && (
        <ExpansionContent animate={animateInitial || !initialRender.current}>
          {children}
        </ExpansionContent>
      )}
    </MotionPresence>
  );
  // Disclosure controls keep a valid target even while their content is unmounted.
  return id ? (
    <div id={id} aria-hidden={!open || undefined} inert={!open}>
      {content}
    </div>
  ) : (
    content
  );
}
