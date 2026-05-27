import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chapterImageApi } from '../api';

/**
 * Full-screen chapter image viewer with upload & browse modes.
 *
 * Props:
 *   chapterId    – chapter ID
 *   chapterTitle – shown in the header
 *   onClose      – close handler
 *   onImagesChange – callback when images are added/deleted (to update badge)
 */
export default function ChapterImageViewer({ chapterId, chapterTitle, onClose, onImagesChange }) {
  const [mode, setMode] = useState('browse'); // 'browse' | 'upload'
  const [images, setImages] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chapterImageApi.getAll(chapterId);
      setImages(data);
      if (data.length > 0 && idx >= data.length) {
        setIdx(data.length - 1);
      }
    } catch (e) {
      console.error('Failed to load images', e);
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => { loadImages(); }, [loadImages]);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await chapterImageApi.upload(chapterId, files);
      await loadImages();
      onImagesChange?.();
      // Switch to browse mode after upload
      setMode('browse');
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId) => {
    await chapterImageApi.delete(chapterId, imageId);
    await loadImages();
    onImagesChange?.();
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
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (mode === 'browse') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext, mode]);

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
                accept="image/*"
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
                    <img
                      src={chapterImageApi.getUrl(chapterId, currentImage.id)}
                      alt={currentImage.originalName}
                      className="chapter-image-img"
                    />
                  </div>
                  <div className="chapter-image-info">
                    <span className="chapter-image-name">{currentImage.originalName}</span>
                    <button
                      className="btn-icon"
                      title="Delete image"
                      onClick={() => handleDelete(currentImage.id)}
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
      </div>
    </div>,
    document.body
  );
}
