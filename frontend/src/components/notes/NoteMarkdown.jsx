import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const REMARK = [remarkGfm, remarkBreaks, remarkMath];
const REHYPE = [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]];

const COMPONENTS = {
  // Links open in a new tab and don't trigger a clickable parent (e.g. a card).
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />
  ),
};

// A note rendered as Markdown (GFM, single newlines kept, $TeX$ math). Raw HTML
// in the note is not rendered.
export default function NoteMarkdown({ children, className = '' }) {
  return (
    <div className={`note-markdown ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={COMPONENTS}>
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
