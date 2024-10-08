/* override recipe: enable DRM and let me watch videos ***/
user_pref("media.eme.enabled", true); // 2022

/* override recipe: enable session restore ***/
user_pref("browser.startup.page", 3); // 0102
  // user_pref("browser.privatebrowsing.autostart", false); // 0110 required if you had it set as true
  // user_pref("browser.sessionstore.privacy_level", 0); // 1003 optional to restore cookies/formdata
user_pref("privacy.clearOnShutdown.history", false); // 2811 DEPRECATED
user_pref("privacy.clearOnShutdown_v2.historyFormDataAndDownloads", false);
  // user_pref("privacy.cpd.history", false); // 2820 optional to match when you use Ctrl-Shift-Del
