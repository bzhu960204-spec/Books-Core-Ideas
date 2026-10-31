/** Build a nested tree from the flat folder list (already sorted by sortOrder/name). */
export function buildFolderTree(folders) {
  const byId = new Map();
  folders.forEach(f => byId.set(f.id, { ...f, children: [] }));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId != null && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
