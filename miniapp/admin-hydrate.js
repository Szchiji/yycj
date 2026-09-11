(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (!el || val == null) return;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  }
  async function hydrate() {
    const r = await fetch("/api/admin/homepage", { headers: { Authorization: "Bearer " + token() } });
    const data = await r.json();
    const s = data.settings || {};
    setVal("annText", s.announcement_text);
    setVal("annOn", s.announcement_enabled);
    setVal("citiesInput", (s.enabled_cities || []).join(","));
    setVal("opsPageSize", s.home_feed_page_size);
    setVal("opsCta", s.chat_cta_label);
    setVal("opsWelcome", s.bot_welcome_text);
    setVal("opsMediaMax", s.media_max_count);
    setVal("opsMediaChannel", s.media_channel_id);
    setVal("opsListingDays", s.listing_days);
    setVal("opsCarouselSec", s.carousel_interval_sec);
    setVal("opsAdminContact", s.admin_contact);
    setVal("opsShowBot", s.show_bot_link);
    setVal("opsShowAdmin", s.show_admin_link);
    setVal("opsReviewAudit", s.review_require_audit);
    const chats = (s.required_chats || []).map((c) => [c.chat_id, c.title, c.url].filter(Boolean).join("|")).join("\n");
    setVal("opsChats", chats);
    setVal("opsPromo", s.approve_promo_text);
    setVal("opsChannel", s.broadcast_channel);
    setVal("opsBroadcastTpl", s.broadcast_template);
  }
  document.getElementById("btnRefresh")?.addEventListener("click", () => hydrate().catch(() => {}));
  setTimeout(() => hydrate().catch(() => {}), 900);
})();
