// Dataset quality scores (#33), as returned in `dataset.scores`:
// { version, usage, feedback, ratings: { up, meh, down } }. They are the
// scores of the current version and start from zero with a new version.

/** "+9.5", "−2", "0" */
export function formatFeedback(n) {
  if (!n) return '0';
  const v = Math.round(n * 10) / 10;
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`;
}

/** "6 😊 · 1 🤨 · 1 😞" */
export function formatRatings(r) {
  if (!r) return '';
  return `${r.up} 😊 · ${r.meh} 🤨 · ${r.down} 😞`;
}

export const SCORES_HELP =
  'Used: simulation runs that used this version. Feedback: users’ ratings of those runs ' +
  '(😊 +2, 🤨 −0.5, 😞 −2). Both start from zero when a new version is uploaded.';
