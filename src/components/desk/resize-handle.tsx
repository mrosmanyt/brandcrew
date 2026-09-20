"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampPaneWidth, isStoredCollapsed, readStoredPaneWidth } from "@/lib/desk-layout";
import { cn } from "@/lib/utils";

export function usePersistedPaneWidth(
  storageKey: string,
  fallback: number,
  min: number,
  max: number,
) {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    // SSR hydration guard: window.localStorage is browser-only, so the
    // real width must be read post-mount to avoid a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidth(readStoredPaneWidth(window.localStorage.getItem(storageKey), fallback, min, max));
  }, [fallback, max, min, storageKey]);

  const update = useCallback(
    (next: number | ((value: number) => number)) => {
      setWidth((prev) => {
        const raw = typeof next === "function" ? next(prev) : next;
        const clamped = clampPaneWidth(raw, min, max);
        window.localStorage.setItem(storageKey, String(clamped));
        return clamped;
      });
    },
    [max, min, storageKey],
  );

  return [width, update] as const;
}

export function usePersistedCollapsed(storageKey: string, collapsedToken = "collapsed") {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // SSR hydration guard: window.localStorage is browser-only, so the
    // real collapsed state must be read post-mount to avoid a hydration
    // mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(isStoredCollapsed(window.localStorage.getItem(storageKey)));
  }, [storageKey]);

  const update = useCallback(
    (next: boolean | ((value: boolean) => boolean)) => {
      setCollapsed((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        window.localStorage.setItem(storageKey, value ? collapsedToken : "open");
        return value;
      });
    },
    [collapsedToken, storageKey],
  );

  return [collapsed, update] as const;
}

export function ResizeHandle({
  label,
  onDelta,
  onDoubleClick,
  className,
}: {
  label: string;
  onDelta: (dx: number) => void;
  onDoubleClick?: () => void;
  className?: string;
}) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [active]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(event) => {
        dragging.current = true;
        lastX.current = event.clientX;
        setActive(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const dx = event.clientX - lastX.current;
        lastX.current = event.clientX;
        if (dx) onDelta(dx);
      }}
      onPointerUp={() => {
        dragging.current = false;
        setActive(false);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setActive(false);
      }}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onDelta(-16);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onDelta(16);
        }
      }}
      className={cn(
        "group relative z-20 w-2.5 shrink-0 cursor-col-resize touch-none items-stretch justify-center",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:w-0.5 group-hover:bg-foreground/50",
          active && "w-0.5 bg-foreground/80",
        )}
      />
      <span
        className={cn(
          "relative z-10 my-auto h-8 w-1 rounded-full bg-muted-foreground/70 transition-colors group-hover:bg-foreground",
          active && "bg-foreground",
        )}
      />
    </div>
  );
}
