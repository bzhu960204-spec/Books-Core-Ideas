import Modal from './Modal';

// Strip tags and shorten a snippet so before/after previews stay readable.
function preview(s) {
  const text = s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

// Prompt shown when malformed links are detected (on paste or on demand).
// The user decides: auto-fix, keep as-is, or cancel. With no issues it simply
// reports a clean result.
export default function LinkFixPrompt({ fixes, onFix, onKeepRaw, onClose }) {
  const hasIssues = Array.isArray(fixes) && fixes.length > 0;

  return (
    <Modal title={hasIssues ? 'Fix malformed links?' : 'Link check'} onClose={onClose}>
      {hasIssues ? (
        <>
          <p className="confirm-text">
            检测到 {fixes.length} 处链接格式异常（嵌套或双括号）。保留原样会导致整条网址暴露并出现横向滚动条。建议修复为规范链接：
          </p>
          <ul className="link-fix-list">
            {fixes.map((f, i) => (
              <li key={i} className="link-fix-item">
                <div className="link-fix-before" title={f.original}>{preview(f.original)}</div>
                <div className="link-fix-after" title={f.fixed}>→ {preview(f.fixed)}</div>
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>取消</button>
            {onKeepRaw && (
              <button className="btn btn-secondary" onClick={onKeepRaw}>保持原样</button>
            )}
            <button className="btn btn-primary" onClick={onFix}>自动修复</button>
          </div>
        </>
      ) : (
        <>
          <p className="confirm-text">未发现需要修复的链接。</p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>关闭</button>
          </div>
        </>
      )}
    </Modal>
  );
}
