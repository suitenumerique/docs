import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_WIDTH_PERCENTAGE = 100;
const MIN_WIDTH_PERCENTAGE = 40;

export const usePdfResizer = (
  initialWidth: number = 100,
  onResizeEnd: (width: number) => void,
) => {
  const dragOffsetRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [pdfWidth, setPdfWidth] = useState(initialWidth);
  const [dragging, setDragging] = useState(false);

  const clamp = (v: number) =>
    Math.max(MIN_WIDTH_PERCENTAGE, Math.min(MAX_WIDTH_PERCENTAGE, v));

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging || !wrapperRef.current) {
        return;
      }

      const rect = wrapperRef.current.getBoundingClientRect();

      const pct =
        ((e.clientX - rect.left - dragOffsetRef.current) / rect.width) * 100;

      setPdfWidth(clamp(pct));
    },
    [dragging],
  );

  const stopDragging = useCallback(() => {
    onResizeEnd(pdfWidth);
    setDragging(false);
  }, [onResizeEnd, pdfWidth]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [dragging, onPointerMove, stopDragging]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const currentRight = rect.left + (pdfWidth / 100) * rect.width;

        // capture grab offset
        dragOffsetRef.current = e.clientX - currentRight;
      }

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [pdfWidth],
  );

  return {
    pdfWidth,
    wrapperRef,
    dragging,
    handlePointerDown,
  } as const;
};
