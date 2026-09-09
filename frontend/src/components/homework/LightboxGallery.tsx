import { useEffect, useCallback, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface LightboxGalleryProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * Full-screen lightbox gallery with keyboard navigation, touch swipe,
 * pinch-to-zoom support, and image counter for multi-image homework.
 */
export function LightboxGallery({ images, currentIndex, onClose, onNavigate }: LightboxGalleryProps) {
  const [zoom, setZoom] = useState(1);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = images.length;
  const hasMultiple = total > 1;

  /* Reset zoom when navigating to a different image */
  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

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
          setZoom(z => Math.min(z + 0.5, 4));
          break;
        case '-':
          setZoom(z => Math.max(z - 0.5, 0.5));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goPrev, goNext]);

  /* Touch swipe handlers for mobile navigation */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setDragOffset(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart && e.touches.length === 1 && zoom === 1) {
      const dx = e.touches[0].clientX - dragStart.x;
      setDragOffset(dx);
    }
  };

  const handleTouchEnd = () => {
    if (dragStart) {
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

  /* Zoom toggle between 1x and 2x */
  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(z => z === 1 ? 2 : 1);
  };

  return (
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
        {/* Zoom and close action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleZoom}
            className="text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
            title={zoom > 1 ? 'Zoom out' : 'Zoom in'}
          >
            {zoom > 1 ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
          </button>
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

      {/* Main image with zoom and drag transform */}
      <div
        className="relative max-w-[95vw] md:max-w-4xl max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateX(${dragOffset}px) scale(${zoom})`,
          transition: dragStart ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1} of ${total}`}
          className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
          draggable={false}
          onDoubleClick={toggleZoom}
          style={{ touchAction: zoom > 1 ? 'pan-x pan-y' : 'none' }}
        />
      </div>

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
    </div>
  );
}
