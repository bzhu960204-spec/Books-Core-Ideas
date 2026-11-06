import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ZoomableImage from './ZoomableImage';

/**
 * Full-screen image viewer with zoom, opened over the chapter image viewer or the reader.
 *
 * Esc must close only this layer, so the keys are taken on `window` in the capture phase:
 * that runs before the reader's and the modal's `document` listeners, and stopping the event
 * there keeps them from seeing it. The zoom keys go through the ZoomableImage ref for the same reason.
 */
export default function ImageLightbox({ images, index, getUrl, onIndexChange, onClose }) {
  const zoomRef = useRef(null);
  const image = images[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const zoom = zoomRef.current;
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': if (index > 0) onIndexChange(index - 1); break;
        case 'ArrowRight': if (index < images.length - 1) onIndexChange(index + 1); break;
        case '+': case '=': zoom?.zoomIn(); break;
        case '-': case '_': zoom?.zoomOut(); break;
        case '0': zoom?.fit(); break;
        case '1': zoom?.actualSize(); break;
        default: return;
      }
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, images.length, onIndexChange, onClose]);

  if (!image) return null;

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="image-lightbox-bar">
        <button
          type="button"
          className="btn-icon"
          onClick={() => onIndexChange(index - 1)}
          disabled={index <= 0}
          aria-label="Previous image"
        >‹</button>
        <span className="image-lightbox-pos">{index + 1} / {images.length}</span>
        <button
          type="button"
          className="btn-icon"
          onClick={() => onIndexChange(index + 1)}
          disabled={index >= images.length - 1}
          aria-label="Next image"
        >›</button>
        <span className="image-lightbox-name">{image.originalName}</span>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close" title="Close (Esc)">✕</button>
      </div>
      <div className="image-lightbox-stage">
        <ZoomableImage
          key={image.id}
          ref={zoomRef}
          src={getUrl(image)}
          alt={image.originalName}
          onBackgroundClick={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
