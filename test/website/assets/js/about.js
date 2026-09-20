const aboutDefaults = {
  title: "作者的工作室",
  intro: "Shi-Gai 是我的個人創作世界。我從事動畫、動態設計與影像製作，也持續創作角色、短動畫與互動作品。",
  servicesTitle: "可以一起完成的事",
  services: ["2D Animation", "Motion Design", "Illustration Animation", "Video Editing", "Character / IP Content", "Interactive Web / Creative Projects"]
};

const wallpaperChoices = ["burgundy-01", "sage-02", "navy-03", "ochre-04"];
const wallpaperKey = "shi-gai:works-wallpaper:v1";
let wallpaper = sessionStorage.getItem(wallpaperKey);
if (!wallpaperChoices.includes(wallpaper)) {
  wallpaper = wallpaperChoices[Math.floor(Math.random() * wallpaperChoices.length)];
  sessionStorage.setItem(wallpaperKey, wallpaper);
}
const wallpaperUrl = new URL(`assets/images/wallpapers/salon-wallpaper-${wallpaper}.webp`, document.baseURI).href;
document.body.style.setProperty("--about-wallpaper", `url("${wallpaperUrl}")`);

function safeHttpUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}

window.ShiGaiWebsiteSettings
  .then(({ websiteBrand = {} }) => {
    const about = { ...aboutDefaults, ...(websiteBrand.about || {}) };
    document.title = `${about.title} · ${websiteBrand.siteName || "Shi-Gai"}`;
    document.getElementById("aboutTitle").textContent = about.title;
    document.getElementById("aboutIntro").textContent = about.intro;
    document.getElementById("servicesTitle").textContent = about.servicesTitle;
    document.getElementById("aboutServices").replaceChildren(...(about.services || []).map((label) => { const item = document.createElement("li"); item.textContent = label; return item; }));
    const email = String(about.email || "").trim();
    const emailLink = document.getElementById("aboutEmail");
    emailLink.hidden = !email; emailLink.textContent = email; emailLink.href = email ? `mailto:${email}` : "#";
    const socials = [["Instagram", about.instagram], ["YouTube", about.youtube]].map(([label, value]) => [label, safeHttpUrl(value)]).filter(([, url]) => url);
    document.getElementById("aboutSocials").replaceChildren(...socials.map(([label, url]) => { const link = document.createElement("a"); link.textContent = label; link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; return link; }));
    document.getElementById("aboutContact").hidden = !email && !socials.length;
  })
  .catch(() => { window.location.replace("index.html"); });
