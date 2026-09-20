// One read-only settings request shared by every script on the current page.
window.ShiGaiWebsiteSettings = fetch("../database/website/settings.json")
  .then((response) => response.ok ? response.json() : {})
  .catch(() => ({}));
