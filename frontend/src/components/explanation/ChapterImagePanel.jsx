import { useState } from 'react';
import { chapterImageApi } from '../../api';
import { useChapterImages } from '../../queries';
import LoadError from '../feedback/LoadError';
import ImageLightbox from '../images/ImageLightbox';
import ZoomableImage from '../images/ZoomableImage';

const NO_IMAGES = [];

// Read-only image browser beside the explanation; uploading and deleting stay in ChapterImageViewer.
// ←/→ switch images only while focus is inside the panel, so they never fight the text on the left.
export default function ChapterImagePanel({ chapterId }) {
  const query = useChapterImages(chapterId);
  const images = query.data ?? NO_IMAGES;
  const [storedIdx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const idx = Math.min(storedIdx, Math.max(images.length - 1, 0));
  const image = images[idx];
  const urlOf = (img) => chapterImageApi.getUrl(chapterId, img.id);

  const onKeyDown = (e) => {
    if (lightbox || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1);
    else if (e.key === 'ArrowRight' && idx < images.length - 1) setIdx(idx + 1);
    else return;
    e.preventDefault();
  };

  let body;
  if (query.isPending) {
    body = <div className="chapter-image-panel-empty">Loading...</div>;
  } else if (query.error && !query.data) {
    body = <LoadError what="the images" error={query.error} onRetry={query.refetch} />;
  } else if (!image) {
    body = <div className="chapter-image-panel-empty">No images</div>;
  } else {
    body = (
      <>
        <div className="chapter-image-panel-toolbar">
          <button
            type="button"
            className="btn-icon"
            onClick={() => setIdx(idx - 1)}
            disabled={idx <= 0}
            aria-label="Previous image"
          >‹</button>
          <span className="chapter-image-pos">{idx + 1} / {images.length}</span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setIdx(idx + 1)}
            disabled={idx >= images.length - 1}
            aria-label="Next image"
          >›</button>
          <span className="chapter-image-panel-name" title={image.originalName}>{image.originalName}</span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setLightbox(true)}
            aria-label="Open full screen"
            title="Open full screen"
          >⛶</button>
        </div>
        <div className="chapter-image-panel-main">
          <ZoomableImage key={image.id} src={urlOf(image)} alt={image.originalName} />
        </div>
        {images.length > 1 && (
          <div className="chapter-image-panel-thumbs">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                className={`chapter-image-thumb${i === idx ? ' active' : ''}`}
                onClick={() => setIdx(i)}
                title={img.originalName}
                aria-label={`Show ${img.originalName}`}
                aria-current={i === idx ? 'true' : undefined}
              >
                <img src={urlOf(img)} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        )}
        {lightbox && (
          <ImageLightbox
            images={images}
            index={idx}
            getUrl={urlOf}
            onIndexChange={setIdx}
            onClose={() => setLightbox(false)}
          />
        )}
      </>
    );
  }

  return (
    <aside className="chapter-image-panel" aria-label="Chapter images" tabIndex={-1} onKeyDown={onKeyDown}>
      {body}
    </aside>
  );
}
