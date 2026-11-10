import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chapterImageApi } from '../api';
import { useChapterImages, useRefresh } from '../queries';
import ConfirmDialog from './ConfirmDialog';
import LoadError from './feedback/LoadError';
import ZoomableImage from './images/ZoomableImage';
import ImageLightbox from './images/ImageLightbox';
import { attempt, reportError, showToast } from './feedback/toast';

const NO_IMAGES = [];

/** BUG-10: the upload report names every file the server did not save, with the reason. */
function skippedMessage(saved, skipped) {
  const files = skipped.map(f => `${f.name} (${f.reason})`).join('; ');
  if (saved.length === 0) return `No image was uploaded — ${files}`;
  return `Skipped ${skipped.length} ${skipped.length === 1 ? 'file' : 'files'} — ${files}`;
}

/**
 * Full-screen chapter image viewer with upload & browse modes.
 *
 * Props:
 *   chapterId    – chapter ID
 *   chapterTitle – shown in the header
 *   onClose      – close handler
 * Uploads and deletes refresh every cached read, so the page's image badge updates too.
 */
export default function ChapterImageViewer({ chapterId, chapterTitle, onClose }) {
  const [mode, setMode] = useState('browse'); // 'browse' | 'upload'
  const imagesQuery = useChapterImages(chapterId);
  const images = imagesQuery.data ?? NO_IMAGES;
  const loading = imagesQuery.isPending;
  const refresh = useRefresh();
  const [storedIdx, setIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // the image to delete
  const [lightbox, setLightbox] = useState(false);
  const fileInputRef = useRef(null);

  // Clamp against the current list (e.g. after deleting the last image).
  const lastIdx = Math.max(images.length - 1, 0);
  if (storedIdx > lastIdx) setIdx(lastIdx);
  const idx = Math.min(storedIdx, lastIdx);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { images: saved, skipped } = await chapterImageApi.upload(chapterId, files);
      await refresh();
      if (skipped.length > 0) showToast(skippedMessage(saved, skipped), 'error');
      if (saved.length > 0) setMode('browse');
    } catch (err) {
      reportError('Could not upload the images', err);
      await refresh().catch(() => {}); // earlier batches may already be saved
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    const imageId = confirmDelete.id;
    if (!await attempt('Could not delete the image', () => chapterImageApi.delete(chapterId, imageId))) return;
    setConfirmDelete(null);
    await refresh();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleUpload(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const hasPrev = idx > 0;
  const hasNext = idx < images.length - 1;
  const goPrev = useCallback(() => { if (idx > 0) setIdx(i => i - 1); }, [idx]);
  const goNext = useCallback(() => { if (idx < images.length - 1) setIdx(i => i + 1); }, [idx, images.length]);

  useEffect(() => {
    if (confirmDelete || lightbox) return undefined; // keys belong to the confirmation / lightbox
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (mode === 'browse') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext, mode, confirmDelete, lightbox]);

  const currentImage = images[idx];

  return createPortal(
    <div className="chapter-image-overlay" onClick={onClose}>
      <div className="chapter-image-viewer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="chapter-image-header">
          <div className="chapter-image-title">{chapterTitle} — Images</div>
          <div className="chapter-image-controls">
            <div className="chapter-image-tabs">
              <button
                className={`chapter-image-tab${mode === 'browse' ? ' active' : ''}`}
                onClick={() => setMode('browse')}
              >Browse</button>
              <button
                className={`chapter-image-tab${mode === 'upload' ? ' active' : ''}`}
                onClick={() => setMode('upload')}
              >Upload</button>
            </div>
            <button className="btn-icon chapter-image-close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="chapter-image-body">
          {mode === 'upload' && (
            <div
              className={`chapter-image-dropzone${dragOver ? ' drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleUpload(e.target.files)}
              />
              {uploading ? (
                <div className="chapter-image-upload-status">Uploading...</div>
              ) : (
                <>
                  <div className="chapter-image-upload-icon">📷</div>
                  <div className="chapter-image-upload-text">
                    Drag &amp; drop images here, or click to select files
                  </div>
                  <div className="chapter-image-upload-hint">
                    Supports JPG, PNG, GIF, WebP
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'browse' && (
            <>
              {loading ? (
                <div className="chapter-image-empty">Loading...</div>
              ) : imagesQuery.error && !imagesQuery.data ? (
                <LoadError what="the images" error={imagesQuery.error} onRetry={imagesQuery.refetch} />
              ) : images.length === 0 ? (
                <div className="chapter-image-empty">
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖼️</div>
                  <p>No images yet</p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setMode('upload')}
                    style={{ marginTop: '0.75rem' }}
                  >Upload Images</button>
                </div>
              ) : (
                <div className="chapter-image-display">
                  <div className="chapter-image-main">
                    <ZoomableImage
                      key={currentImage.id}
                      src={chapterImageApi.getUrl(chapterId, currentImage.id)}
                      alt={currentImage.originalName}
                      onExpand={() => setLightbox(true)}
                    />
                  </div>
                  <div className="chapter-image-info">
                    <span className="chapter-image-name">{currentImage.originalName}</span>
                    <button
                      className="btn-icon"
                      title="Delete image"
                      onClick={() => setConfirmDelete(currentImage)}
                      style={{ color: 'var(--danger)', fontSize: '0.9rem' }}
                    >🗑️</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer nav (browse mode only) */}
        {mode === 'browse' && images.length > 1 && (
          <div className="chapter-image-nav">
            <button
              className="chapter-image-nav-btn"
              onClick={goPrev}
              disabled={!hasPrev}
            >← Prev</button>
            <span className="chapter-image-pos">{idx + 1} / {images.length}</span>
            <button
              className="chapter-image-nav-btn"
              onClick={goNext}
              disabled={!hasNext}
            >Next →</button>
          </div>
        )}

        {lightbox && (
          <ImageLightbox
            images={images}
            index={idx}
            getUrl={(image) => chapterImageApi.getUrl(chapterId, image.id)}
            onIndexChange={setIdx}
            onClose={() => setLightbox(false)}
          />
        )}

        {confirmDelete && (
          <ConfirmDialog
            message={`Delete the image "${confirmDelete.originalName}"? This cannot be undone.`}
            onConfirm={handleDelete}
            onClose={() => setConfirmDelete(null)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
