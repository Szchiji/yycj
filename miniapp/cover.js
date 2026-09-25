(() => {
  function mediaSrc(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("file_id:")) return mediaSrc(s.slice(8));
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function isVideo(u) {
    const s = String(u || "");
    return s.startsWith("BAAC") || s.startsWith("BQAC") || /\.(mp4|mov|webm)(\?|$)/i.test(s);
  }
  function coverOf(item) {
    if (!item) return "";
    if (item.cover_url) return mediaSrc(item.cover_url);
    const media = item.media || [];
    for (const m of media) {
      const raw = (m && (m.file_id || m.url)) || "";
      if ((m && m.type) === "video" || isVideo(raw)) {
        const thumb = mediaSrc((m && (m.thumb_file_id || m.thumbnail || m.preview_url)) || "");
        if (thumb && !isVideo(String(m.thumb_file_id || m.thumbnail || ""))) return thumb;
        continue;
      }
      const u = mediaSrc((m && (m.preview_url || m.thumb_file_id || m.file_id || m.url)) || "");
      if (u) return u;
    }
    for (const p of item.photos || []) {
      if (isVideo(p)) continue;
      const u = mediaSrc(p);
      if (u) return u;
    }
    return "";
  }
  window.yycjMediaSrc = mediaSrc;
  window.yycjIsVideo = isVideo;
  window.yycjCoverOf = coverOf;
})();
