import { useRef } from "react";

type Opts = {
  onLeft?: () => void;
  onRight?: () => void;
  threshold?: number;
};

/**
 * Hook minimalista de swipe horizontal. Ignora se:
 * - movimento é vertical-dominante (deixa scroll passar)
 * - target inicial é botão/link (deixa clicar)
 */
export function useSwipe(opts: Opts) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number; ignore: boolean }>({ x: 0, y: 0, ignore: false });
  const threshold = opts.threshold ?? 50;

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = !!target.closest("button, a, input, textarea, select");
    start.current = { x: e.clientX, y: e.clientY, ignore: isInteractive };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (start.current.ignore) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) opts.onLeft?.();
    else opts.onRight?.();
  };

  return { ref, handlers: { onPointerDown, onPointerUp } };
}
