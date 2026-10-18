// One read-only settings request shared by every script on the current page.
window.ShiGaiWebsiteSettings = fetch(new URL("../../../database/website/settings.json", document.currentScript.src))
  .then((response) => response.ok ? response.json() : {})
  .catch(() => ({}));
