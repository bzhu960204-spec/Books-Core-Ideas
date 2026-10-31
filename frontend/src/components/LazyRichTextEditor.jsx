import { lazy, Suspense } from 'react';

// TipTap and ProseMirror are the largest part of the app's code, and only the
// review and explanation editors need them: load them when an editor is first
// shown (FE-04). Same props as RichTextEditor.
const RichTextEditor = lazy(() => import('./RichTextEditor'));

export default function LazyRichTextEditor(props) {
  return (
    <Suspense fallback={<div className="loading">Loading editor</div>}>
      <RichTextEditor {...props} />
    </Suspense>
  );
}
