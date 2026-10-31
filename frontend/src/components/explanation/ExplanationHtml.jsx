import { memo } from 'react';

// The rendered explanation HTML. Memoized so that unrelated state changes in
// the modal (e.g. the selection action bar appearing) don't re-apply innerHTML,
// which would rebuild the DOM and wipe the reader's current text selection.
const ExplanationHtml = memo(function ExplanationHtml({ html, fontScale, contentRef }) {
  return (
    <div
      ref={contentRef}
      className="review-bank-content review-reader-content"
      style={{ '--reader-font-scale': fontScale }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default ExplanationHtml;
