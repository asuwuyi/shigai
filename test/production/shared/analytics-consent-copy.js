// One copy contract for Studio defaults, authoring controls and Website fallbacks.
(function consentCopyContract(root) {
  "use strict";
  const defaults = Object.freeze({
    title: "讓我們知道這個世界有人來過",
    description: "是否允許使用 Google Analytics 統計瀏覽與互動？拒絕也能正常看作品、探索與玩遊戲。",
    acceptLabel: "同意統計", rejectLabel: "拒絕統計", settingsLabel: "隱私與統計", policyLabel: "統計與隱私說明", closeLabel: "關閉",
    disabledDescription: "這個網站目前未啟用統計。你的選擇不會讓停用的追蹤自行開啟。",
    policyBody: "同意後，Google Analytics 會接收瀏覽頁面、裝置與瀏覽器資訊，以及作品入口、首頁區塊與遊戲互動等資料，協助我們了解網站的使用狀況；Google 可能設定分析 Cookie。\n未選擇或拒絕時，本版網站不載入 Google 統計，也不補傳同意前的操作。廣告用途的同意維持關閉。\n我們僅用必要的偏好 Cookie 記住你的選擇 180 天，不用它建立訪客身分。你可以隨時在「隱私與統計」更改選擇；撤回時會清除本網站可存取的 Google 分析 Cookie 並重新載入，停止後續追蹤，已送出的資料不會因此自動刪除。\n這個選擇針對 Google 統計，不代表第三方影片或外部網站也已被停用；那些服務可能有自己的資料處理方式。"
  });
  const labels = Object.freeze({ title: "提示標題", description: "簡短說明", acceptLabel: "同意按鈕", rejectLabel: "拒絕按鈕", settingsLabel: "修改偏好入口", policyLabel: "隱私說明標題", closeLabel: "關閉按鈕", disabledDescription: "統計停用說明", policyBody: "完整統計與隱私說明" });
  const contract = Object.freeze({ defaults, labels });
  if (typeof module === "object" && module.exports) module.exports = contract;
  else root.ShiGaiConsentCopy = contract;
})(typeof window === "object" ? window : globalThis);
