import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Minus, Plus, Move } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { cn } from '../../lib/utils';

interface LightboxGalleryProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * Full-screen lightbox gallery with keyboard navigation, touch swipe,
 * pinch-to-zoom support, 2D drag-to-pan when zoomed in, and image counter.
 */
export function LightboxGallery({ images, currentIndex, onClose, onNavigate }: LightboxGalleryProps) {
  const { t } = useLanguage();
  const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
  const [zoomIndex, setZoomIndex] = useState(1); // default 100%
  const zoom = ZOOM_LEVELS[zoomIndex];

  /* Swipe navigation offset when zoom <= 1 */
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  /* 2D pan offset when zoom > 1 */
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: 0,
    panY: 0,
  });
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const total = images.length;
  const hasMultiple = total > 1;

  /* Reset zoom and pan when navigating to a different image */
  useEffect(() => {
    setZoomIndex(1); // reset to 100%
    setPanOffset({ x: 0, y: 0 });
  }, [currentIndex]);

  /* Reset pan when zooming back to 100% or below */
  useEffect(() => {
    if (zoomIndex <= 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoomIndex]);

  /* Mouse dragging for desktop panning when zoomed in */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomIndex > 1 && e.button === 0) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };
    }
  };

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setPanOffset({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

  /* Zoom in to next level */
  const zoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomIndex(i => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  };

  /* Zoom out to previous level */
  const zoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomIndex(i => Math.max(i - 1, 0));
  };

  /* Navigate to previous image */
  const goPrev = useCallback(() => {
    if (hasMultiple) {
      onNavigate(currentIndex === 0 ? total - 1 : currentIndex - 1);
    }
  }, [currentIndex, total, hasMultiple, onNavigate]);

  /* Navigate to next image */
  const goNext = useCallback(() => {
    if (hasMultiple) {
      onNavigate(currentIndex === total - 1 ? 0 : currentIndex + 1);
    }
  }, [currentIndex, total, hasMultiple, onNavigate]);

  /* Keyboard event handler: Escape to close, Arrow keys to navigate, +/- to zoom */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case '+':
        case '=':
          setZoomIndex(i => Math.min(i + 1, ZOOM_LEVELS.length - 1));
          break;
        case '-':
          setZoomIndex(i => Math.max(i - 1, 0));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goPrev, goNext]);

  /* Touch handlers: swipe navigation when zoom <= 1, 2D pan when zoom > 1 */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (zoomIndex > 1) {
        setIsPanning(true);
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        touchStartPanRef.current = { ...panOffset };
      } else {
        setDragStart({ x: touch.clientX, y: touch.clientY });
        setDragOffset(0);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (zoomIndex > 1 && isPanning) {
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;
        setPanOffset({
          x: touchStartPanRef.current.x + dx,
          y: touchStartPanRef.current.y + dy,
        });
      } else if (dragStart && zoomIndex <= 1) {
        const dx = touch.clientX - dragStart.x;
        setDragOffset(dx);
      }
    }
  };

  const handleTouchEnd = () => {
    if (zoomIndex > 1) {
      setIsPanning(false);
    } else if (dragStart) {
      const threshold = 60;
      if (dragOffset > threshold) {
        goPrev();
      } else if (dragOffset < -threshold) {
        goNext();
      }
      setDragStart(null);
      setDragOffset(0);
    }
  };

  /* Double-click toggles between 100% and 150% */
  const handleDoubleClickZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPanOffset({ x: 0, y: 0 });
    setZoomIndex(i => (i === 1 ? 3 : 1)); // toggle between 100% (index 1) and 150% (index 3)
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top toolbar with counter and action buttons */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 z-10" onClick={e => e.stopPropagation()}>
        {/* Image counter badge */}
        {hasMultiple ? (
          <span className="text-white/80 text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
            {currentIndex + 1} / {total}
          </span>
        ) : <span />}
        {/* Zoom controls and close button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/40 rounded-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              onClick={zoomOut}
              disabled={zoomIndex === 0}
              className="text-white/80 hover:text-white p-2 hover:bg-black/30 transition-colors disabled:opacity-40"
              title="Zoom out"
            >
              <Minus size={16} />
            </button>
            <span
              onClick={() => {
                setZoomIndex(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="text-white/90 text-xs font-medium px-2 min-w-[48px] text-center select-none cursor-pointer hover:text-white hover:underline transition-colors"
              title={t('zoom_reset')}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
              className="text-white/80 hover:text-white p-2 hover:bg-black/30 transition-colors disabled:opacity-40"
              title="Zoom in"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Previous arrow navigation */}
      {hasMultiple && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Main image with zoom and drag/pan transform */}
      <div
        className={cn(
          "relative max-w-[95vw] md:max-w-4xl max-h-[85vh] flex items-center justify-center select-none",
          zoomIndex > 1
            ? (isPanning ? "cursor-grabbing" : "cursor-grab")
            : "cursor-default"
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClickZoom}
        style={{
          transform: zoomIndex > 1
            ? `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`
            : `translate3d(${dragOffset}px, 0, 0) scale(${zoom})`,
          transition: isPanning || dragStart ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1} of ${total}`}
          className="max-w-full max-h-[85vh] object-contain rounded-lg select-none pointer-events-none"
          draggable={false}
        />
      </div>

      {/* Floating hint when zoomed in */}
      {zoomIndex > 1 && (
        <div className="absolute bottom-12 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white/80 text-xs select-none backdrop-blur-xs flex items-center gap-1.5 z-10 animate-in fade-in duration-200">
          <Move size={12} className="text-accent" />
          <span>{t('drag_to_pan')}</span>
        </div>
      )}

      {/* Next arrow navigation */}
      {hasMultiple && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Dot indicators for multi-image gallery (up to 10 images) */}
      {hasMultiple && total <= 10 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10" onClick={e => e.stopPropagation()}>
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
