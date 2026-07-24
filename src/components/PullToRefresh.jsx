import { useState, useRef, useEffect } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 110;

// Gesto de "deslizar para recargar" — necesario porque una PWA instalada
// (sobre todo en iOS) no tiene barra del navegador con botón de recargar.
export default function PullToRefresh({ children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef({ startY: null, dragging: false, pull: 0 });

  useEffect(() => {
    const getScrollTop = () => window.scrollY || document.documentElement.scrollTop || 0;

    function onTouchStart(e) {
      if (getScrollTop() > 0 || refreshing) return;
      if (document.querySelector('.modal-overlay')) return;
      gesture.current.startY = e.touches[0].clientY;
      gesture.current.dragging = true;
    }

    function onTouchMove(e) {
      const g = gesture.current;
      if (!g.dragging || g.startY === null) return;
      const delta = e.touches[0].clientY - g.startY;
      if (delta <= 0) {
        if (g.pull !== 0) { g.pull = 0; setPull(0); }
        return;
      }
      const resisted = Math.min(delta * 0.5, MAX_PULL);
      g.pull = resisted;
      setPull(resisted);
    }

    function onTouchEnd() {
      const g = gesture.current;
      if (!g.dragging) return;
      g.dragging = false;
      g.startY = null;
      if (g.pull >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        window.location.reload();
      } else {
        g.pull = 0;
        setPull(0);
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [refreshing]);

  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <>
      <div className="ptr-indicator" style={{ height: `${pull}px`, opacity: progress }}>
        <div className={`ptr-spinner ${refreshing ? 'ptr-spinning' : ''}`} style={!refreshing ? { transform: `rotate(${progress * 360}deg)` } : undefined}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </div>
      </div>
      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: pull === 0 ? 'transform 0.2s ease' : 'none' }}>
        {children}
      </div>
    </>
  );
}
