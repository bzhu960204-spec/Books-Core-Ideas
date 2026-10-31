import { ReactNodeViewRenderer } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import ResizableImageView from './ResizableImageView';

// Custom extension: adds a `fontSize` attribute to the textStyle mark so the
// font-size dropdown can read/write inline `style="font-size: …"`.
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: el => el.style.fontSize?.replace(/['"]/g, '') || null,
            renderHTML: attrs => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: size => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Markdown source of a pasted card screenshot, URI-encoded so no raw `<`/`>` is stored.
      markdownSource: {
        default: null,
        parseHTML: el => {
          const raw = el.getAttribute('data-markdown-source');
          if (!raw) return null;
          try {
            return decodeURIComponent(raw);
          } catch {
            return null;
          }
        },
        renderHTML: attrs =>
          attrs.markdownSource ? { 'data-markdown-source': encodeURIComponent(attrs.markdownSource) } : {},
      },
      width: {
        default: null,
        parseHTML: el => {
          const raw = el.getAttribute('width') || el.style.width;
          if (!raw) return null;
          const n = parseInt(raw, 10);
          return isNaN(n) ? null : n;
        },
        renderHTML: attrs => {
          if (!attrs.width) return {};
          return { width: String(attrs.width), style: `width:${attrs.width}px` };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
