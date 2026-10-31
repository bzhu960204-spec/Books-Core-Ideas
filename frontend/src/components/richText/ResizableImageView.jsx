import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useRef } from 'react';

// ── Resizable image node view (drag the corner handle to resize) ──────────────
export default function ResizableImageView({ node, updateAttributes, editor }) {
  const imgRef = useRef(null);
  const drag = useRef({ startX: 0, startW: 0 });

  const onResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current.startX = e.clientX;
    drag.current.startW = imgRef.current?.offsetWidth ?? (node.attrs.width ?? 300);
    const onMove = (mv) => {
      const newW = Math.max(50, Math.round(drag.current.startW + mv.clientX - drag.current.startX));
      updateAttributes({ width: newW });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [updateAttributes, node.attrs.width]);

  const isEditable = editor?.isEditable ?? false;
  const w = node.attrs.width ?? null;

  return (
    <NodeViewWrapper as="div" className="rte-img-wrap" contentEditable={false}>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ''}
        title={node.attrs.title ?? undefined}
        style={w ? { width: `${w}px`, maxWidth: '100%' } : { maxWidth: '100%' }}
      />
      {isEditable && <span className="rte-img-resize-handle" onMouseDown={onResizeMouseDown} />}
    </NodeViewWrapper>
  );
}
