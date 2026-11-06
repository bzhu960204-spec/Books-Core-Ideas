// Pure geometry for ZoomableImage. A view is { scale, x, y }: the image is drawn at
// `scale` (1 = natural pixels) with its top-left corner at (x, y) inside the container.

/** The scale that fits the whole image in the container; small images are not enlarged. */
export function fitScale(natural, container) {
  if (!natural.width || !natural.height || !container.width || !container.height) return 1;
  return Math.min(container.width / natural.width, container.height / natural.height, 1);
}

export function clampScale(scale, min, max) {
  return Math.min(max, Math.max(min, scale));
}

/** Changes the scale while keeping the image point under `point` (container coordinates) fixed. */
export function zoomAt({ scale, x, y }, nextScale, point) {
  const ratio = nextScale / scale;
  return {
    scale: nextScale,
    x: point.x - (point.x - x) * ratio,
    y: point.y - (point.y - y) * ratio,
  };
}

function clampAxis(offset, imageSize, containerSize) {
  if (imageSize <= containerSize) return (containerSize - imageSize) / 2;
  return Math.min(0, Math.max(containerSize - imageSize, offset));
}

/** Centres an axis the image does not fill; otherwise stops the image edge short of the container edge. */
export function clampOffset({ scale, x, y }, natural, container) {
  return {
    x: clampAxis(x, natural.width * scale, container.width),
    y: clampAxis(y, natural.height * scale, container.height),
  };
}
