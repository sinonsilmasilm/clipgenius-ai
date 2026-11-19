function formatTimestamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRemainder = ms % 1000;
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msRemainder, 3)}`;
}

// Builds an SRT file from Whisper segments that fall inside [clipStart, clipEnd],
// re-timed relative to the clip's own start (0:00).
function buildSrtForClip(segments, clipStart, clipEnd) {
  const relevant = (segments || []).filter(
    (seg) => seg.end > clipStart && seg.start < clipEnd
  );

  if (relevant.length === 0) return null;

  const lines = relevant.map((seg, idx) => {
    const start = Math.max(0, seg.start - clipStart);
    const end = Math.max(start + 0.2, Math.min(seg.end, clipEnd) - clipStart);
    const text = (seg.text || "").trim();
    return `${idx + 1}\n${formatTimestamp(start)} --> ${formatTimestamp(end)}\n${text}\n`;
  });

  return lines.join("\n");
}

module.exports = { buildSrtForClip, formatTimestamp };
