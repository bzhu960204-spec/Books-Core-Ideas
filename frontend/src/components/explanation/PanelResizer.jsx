const STEP = 0.05;

// Vertical drag handle between the text and the image panel. `ratio` is the panel's share of the
// container width; dragging left makes the panel wider.
export default function PanelResizer({ containerRef, ratio, onChange }) {
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    onChange((rect.right - e.clientX) / rect.width);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') onChange(ratio + STEP);
    else if (e.key === 'ArrowRight') onChange(ratio - STEP);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="reader-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize image panel"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={25}
      aria-valuemax={65}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    />
  );
}
