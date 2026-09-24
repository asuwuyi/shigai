(function journalPage() {
  let copy = { eyebrow: "SHI-GAI JOURNAL", title: "最近發生的事", intro: "創作、角色與日常留下來的片段。", readLabel: "閱讀這篇 →", workLabel: "查看作品 →", previousLabel: "← 上一篇", nextLabel: "下一篇 →", undatedLabel: "日期未定", emptyTitle: "日誌正在整理中。", emptyBody: "下一篇故事很快就會來到這裡。", errorTitle: "暫時無法載入日誌。", errorBody: "請稍後再試一次。" };
  const settingsReady = window.ShiGaiWebsiteSettings?.then((settings) => {
    const journal = settings?.websiteBrand?.journal || settings?.journal || {};
    copy = { ...copy, ...journal };
    document.getElementById("journalEyebrow").textContent = copy.eyebrow;
    document.getElementById("journalTitle").textContent = copy.title;
    document.getElementById("journalIntro").textContent = copy.intro;
    empty.querySelector("h2").textContent = copy.emptyTitle; empty.querySelector("p").textContent = copy.emptyBody;
    error.querySelector("h2").textContent = copy.errorTitle; error.querySelector("p").textContent = copy.errorBody;
  }) || Promise.resolve();
  const entriesRoot = document.getElementById("journalEntries");
  const empty = document.getElementById("journalEmpty");
  const error = document.getElementById("journalError");
  const pagination = document.getElementById("journalPagination");
  const previous = document.getElementById("journalPrevious");
  const next = document.getElementById("journalNext");
  const pageStatus = document.getElementById("journalPageStatus");
  const query = new URLSearchParams(location.search);
  const pageSize = 12;
  let journalWorks = [];

  function mediaSource(work) {
    const value = work.media?.optimized?.outputs?.primary || work.file || "";
    return value.startsWith("assets/") && !value.split("/").includes("..") ? `../${value}` : "";
  }
  function dateLabel(value) {
    const parts = String(value || "").split("-");
    return parts.length === 3 ? `${parts[0]} · ${parts[1]} · ${parts[2]}` : copy.undatedLabel;
  }
  function appendText(parent, tag, className, value) {
    const node = document.createElement(tag); node.className = className; node.textContent = value; parent.append(node); return node;
  }
  function renderMedia(parent, work) {
    const source = mediaSource(work);
    if (!source) return;
    const wrap = document.createElement("div"); wrap.className = "journal-media";
    const media = work.type === "video" ? document.createElement("video") : document.createElement("img");
    media.src = source;
    if (media.tagName === "VIDEO") { media.controls = true; media.preload = "metadata"; media.playsInline = true; }
    else { media.loading = "lazy"; media.alt = work.title || work.id; }
    wrap.append(media); parent.append(wrap);
  }
  function entryCard(work) {
    const article = document.createElement("article"); article.className = "journal-entry";
    appendText(article, "p", "journal-date", dateLabel(work.publishDate || work.createDate));
    renderMedia(article, work);
    appendText(article, "h2", "", work.title || work.id);
    appendText(article, "p", "journal-copy", work.journal?.text || work.description || "");
    const meta = document.createElement("p"); meta.className = "journal-meta";
    [work.category, ...(work.characters || [])].filter(Boolean).forEach((item) => appendText(meta, "span", "", item));
    article.append(meta);
    const links = document.createElement("div"); links.className = "journal-entry-links";
    const journalLink = document.createElement("a"); journalLink.className = "journal-detail-link"; journalLink.href = `journal.html?id=${encodeURIComponent(work.id)}`; journalLink.textContent = copy.readLabel; links.append(journalLink);
    const workLink = document.createElement("a"); workLink.className = "journal-detail-link"; workLink.href = `work.html?id=${encodeURIComponent(work.id)}`; workLink.textContent = copy.workLabel; links.append(workLink);
    article.append(links);
    return article;
  }
  function renderDetail(index) {
    entriesRoot.replaceChildren(entryCard(journalWorks[index]));
    pagination.hidden = journalWorks.length <= 1;
    previous.disabled = index === journalWorks.length - 1;
    next.disabled = index === 0;
    pageStatus.textContent = `${index + 1} / ${journalWorks.length}`;
    previous.textContent = copy.previousLabel; next.textContent = copy.nextLabel;
    previous.onclick = () => location.href = `journal.html?id=${encodeURIComponent(journalWorks[index + 1].id)}`;
    next.onclick = () => location.href = `journal.html?id=${encodeURIComponent(journalWorks[index - 1].id)}`;
  }
  function setPage(page) {
    const totalPages = Math.max(1, Math.ceil(journalWorks.length / pageSize));
    const safePage = Math.min(totalPages, Math.max(1, page));
    entriesRoot.replaceChildren(...journalWorks.slice((safePage - 1) * pageSize, safePage * pageSize).map(entryCard));
    pagination.hidden = totalPages <= 1; previous.disabled = safePage === 1; next.disabled = safePage === totalPages;
    pageStatus.textContent = `${safePage} / ${totalPages}`;
    previous.onclick = () => navigatePage(safePage - 1); next.onclick = () => navigatePage(safePage + 1);
  }
  function navigatePage(page) { const url = new URL(location.href); url.searchParams.set("page", page); location.href = url.href; }
  Promise.all([settingsReady, fetch("../database/website/works.json", { cache: "no-store" })])
    .then(([, response]) => { if (!response.ok) throw new Error("Journal data unavailable"); return response.json(); })
    .then((works) => {
      journalWorks = window.ShiGaiWorkOrder.newestFirst(works.filter((work) => work.status === "published" && work.journal?.enabled === true));
      empty.hidden = journalWorks.length !== 0;
      if (!journalWorks.length) return;
      const requestedId = query.get("id");
      if (requestedId) { const index = journalWorks.findIndex((work) => work.id === requestedId); if (index >= 0) { renderDetail(index); return; } }
      setPage(Number(query.get("page")) || 1);
    })
    .catch(() => { error.hidden = false; });
})();
