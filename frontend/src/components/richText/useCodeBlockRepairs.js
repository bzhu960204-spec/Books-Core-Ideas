import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { collectBrokenCodeOps, collectCardImageOps } from './codeRepairs';
import { dropOversizeImages, transformCopilotCodeBlocks } from './pasteTransforms';

/**
 * The code-block repairs of the "more" toolbar. Created before the editor, whose
 * callbacks are fixed at creation, so they work through refs; the actions take
 * the editor as an argument.
 *
 * - `offer`: a just-pasted Copilot answer whose pseudo-code blocks can be rendered
 *   as real code blocks ({ from, to, html, count }). The raw clipboard HTML lives
 *   only in memory, so the offer is dropped once the pasted range is edited.
 *   `armOffer` (from the paste handler) carries it to `onEditorUpdate`, where the
 *   pasted range's end is known.
 * - `renderOffer`, `fixBroken`, `convertCards`: the three repair buttons.
 */
export function useCodeBlockRepairs() {
  const [offer, setOffer] = useState(null);
  const offerRef = useRef(null);
  const pendingRef = useRef(null);
  const setAtRef = useRef(0);
  // Set while our own convert/fix transactions run so they don't dismiss the offer.
  const convertingRef = useRef(false);

  // Editor callbacks are created once, so they read the latest offer via a ref.
  useLayoutEffect(() => {
    offerRef.current = offer;
  }, [offer]);

  const armOffer = useCallback((info) => {
    pendingRef.current = info;
  }, []);

  // Called from the editor's onUpdate for every document change.
  const onEditorUpdate = useCallback((editor) => {
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      setOffer({ ...pending, to: editor.state.selection.to });
      setAtRef.current = Date.now();
    } else if (!convertingRef.current && offerRef.current && Date.now() - setAtRef.current > 400) {
      // Later edits invalidate the range; the 400ms window skips the paste's own follow-up transactions.
      setOffer(null);
    }
  }, []);

  // Rewrite the just-pasted range with its pseudo-code blocks as real code blocks.
  const renderOffer = useCallback((editor) => {
    const info = offerRef.current;
    if (!editor || !info) return;
    const size = editor.state.doc.content.size;
    const from = Math.min(info.from, size);
    const to = Math.min(info.to, size);
    if (to > from) {
      const { html } = transformCopilotCodeBlocks(info.html);
      convertingRef.current = true;
      editor.chain().focus().insertContentAt({ from, to }, dropOversizeImages(html)).run();
      convertingRef.current = false;
    }
    setOffer(null);
  }, []);

  // Repair every broken "Plain Text" block in one undoable step, back-to-front so
  // earlier positions stay valid.
  const fixBroken = useCallback((editor) => {
    if (!editor) return;
    const ops = collectBrokenCodeOps(editor.state.doc).sort((a, b) => b.from - a.from);
    if (!ops.length) return;
    const { schema } = editor.state;
    let tr = editor.state.tr;
    for (const op of ops) {
      tr = tr.replaceWith(op.from, op.to, schema.nodes.codeBlock.create(null, schema.text(op.text)));
    }
    convertingRef.current = true;
    editor.view.dispatch(tr);
    convertingRef.current = false;
    // Keep a pending Render offer's range valid across this edit.
    const pending = offerRef.current;
    if (pending) setOffer({ ...pending, to: tr.mapping.map(pending.to) });
    editor.commands.focus();
  }, []);

  // Replace each Markdown-card screenshot with a markdown code block of its source.
  const convertCards = useCallback((editor) => {
    if (!editor) return;
    const ops = collectCardImageOps(editor.state.doc).sort((a, b) => b.from - a.from);
    if (!ops.length) return;
    const { schema } = editor.state;
    let tr = editor.state.tr;
    for (const op of ops) {
      tr = tr.replaceWith(
        op.from,
        op.to,
        schema.nodes.codeBlock.create({ language: 'markdown' }, schema.text(op.text)),
      );
    }
    convertingRef.current = true;
    editor.view.dispatch(tr);
    convertingRef.current = false;
    // Positions shifted, so a pending Render offer is stale.
    setOffer(null);
    editor.commands.focus();
  }, []);

  return { offer, armOffer, onEditorUpdate, renderOffer, fixBroken, convertCards };
}

/** How many broken code blocks / card images there are, kept fresh (debounced) while `enabled`. */
export function useRepairCounts(editor, enabled) {
  const [brokenCodeCount, setBrokenCodeCount] = useState(0);
  const [cardImageCount, setCardImageCount] = useState(0);

  useEffect(() => {
    if (!editor || !enabled) return undefined;
    let timer;
    const refresh = () => {
      setBrokenCodeCount(collectBrokenCodeOps(editor.state.doc).length);
      setCardImageCount(collectCardImageOps(editor.state.doc).length);
    };
    const onEditorUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    };
    refresh();
    editor.on('update', onEditorUpdate);
    return () => {
      clearTimeout(timer);
      editor.off('update', onEditorUpdate);
    };
  }, [editor, enabled]);

  return { brokenCodeCount, cardImageCount };
}
