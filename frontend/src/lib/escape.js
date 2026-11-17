/** Escape text for safe interpolation into HTML (map popups show user-uploaded values). */
export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/** A small key/value table of feature properties, escaped. */
export function propsTableHtml(title, props, max = 8) {
  const rows = Object.entries(props || {})
    .filter(([k]) => !k.startsWith('_'))
    .slice(0, max)
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<strong>${escapeHtml(title)}</strong><table class="popup-table">${rows}</table>`;
}
