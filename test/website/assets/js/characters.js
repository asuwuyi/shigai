// Shi-Gai Characters Gallery. This page only reads Website export JSON.
const state = { characters: [], works: [] };
const elements = {
  grid: document.getElementById("charactersGrid"), template: document.getElementById("characterCardTemplate"),
  search: document.getElementById("characterSearch"), summary: document.getElementById("characterSummary"),
  empty: document.getElementById("emptyCharacters"), error: document.getElementById("characterLoadError"),
  menu: document.getElementById("characterMenu"), menuButton: document.getElementById("characterMenuButton")
};
const exhibitionWallpapers = ["burgundy-01", "sage-02", "navy-03", "ochre-04"];

function selectExhibitionWallpaper() {
  const key = "shi-gai:works-wallpaper:v1";
  let selected = sessionStorage.getItem(key);
  if (!exhibitionWallpapers.includes(selected)) {
    selected = exhibitionWallpapers[Math.floor(Math.random() * exhibitionWallpapers.length)];
    sessionStorage.setItem(key, selected);
  }
  document.body.style.setProperty("--works-wallpaper", `url("../images/wallpapers/salon-wallpaper-${selected}.webp")`);
}

function characterFrameNumber(character) {
  const identity = String(character.id || character.name || "character");
  const hash = [...identity].reduce((total, value) => (total * 31 + value.codePointAt(0)) >>> 0, 7);
  return String((hash % 12) + 1).padStart(2, "0");
}

function characterColor(name) {
  const palette = ["#79B8E8", "#FF9B6A", "#8fc590", "#a98cda", "#e5a6bd", "#d2ad55"];
  const hash = [...name].reduce((total, character) => total + character.codePointAt(0), 0);
  return palette[hash % palette.length];
}

function characterWorks(name) { return window.ShiGaiWorkOrder.newestFirst(state.works.filter((work) => (work.characters || []).includes(name))); }

function representativeArtwork(works) {
  return works.find((work) => work.type === "image" || work.type === "gif") || works[0] || null;
}

function artworkUrl(work) { const youtube = work.externalMedia?.find((item) => item.platform === "youtube")?.url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1]; return youtube ? `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` : new URL(`../${work.thumbnail || work.file}`, document.baseURI).href; }
function characterImageUrl(character) {
  const image = String(character.image || "").trim();
  if (!image) return "";
  if (/^(?:[a-z]+:)?\/\//i.test(image) || image.startsWith("/")) return new URL(image, document.baseURI).href;
  return new URL(`../${image}`, document.baseURI).href;
}

function shortIntroduction(character) {
  return character.shortDescription || character.introduction || character.bio || "";
}

function appendCharacterImage(container, character, artwork) {
  const sources = [characterImageUrl(character), artwork ? artworkUrl(artwork) : ""].filter(Boolean);
  const renderSource = (index) => {
    if (!sources[index]) {
      const placeholder = document.createElement("span");
      placeholder.className = "character-art-placeholder";
      placeholder.style.background = characterColor(character.name || "?");
      placeholder.textContent = [...(character.name || "?")][0];
      placeholder.setAttribute("aria-label", `${character.name} 的角色占位圖`);
      container.append(placeholder);
      return;
    }
    const image = document.createElement("img");
    image.src = sources[index];
    image.alt = `${character.name} 的角色圖片`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => { image.remove(); renderSource(index + 1); }, { once: true });
    container.append(image);
  };
  renderSource(0);
}

function filteredCharacters() {
  const keyword = elements.search.value.trim().toLocaleLowerCase();
  return state.characters
    .filter((character) => !keyword || String(character.name || "").toLocaleLowerCase().includes(keyword))
    .sort((first, second) => String(first.name || "").localeCompare(String(second.name || ""), "zh-Hant"));
}

function characterDetailUrl(character) {
  const query = new URLSearchParams();
  if (elements.search.value.trim()) query.set("q", elements.search.value.trim());
  if (new URLSearchParams(window.location.search).get("review") === "1") query.set("review", "1");
  query.set("id", character.id);
  return `character.html?${query.toString()}`;
}

function renderCharacters() {
  const characters = filteredCharacters();
  elements.grid.replaceChildren();
  elements.summary.textContent = state.characters.length ? `顯示 ${characters.length} 位角色` : "";
  elements.empty.hidden = Boolean(state.characters.length) && Boolean(characters.length);
  if (state.characters.length && !characters.length) {
    elements.empty.hidden = false;
    elements.empty.querySelector("h2").textContent = "找不到符合的角色。";
    elements.empty.querySelector("p").textContent = "試試看其他角色名稱。";
  }
  characters.forEach((character) => {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".character-card");
    const works = characterWorks(character.name);
    card.href = characterDetailUrl(character);
    card.addEventListener("click", () => window.ShiGaiAnalytics?.track("view_character", { character_id: character.id || "unknown" }));
    card.dataset.frame = characterFrameNumber(character);
    card.setAttribute("aria-label", `查看 ${character.name} 的角色詳細頁`);
    const media = fragment.querySelector(".character-frame-opening");
    const artwork = representativeArtwork(works);
    appendCharacterImage(media, character, artwork);
    fragment.querySelector(".character-card-name").textContent = character.name || "未命名角色";
    const description = shortIntroduction(character);
    const descriptionElement = fragment.querySelector(".character-card-description");
    descriptionElement.hidden = !description;
    descriptionElement.textContent = description;
    fragment.querySelector(".character-work-count").textContent = `${works.length} 件作品`;
    elements.grid.append(fragment);
  });
}

async function loadCharacters() {
  try {
    const [charactersResponse, worksResponse] = await Promise.all([
      fetch("../database/website/characters.json"), fetch("../database/website/works.json")
    ]);
    if (!charactersResponse.ok || !worksResponse.ok) throw new Error("Website export data could not be loaded.");
    const [characters, works] = await Promise.all([charactersResponse.json(), worksResponse.json()]);
    state.characters = Array.isArray(characters) ? characters : [];
    state.works = Array.isArray(works) ? works : [];
    elements.search.value = new URLSearchParams(window.location.search).get("q") || "";
    renderCharacters();
  } catch (error) {
    elements.grid.replaceChildren();
    elements.summary.textContent = "";
    elements.error.hidden = false;
  }
}

elements.search.addEventListener("input", renderCharacters);
elements.search.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { elements.search.value = ""; renderCharacters(); elements.search.blur(); }
});
elements.menuButton.addEventListener("click", () => {
  const open = elements.menu.classList.toggle("is-open");
  elements.menuButton.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  if (!elements.menu.classList.contains("is-open") || elements.menu.contains(event.target) || elements.menuButton.contains(event.target)) return;
  elements.menu.classList.remove("is-open"); elements.menuButton.setAttribute("aria-expanded", "false");
});

selectExhibitionWallpaper();
loadCharacters();
