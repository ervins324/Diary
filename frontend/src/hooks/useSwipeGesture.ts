import { useRef } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

/**
 * Hook for detecting horizontal touch swipe gestures on mobile.
 * Ensures horizontal intent dominates vertical scrolling before triggering.
 */
export function useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold = 55 }: SwipeConfig) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    // Trigger only if horizontal swipe exceeds threshold and is significantly greater than vertical scroll
    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      }
    }
  };

  return { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd };
}
