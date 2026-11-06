import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clampOffset, clampScale, fitScale, zoomAt } from '../../utils/zoomMath';

const MAX_SCALE = 8;
const MIN_SCALE = 0.1;
const STEP = 1.2;
const CLICK_SLOP = 4;

// `view.fit` means "follow the fit scale"; the real numbers are derived against the
// current image and container size, so resizing needs no state update.
function resolveView(view, natural, box) {
  if (!natural || !box) return null;
  const fit = fitScale(natural, box);
  const base = view.fit ? { scale: fit, x: 0, y: 0 } : view;
  return { scale: base.scale, ...clampOffset(base, natural, box), fitScale: fit };
}

const centerOf = (box) => ({ x: box.width / 2, y: box.height / 2 });

/**
 * An image that can be zoomed and panned inside its container.
 *
 * Props:
 *   src, alt          – the image
 *   onExpand          – when set, shows a button that opens the image full screen
 *   onBackgroundClick – a click (not a drag) on the empty area around the image
 *   ref               – { zoomIn, zoomOut, fit, actualSize } for callers that own the keyboard
 */
export default function ZoomableImage({ src, alt, onExpand, onBackgroundClick, ref }) {
  const viewportRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const press = useRef(null);
  const [natural, setNatural] = useState(null);
  const [box, setBox] = useState(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0, fit: true });
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !el.clientWidth || !el.clientHeight) return;
    setBox(prev => (prev && prev.width === el.clientWidth && prev.height === el.clientHeight
      ? prev
      : { width: el.clientWidth, height: el.clientHeight }));
  }, []);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [measure]);

  const current = resolveView(view, natural, box);

  // Applies change(resolvedView) -> { scale, x, y } to the latest state.
  const update = useCallback((change) => {
    setView(v => {
      const cur = resolveView(v, natural, box);
      if (!cur) return v;
      const next = change(cur);
      return { scale: next.scale, ...clampOffset(next, natural, box), fit: false };
    });
  }, [natural, box]);

  const zoomBy = useCallback((factor, point) => {
    update(cur => {
      const scale = clampScale(cur.scale * factor, Math.min(cur.fitScale, MIN_SCALE), MAX_SCALE);
      return zoomAt(cur, scale, point ?? centerOf(box));
    });
  }, [update, box]);

  const fit = useCallback(() => setView({ scale: 1, x: 0, y: 0, fit: true }), []);
  const actualSize = useCallback((point) => {
    update(cur => zoomAt(cur, 1, point ?? centerOf(box)));
  }, [update, box]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomBy(STEP),
    zoomOut: () => zoomBy(1 / STEP),
    fit,
    actualSize: () => actualSize(),
  }), [zoomBy, fit, actualSize]);

  // React registers wheel listeners as passive, so preventDefault only works on a native one.
  useEffect(() => {
    const el = viewportRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      if (!box) return;
      const rect = el.getBoundingClientRect();
      const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
      const factor = STEP ** (-Math.max(-100, Math.min(100, delta)) / 100);
      zoomBy(factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy, box]);

  const local = (e) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
    };
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = pointers.current.size === 1
      ? { x: e.clientX, y: e.clientY, moved: false, background: e.target === e.currentTarget }
      : null;
    if (pointers.current.size === 2) pinch.current = pinchState();
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > CLICK_SLOP) {
        press.current.moved = true;
      }
      if (dx || dy) update(cur => ({ scale: cur.scale, x: cur.x + dx, y: cur.y + dy }));
    } else if (pointers.current.size === 2 && pinch.current) {
      const prev = pinch.current;
      const next = pinchState();
      pinch.current = next;
      update(cur => {
        const scale = clampScale(
          cur.scale * (next.dist / prev.dist), Math.min(cur.fitScale, MIN_SCALE), MAX_SCALE);
        const z = zoomAt(cur, scale, prev.mid);
        return { scale, x: z.x + next.mid.x - prev.mid.x, y: z.y + next.mid.y - prev.mid.y };
      });
    }
  };

  const endPointer = (e) => {
    if (!pointers.current.delete(e.pointerId)) return;
    pinch.current = null;
    if (pointers.current.size > 0) return;
    setDragging(false);
    const wasClick = press.current && !press.current.moved && press.current.background;
    press.current = null;
    if (wasClick && e.type === 'pointerup') onBackgroundClick?.();
  };

  const onDoubleClick = (e) => {
    if (!current) return;
    if (Math.abs(current.scale - current.fitScale) < 0.001) actualSize(local(e));
    else fit();
  };

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') zoomBy(STEP);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / STEP);
    else if (e.key === '0') fit();
    else if (e.key === '1') actualSize();
    else return;
    e.preventDefault();
  };

  const scale = current?.scale ?? 1;
  const minScale = Math.min(current?.fitScale ?? 1, MIN_SCALE);

  return (
    <div className="zoomable-image">
      <div
        ref={viewportRef}
        className={`zoomable-image-viewport${dragging ? ' is-dragging' : ''}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="zoomable-image-img"
          style={current
            ? { transform: `translate(${current.x}px, ${current.y}px) scale(${current.scale})` }
            : { visibility: 'hidden' }}
          onLoad={(e) => {
            setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
            measure();
          }}
        />
      </div>
      <div className="zoomable-image-toolbar" role="toolbar" aria-label="Zoom">
        <button
          type="button"
          className="btn-icon"
          onClick={() => zoomBy(1 / STEP)}
          disabled={!current || scale <= minScale + 1e-6}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >−</button>
        <span className="zoomable-image-percent" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          className="btn-icon"
          onClick={() => zoomBy(STEP)}
          disabled={!current || scale >= MAX_SCALE - 1e-6}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >+</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fit} title="Fit to window (0)">Fit</button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => actualSize()}
          disabled={!current}
          title="Actual size (1)"
        >1:1</button>
        {onExpand && (
          <button
            type="button"
            className="btn-icon"
            onClick={onExpand}
            aria-label="Open full screen"
            title="Open full screen"
          >⛶</button>
        )}
      </div>
    </div>
  );
}
