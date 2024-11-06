{ ... }:
let
  extension = shortId: uuid: {
    # shortID = firefox addon url endpoint; uuid = about:support
    name = uuid;
    value = {
      install_url = "https://addons.mozilla.org/en-US/firefox/downloads/latest/${shortId}/latest.xpi";
      installation_mode = "force_installed";
    };
  };

  extensionSettings = {
    "*".installation_mode = "blocked"; # blocks all addons except the ones specified below
  } // builtins.listToAttrs [
      # privacy
      (extension "ublock-origin" "uBlock0@raymondhill.net")
      (extension "umatrix" "uMatrix@raymondhill.net")
      (extension "skip-redirect" "skipredirect@sblask")

      # usage
      (extension "1password-x-password-manager" "{d634138d-c276-4fc8-924b-40a0ea21d284}")
      (extension "sidebery" "{3c078156-979c-498b-8990-85f7987dd929}")
      (extension "ublacklist" "@ublacklist")
      (extension "unpaywall" "{f209234a-76f0-4735-9920-eb62507a54cd}")

      # yt
      (extension "return-youtube-dislikes" "{762f9885-5a13-4abd-9c77-433dcd38b8fd}")
      (extension "sponsorblock" "sponsorBlocker@ajay.app")
    ];
in {
  programs.firefox = {
    enable = true;
    languagePacks = [ "en-US" ];
    # about:policies#documentation
    policies = {
      AllowFileSelectionDialogs = true; # Allow file selection dialogs.
      AppAutoUpdate = false; # Enable or disable automatic application update.
      AutofillAddressEnabled = false; # Enable autofill for addresses.
      AutofillCreditCardEnabled = false; # Enable autofill for payment methods.
      BackgroundAppUpdate = false; # Enable or disable the background updater.
      # Allow or deny websites to set cookies.
      Cookies = {
        Behavior = "reject-tracker";
        BehaviorPrivateBrowsing = "reject";
      };
      DisableAccounts = false; # Disable account-based services, including sync.
      DisableAppUpdate = true; # Prevent the browser from updating.
      DisableDefaultBrowserAgent = true; # Prevent the default browser agent from taking any actions. Only applicable to Windows; other platforms don’t have the agent.
      DisableDeveloperTools = false; # Block access to the developer tools.
      DisableFeedbackCommands = true; # Disable commands to send feedback from the Help menu (Submit Feedback and Report Deceptive Site).
      DisableFirefoxAccounts = false; # Disable account-based services, including sync.
      DisableFirefoxStudies = true; # Prevent Firefox from running studies.
      DisablePasswordReveal = true; # Do not allow passwords to be revealed in saved logins.
      DisablePocket = true; # Disable the feature to save webpages to Pocket.
      DisableProfileImport = true; # Disable the menu command to Import data from another browser.
      DisableSystemAddonUpdate = true; # Prevent the browser from installing and updating system add-ons.
      DisableTelemetry = true; # Turn off Telemetry.
      DisableThirdPartyModuleBlocking = false; # Prevent the user from blocking third-party modules that get injected into the Firefox process.
      DisplayBookmarksToolbar = "never"; # Display the Bookmarks Toolbar by default.
      DisplayMenuBar = "never"; # Display the Menu Bar by default.
      DontCheckDefaultBrowser = true; # Disable check for default browser on startup.
      # Enable or disable Content Blocking and optionally lock it.
      EnableTrackingProtection = {
        Value = true;
        Locked = true;
        Cryptomining = true;
        Fingerprinting = true;
      };
      EncryptedMediaExtensions = { Enabled = true; }; # Enable or disable Encrypted Media Extensions and optionally lock it.
      ExtensionSettings = extensionSettings;
      ExtensionUpdate = true; # Enable or disable automatic extension updates.
      # Configure Firefox Home.
      FirefoxHome = {
        Search = true;
        TopSites = false;
        SponsoredTopSites = false;
        Highlights = false;
        Pocket = false;
        SponsoredPocket = false;
        Snippets = false;
        Locked = false;
      };
      # Configure Firefox Suggest.
      FirefoxSuggest = {
        WebSuggestions = false;
        SponsoredSuggestions = false;
        ImproveSuggest = false;
      };
      HardwareAcceleration = false; # If false, turn off hardware acceleration. NOTE: sites track you through hardware specs
      # Set and optionally lock the homepage.
      HttpsOnlyMode = true; # Allow HTTPS-Only Mode to be enabled.
      # Allow certain websites to install add-ons.
      InstallAddonsPermission = {
        Default = false;
      };
      ManualAppUpdateOnly = true; # Allow manual updates only and do not notify the user about updates.
      NoDefaultBookmarks = true; # Disable creation of the default bookmarks bundled with Firefox, and the Smart Bookmarks (Most Visited, Recent Tags). Note: this policy is only effective if used before the first run of the profile.
      OfferToSaveLogins = false; # Enforce the setting to allow Firefox to offer to remember saved logins and passwords. Both true and false values are accepted.
      OfferToSaveLoginsDefault = false; # Set the default value for allowing Firefox to offer to remember saved logins and passwords. Both true and false values are accepted.
      OverrideFirstRunPage = ""; # Override the first run page. Set this policy to blank if you want to disable the first run page.
      OverridePostUpdatePage = ""; # Override the post-update “What’s New” page. Set this policy to blank if you want to disable the post-update page.
      PasswordManagerEnabled = false; # Enable saving passwords to the password manager.
      # Configure permissions for camera, microphone, location, notifications, and autoplay.
      Permissions = {
        Camera = {
          BlockNewRequests = true;
        };
        Microphone = {
          BlockNewRequests = false;
        };
        Location = {
          BlockNewRequests = true;
        };
        Notifications = {
          BlockNewRequests = true;
        };
        Autoplay = {
          Default = "block-audio-video";
        };
      };
      # Allow certain websites to display popups by default.
      PopupBlocking = {
        Default = false;
      };
      PrivateBrowsingModeAvailability = 0; # Set availability of private browsing mode.
      SearchBar = "unified"; # Set the default location of the search bar. The user is still allowed to customize it.
      SearchEngines = {
        PreventInstalls = true;
        Add = [
          {
            Name = "SearXNG";
            URLTemplate = "https://searx.tiekoetter.com/search?q={searchTerms}";
            Method = "GET";
            IconURL = "https://searx.tiekoetter.com/favicon.ico";
            Description = "SearX instance ran by tiekoetter.com";
          }
        ];
        Remove = [
          "Amazon.com"
          "Bing"
          "Google"
        ];
        Default = "SearXNG";
        # about:config
        # Set and lock the value for a subset of preferences.
        # modified version of arkenfox
        # https://github.com/arkenfox/user.js/blob/f906f7f3b41fe3f6aaa744980431f4fdcd086379/user.js
        Preferences = let
          lock = Value: {
            inherit Value;
            Status = "locked";
          };
          F = lock false;
          T = lock true;
          E = lock "";
        in {
          "browser.aboutConfig.showWarning" = F;

          # [SECTION 0100]: STARTUP
          "browser.startup.page" = lock 3;
          "browser.startup.homepage" = lock "about:blank";
          "browser.newtabpage.enabled" = F;
          "browser.newtabpage.activity-stream.showSponsored" = F;
          "browser.newtabpage.activity-stream.showSponsoredTopSites" = F;
          "browser.newtabpage.activity-stream.default.sites" = E;

          # [SECTION 0200]: GEOLOCATION
          "geo.provider.ms-windows-location" = F;
          "geo.provider.use_corelocation" = F;
          "geo.provider.use_geoclue" = F;

          # [SECTION 0300]: QUIETER FOX
          "extensions.getAddons.showPane" = F;
          "extensions.htmlaboutaddons.recommendations.enabled" = F;
          "browser.discovery.enabled" = F;
          "browser.shopping.experience2023.enabled" = F;
          "datareporting.policy.dataSubmissionEnabled" = F;
          "datareporting.healthreport.uploadEnabled" = F;
          "toolkit.telemetry.unified" = F;
          "toolkit.telemetry.enabled" = F;
          "toolkit.telemetry.server" = lock "data:,";
          "toolkit.telemetry.archive.enabled" = F;
          "toolkit.telemetry.newProfilePing.enabled" = F;
          "toolkit.telemetry.shutdownPingSender.enabled" = F;
          "toolkit.telemetry.updatePing.enabled" = F;
          "toolkit.telemetry.bhrPing.enabled" = F;
          "toolkit.telemetry.firstShutdownPing.enabled" = F;
          "toolkit.telemetry.coverage.opt-out" = T;
          "toolkit.coverage.opt-out" = T;
          "toolkit.coverage.endpoint.base" = E;
          "browser.newtabpage.activity-stream.feeds.telemetry" = F;
          "browser.newtabpage.activity-stream.telemetry" = F;
          "app.shield.optoutstudies.enabled" = F;
          "app.normandy.enabled" = F;
          "app.normandy.api_url" = E;
          "breakpad.reportURL" = E;
          "browser.tabs.crashReporting.sendReport" = F;
          "browser.crashReports.unsubmittedCheck.enabled" = F;
          "browser.crashReports.unsubmittedCheck.autoSubmit2" = F;
          "captivedetect.canonicalURL" = E;
          "network.captive-portal-service.enabled" = F;
          "network.connectivity-service.enabled" = F;

          # [SECTION 0400]: SAFE BROWSING (SB)
          "browser.safebrowsing.malware.enabled" = F;
          "browser.safebrowsing.phishing.enabled" = F;
          "browser.safebrowsing.downloads.enabled" = F;
          "browser.safebrowsing.downloads.remote.enabled" = F;
          "browser.safebrowsing.downloads.remote.url" = E;
          "browser.safebrowsing.downloads.remote.block_potentially_unwanted" = F;
          "browser.safebrowsing.downloads.remote.block_uncommon" = F;
          "browser.safebrowsing.allowOverride" = F;

          # [SECTION 0600]: BLOCK IMPLICIT OUTBOUND [not explicitly asked for - e.g. clicked on]
          "network.prefetch-next" = F;
          "network.dns.disablePrefetch" = T;
          "network.dns.disablePrefetchFromHTTPS" = T;
          "network.predictor.enabled" = F;
          "network.predictor.enable-prefetch" = F;
          "network.http.speculative-parallel-limit" = lock 0;
          "browser.places.speculativeConnect.enabled" = F;
          "browser.send_pings" = F;

          # [SECTION 0700]: DNS / DoH / PROXY / SOCKS
          "network.proxy.socks_remote_dns" = T;
          "network.file.disable_unc_paths" = T;
          "network.gio.supported-protocols" = E;
          "network.proxy.failover_direct" = F;
          "network.proxy.allow_bypass" = F;
          # "network.trr.mode" = 3;
          # "network.trr.uri" = "https:#example.dns";
          # "network.trr.custom_uri" = "https:#example.dns";

          # [SECTION 0800]: LOCATION BAR / SEARCH BAR / SUGGESTIONS / HISTORY / FORMS
          "browser.urlbar.speculativeConnect.enabled" = F;
          "browser.urlbar.quicksuggest.enabled" = F;
          "browser.urlbar.suggest.quicksuggest.nonsponsored" = F;
          "browser.urlbar.suggest.quicksuggest.sponsored" = F;
          "browser.search.suggest.enabled" = F;
          "browser.urlbar.suggest.searches" = F;
          "browser.urlbar.trending.featureGate" = F;
          "browser.urlbar.addons.featureGate" = F;
          "browser.urlbar.mdn.featureGate" = F;
          "browser.urlbar.pocket.featureGate" = F;
          "browser.urlbar.weather.featureGate" = F;
          "browser.urlbar.yelp.featureGate" = F;
          "browser.urlbar.clipboard.featureGate" = F;
          "browser.urlbar.recentsearches.featureGate" = F; # TODO: decide
          "browser.formfill.enable" = F;
          "browser.urlbar.suggest.engines" = F;
          "layout.css.visited_links_enabled" = F;
          "browser.search.separatePrivateDefault" = T;
          "browser.search.separatePrivateDefault.ui.enabled" = T;

          # [SECTION 0900]: PASSWORDS
          "signon.autofillForms" = F;
          "signon.formlessCapture.enabled" = F;
          "network.http.windows-sso.enabled" = F;

          # [SECTION 1000]: DISK AVOIDANCE
          "browser.cache.disk.enable" = F;
          "browser.privatebrowsing.forceMediaMemoryCache" = T;
          "media.memory_cache_max_size" = lock 65536;
          "browser.sessionstore.privacy_level" = lock 2;
          "toolkit.winRegisterApplicationRestart" = F;
          "browser.shell.shortcutFavicons" = F;

          # [SECTION 1200]: HTTPS (SSL/TLS / OCSP / CERTS / HPKP)
          "security.ssl.require_safe_negotiation" = T;
          "security.tls.enable_0rtt_data" = F;
          "security.OCSP.enabled" = lock 1;
          "security.OCSP.require" = T;
          "security.cert_pinning.enforcement_level" = lock 2;
          "security.remote_settings.crlite_filters.enabled" = T;
          "security.pki.crlite_mode" = lock 2;
          "security.mixed_content.block_display_content" = T; # TODO: find out if this causes any problems
          "dom.security.https_only_mode" = T;
          "dom.security.https_only_mode_pbm" = T;
          # "dom.security.https_only_mode.upgrade_local" = T;
          "dom.security.https_only_mode_send_http_background_request" = F;
          "security.ssl.treat_unsafe_negotiation_as_broken" = T;
          "browser.xul.error_pages.expert_bad_cert" = T;

          # [SECTION 1600]: REFERERS
          "network.http.referer.XOriginTrimmingPolicy" = lock 2;

          # [SECTION 1700]: CONTAINERS
          "privacy.userContext.enabled" = T;
          "privacy.userContext.ui.enabled" = T;
          "privacy.userContext.newTabContainerOnLeftClick.enabled" = F;
          # "browser.link.force_default_user_context_id_for_external_opens" = T;

          # [SECTION 2000]: PLUGINS / MEDIA / WEBRTC
          "media.peerconnection.ice.proxy_only_if_behind_proxy" = T;
          "media.peerconnection.ice.default_address_only" = T;
          "media.peerconnection.ice.no_host" = T; # NOTE: breaks video conferencing sites
          "media.gmp-provider.enabled" = F; # TODO: find out if it causes any problems

          # [SECTION 2400]: DOM (DOCUMENT OBJECT MODEL)
          "dom.disable_window_move_resize" = T;

          # [SECTION 2600]: MISCELLANEOUS
          "browser.download.start_downloads_in_tmp_dir" = T;
          "browser.helperApps.deleteTempFileOnExit" = T;
          "browser.uitour.enabled" = F;
          "browser.uitour.url" = E;
          "devtools.debugger.remote-enabled" = F;
          "permissions.default.shortcuts" = lock 2;
          "permissions.manager.defaultsUrl" = E;
          "webchannel.allowObject.urlWhitelist" = E;
          "network.IDN_show_punycode" = T;
          "pdfjs.disabled" = F;
          "pdfjs.enableScripting" = F;
          "browser.tabs.searchclipboardfor.middleclick" = F;
          "browser.contentanalysis.enabled" = F;
          "browser.contentanalysis.default_result" = lock 0;
          "browser.download.useDownloadDir" = F;
          "browser.download.alwaysOpenPanel" = F;
          "browser.download.manager.addToRecentDocs" = F;
          "browser.download.always_ask_before_handling_new_types" = T;
          "extensions.enabledScopes" = lock 5;
          "extensions.autoDisableScopes" = lock 15;
          "extensions.postDownloadThirdPartyPrompt" = F;
          "extensions.webextensions.restrictedDomains" = E;

          # [SECTION 2700]: ETP (ENHANCED TRACKING PROTECTION)
          "browser.contentblocking.category" = lock "strict";
          # "privacy.antitracking.enableWebcompat" = F;

          # [SECTION 2800]: SHUTDOWN & SANITIZING
          "privacy.sanitize.sanitizeOnShutdown" = T;
          "privacy.clearOnShutdown.cache" = T;
          "privacy.clearOnShutdown_v2.cache" = T;
          "privacy.clearOnShutdown.downloads" = T;
          "privacy.clearOnShutdown.formdata" = T;
          "privacy.clearOnShutdown.history" = F;
          "privacy.clearOnShutdown_v2.historyFormDataAndDownloads" = T;
          "privacy.clearOnShutdown.siteSettings" = F;
          "privacy.clearOnShutdown_v2.siteSettings" = F;
          "privacy.clearOnShutdown.openWindows" = F;
          "privacy.clearOnShutdown.cookies" = T;
          "privacy.clearOnShutdown.offlineApps" = T;
          "privacy.clearOnShutdown.sessions" = T;
          "privacy.clearOnShutdown_v2.cookiesAndStorage" = T;
          "privacy.clearSiteData.cache" = T;
          "privacy.clearSiteData.cookiesAndStorage" = F;
          "privacy.clearSiteData.historyFormDataAndDownloads" = T;
          "privacy.clearSiteData.siteSettings" = F;
          "privacy.cpd.cache" = T;
          "privacy.clearHistory.cache" = T;
          "privacy.cpd.formdata" = T;
          "privacy.cpd.history" = T;
          "privacy.cpd.downloads" = T;
          "privacy.clearHistory.historyFormDataAndDownloads" = T;
          "privacy.cpd.cookies" = F;
          "privacy.cpd.sessions" = T;
          "privacy.cpd.offlineApps" = F;
          "privacy.clearHistory.cookiesAndStorage" = F;
          "privacy.cpd.openWindows" = F;
          "privacy.cpd.passwords" = T;
          "privacy.cpd.siteSettings" = F;
          "privacy.clearHistory.siteSettings" = F;
          "privacy.sanitize.timeSpan" = lock 0;

          # [SECTION 4000]: FPP (fingerprintingProtection)
          "privacy.fingerprintingProtection.pbmode" = T;

          # [SECTION 4500]: OPTIONAL RFP (resistFingerprinting)
          "privacy.resistFingerprinting" = T; # WARN: this might be overkill / too agressive for everyday use
          "privacy.resistFingerprinting.pbmode" = T;
          "privacy.window.maxInnerWidth" = 1600;
          "privacy.window.maxInnerHeight" = 900;
          "privacy.resistFingerprinting.block_mozAddonManager" = T; # NOTE: To allow extensions to work on AMO, you also need 2662
          "privacy.resistFingerprinting.letterboxing" = T;
          "privacy.resistFingerprinting.letterboxing.dimensions" = E; # TODO: might need to set some dimensions
          # "privacy.resistFingerprinting.exemptedDomains" = "*.example.invalid";
          "privacy.spoof_english" = 2;
          "browser.display.use_system_colors" = F;
          "browser.link.open_newwindow" = 3;
          "browser.link.open_newwindow.restriction" = 0;
          # "webgl.disabled" = T;

          # [SECTION 5000]: OPTIONAL OPSEC
          "browser.privatebrowsing.autostart" = F;
/* 5002: disable memory cache
 * capacity: -1=determine dynamically (default), 0=none, n=memory capacity in kibibytes ***/
   # "browser.cache.memory.enable" = F;
   # "browser.cache.memory.capacity" = 0;
/* 5003: disable saving passwords
 * [NOTE] This does not clear any passwords already saved
 * [SETTING] Privacy & Security>Logins and Passwords>Ask to save logins and passwords for websites ***/
   # "signon.rememberSignons" = F;
/* 5004: disable permissions manager from writing to disk [FF41+] [RESTART]
 * [NOTE] This means any permission changes are session only
 * [1] https:#bugzilla.mozilla.org/967812 ***/
   # "permissions.memory_only" = T;
/* 5005: disable intermediate certificate caching [FF41+] [RESTART]
 * [NOTE] This affects login/cert/key dbs. The effect is all credentials are session-only.
 * Saved logins and passwords are not available. Reset the pref and restart to return them ***/
   # "security.nocertdb" = T;
/* 5006: disable favicons in history and bookmarks
 * [NOTE] Stored as data blobs in favicons.sqlite, these don't reveal anything that your
 * actual history (and bookmarks) already do. Your history is more detailed, so
 * control that instead; e.g. disable history, clear history on exit, use PB mode
 * [NOTE] favicons.sqlite is sanitized on Firefox close ***/
   # "browser.chrome.site_icons" = F;
/* 5007: exclude "Undo Closed Tabs" in Session Restore ***/
   # "browser.sessionstore.max_tabs_undo" = 0;
/* 5008: disable resuming session from crash
 * [TEST] about:crashparent ***/
   # "browser.sessionstore.resume_from_crash" = F;
/* 5009: disable "open with" in download dialog [FF50+]
 * Application data isolation [1]
 * [1] https:#bugzilla.mozilla.org/1281959 ***/
   # "browser.download.forbid_open_with" = T;
/* 5010: disable location bar suggestion types
 * [SETTING] Search>Address Bar>When using the address bar, suggest ***/
   # "browser.urlbar.suggest.history" = F;
   # "browser.urlbar.suggest.bookmark" = F;
   # "browser.urlbar.suggest.openpage" = F;
   # "browser.urlbar.suggest.topsites" = F;
/* 5011: disable location bar dropdown
 * This value controls the total number of entries to appear in the location bar dropdown ***/
   # "browser.urlbar.maxRichResults" = 0;
/* 5012: disable location bar autofill
 * [1] https:#support.mozilla.org/kb/address-bar-autocomplete-firefox#w_url-autocomplete ***/
   # "browser.urlbar.autoFill" = F;
/* 5013: disable browsing and download history
 * [NOTE] We also clear history and downloads on exit (2811)
 * [SETTING] Privacy & Security>History>Custom Settings>Remember browsing and download history ***/
   # "places.history.enabled" = F;
/* 5014: disable Windows jumplist [WINDOWS] ***/
   # "browser.taskbar.lists.enabled" = F;
   # "browser.taskbar.lists.frequent.enabled" = F;
   # "browser.taskbar.lists.recent.enabled" = F;
   # "browser.taskbar.lists.tasks.enabled" = F;
/* 5016: discourage downloading to desktop
 * 0=desktop, 1=downloads (default), 2=custom
 * [SETTING] To set your custom default "downloads": General>Downloads>Save files to ***/
   # "browser.download.folderList" = 2;
/* 5017: disable Form Autofill
 * If .supportedCountries includes your region (browser.search.region) and .supported
 * is "detect" (default), then the UI will show. Stored data is not secure, uses JSON
 * [SETTING] Privacy & Security>Forms and Autofill>Autofill addresses
 * [1] https:#wiki.mozilla.org/Firefox/Features/Form_Autofill ***/
   # "extensions.formautofill.addresses.enabled" = F;
   # "extensions.formautofill.creditCards.enabled" = F;
/* 5018: limit events that can cause a pop-up ***/
   # "dom.popup_allowed_events" = "click dblclick mousedown pointerdown";
/* 5019: disable page thumbnail collection ***/
   # "browser.pagethumbnails.capturing_disabled" = T;
/* 5020: disable Windows native notifications and use app notications instead [FF111+] [WINDOWS] ***/
   # "alerts.useSystemBackend.windows.notificationserver.enabled" = F;
/* 5021: disable location bar using search
 * Don't leak URL typos to a search engine, give an error message instead
 * Examples: "secretplace,com", "secretplace/com", "secretplace com", "secret place.com"
 * [NOTE] This does not affect explicit user action such as using search buttons in the
 * dropdown, or using keyword search shortcuts you configure in options (e.g. "d" for DuckDuckGo) ***/
   # "keyword.enabled" = F;

/*** [SECTION 5500]: OPTIONAL HARDENING
   Not recommended. Overriding these can cause breakage and performance issues,
   they are mostly fingerprintable, and the threat model is practically nonexistent
***/
/* 5501: disable MathML (Mathematical Markup Language) [FF51+]
 * [1] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=mathml ***/
   # "mathml.disabled" = T;
/* 5502: disable in-content SVG (Scalable Vector Graphics) [FF53+]
 * [1] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=firefox+svg ***/
   # "svg.disabled" = T;
/* 5503: disable graphite
 * [1] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=firefox+graphite
 * [2] https:#en.wikipedia.org/wiki/Graphite_(SIL) ***/
   # "gfx.font_rendering.graphite.enabled" = F;
/* 5504: disable asm.js [FF22+]
 * [1] http:#asmjs.org/
 * [2] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=asm.js
 * [3] https:#rh0dev.github.io/blog/2017/the-return-of-the-jit/ ***/
   # "javascript.options.asmjs" = F;
/* 5505: disable Ion and baseline JIT to harden against JS exploits [RESTART]
 * [NOTE] When both Ion and JIT are disabled, and trustedprincipals
 * is enabled, then Ion can still be used by extensions (1599226)
 * [1] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=firefox+jit
 * [2] https:#microsoftedge.github.io/edgevr/posts/Super-Duper-Secure-Mode/ ***/
   # "javascript.options.ion" = F;
   # "javascript.options.baselinejit" = F;
   # "javascript.options.jit_trustedprincipals" = T;
/* 5506: disable WebAssembly [FF52+]
 * Vulnerabilities [1] have increasingly been found, including those known and fixed
 * in native programs years ago [2]. WASM has powerful low-level access, making
 * certain attacks (brute-force) and vulnerabilities more possible
 * [STATS] ~0.2% of websites, about half of which are for cryptomining / malvertising [2][3]
 * [1] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=wasm
 * [2] https:#spectrum.ieee.org/tech-talk/telecom/security/more-worries-over-the-security-of-web-assembly
 * [3] https:#www.zdnet.com/article/half-of-the-websites-using-webassembly-use-it-for-malicious-purposes ***/
   # "javascript.options.wasm" = F;
/* 5507: disable rendering of SVG OpenType fonts ***/
   # "gfx.font_rendering.opentype_svg.enabled" = F;
/* 5508: disable all DRM content (EME: Encryption Media Extension)
 * Optionally hide the UI setting which also disables the DRM prompt
 * [SETTING] General>DRM Content>Play DRM-controlled content
 * [TEST] https:#bitmovin.com/demos/drm
 * [1] https:#www.eff.org/deeplinks/2017/10/drms-dead-canary-how-we-just-lost-web-what-we-learned-it-and-what-we-need-do-next ***/
   # "media.eme.enabled" = F;
   # "browser.eme.ui.enabled" = F;
/* 5509: disable IPv6 if using a VPN
 * This is an application level fallback. Disabling IPv6 is best done at an OS/network
 * level, and/or configured properly in system wide VPN setups.
 * [NOTE] PHP defaults to IPv6 with "localhost". Use "php -S 127.0.0.1:PORT"
 * [SETUP-WEB] PR_CONNECT_RESET_ERROR
 * [TEST] https:#ipleak.org/
 * [1] https:#www.internetsociety.org/tag/ipv6-security/ (Myths 2,4,5,6) ***/
   # "network.dns.disableIPv6" = T;
/* 5510: control when to send a cross-origin referer
 * 0=always (default), 1=only if base domains match, 2=only if hosts match
 * [NOTE] Will cause breakage: older modems/routers and some sites e.g banks, vimeo, icloud, instagram ***/
   # "network.http.referer.XOriginPolicy" = 2;
/* 5511: set DoH bootstrap address [FF89+]
 * Firefox uses the system DNS to initially resolve the IP address of your DoH server.
 * When set to a valid, working value that matches your "network.trr.uri" (0712) Firefox
 * won't use the system DNS. If the IP doesn't match then DoH won't work ***/
   # "network.trr.bootstrapAddr" = "10.0.0.1";

# [SECTION 6000]: DON'T TOUCH
/* 6001: enforce Firefox blocklist
 * [WHY] It includes updates for "revoked certificates"
 * [1] https:#blog.mozilla.org/security/2015/03/03/revoking-intermediate-certificates-introducing-onecrl/ ***/
"extensions.blocklist.enabled" = T;
/* 6002: enforce no referer spoofing
 * [WHY] Spoofing can affect CSRF (Cross-Site Request Forgery) protections ***/
"network.http.referer.spoofSource" = F;
/* 6004: enforce a security delay on some confirmation dialogs such as install, open/save
 * [1] https:#www.squarefree.com/2004/07/01/race-conditions-in-security-dialogs/ ***/
"security.dialog_enable_delay" = 1000;
/* 6008: enforce no First Party Isolation [FF51+]
 * [WARNING] Replaced with network partitioning (FF85+) and TCP (2701), and enabling FPI
 * disables those. FPI is no longer maintained except at Tor Project for Tor Browser's config ***/
"privacy.firstparty.isolate" = F;
/* 6009: enforce SmartBlock shims (about:compat) [FF81+]
 * [1] https:#blog.mozilla.org/security/2021/03/23/introducing-smartblock/ ***/
"extensions.webcompat.enable_shims" = T;
/* 6010: enforce no TLS 1.0/1.1 downgrades
 * [TEST] https:#tls-v1-1.badssl.com:1010/ ***/
"security.tls.version.enable-deprecated" = F;
/* 6011: enforce disabling of Web Compatibility Reporter [FF56+]
 * Web Compatibility Reporter adds a "Report Site Issue" button to send data to Mozilla
 * [WHY] To prevent wasting Mozilla's time with a custom setup ***/
"extensions.webcompat-reporter.enabled" = F;
/* 6012: enforce Quarantined Domains [FF115+]
 * [WHY] https:#support.mozilla.org/kb/quarantined-domains */
"extensions.quarantinedDomains.enabled" = T;
/* 6050: prefsCleaner: previously active items removed from arkenfox 115-127 ***/
   # "accessibility.force_disabled" = E;
   # "browser.urlbar.dnsResolveSingleWordsAfterSearch" = E;
   # "geo.provider.network.url" = E;
   # "geo.provider.network.logging.enabled" = E;
   # "geo.provider.use_gpsd" = E;
   # "network.protocol-handler.external.ms-windows-store" = E;
   # "privacy.partition.always_partition_third_party_non_cookie_storage" = E;
   # "privacy.partition.always_partition_third_party_non_cookie_storage.exempt_sessionstorage" = E;
   # "privacy.partition.serviceWorkers" = E;

# [SECTION 7000]: DON'T BOTHER
/* 7001: disable APIs
 * Location-Aware Browsing, Full Screen
 * [WHY] The API state is easily fingerprintable.
 * Geo is behind a prompt (7002). Full screen requires user interaction ***/
   # "geo.enabled" = F;
   # "full-screen-api.enabled" = F;
/* 7002: set default permissions
 * Location, Camera, Microphone, Notifications [FF58+] Virtual Reality [FF73+]
 * 0=always ask (default), 1=allow, 2=block
 * [WHY] These are fingerprintable via Permissions API, except VR. Just add site
 * exceptions as allow/block for frequently visited/annoying sites: i.e. not global
 * [SETTING] to add site exceptions: Ctrl+I>Permissions>
 * [SETTING] to manage site exceptions: Options>Privacy & Security>Permissions>Settings ***/
   # "permissions.default.geo" = 0;
   # "permissions.default.camera" = 0;
   # "permissions.default.microphone" = 0;
   # "permissions.default.desktop-notification" = 0;
   # "permissions.default.xr" = 0;
/* 7003: disable non-modern cipher suites [1]
 * [WHY] Passive fingerprinting. Minimal/non-existent threat of downgrade attacks
 * [1] https:#browserleaks.com/ssl ***/
   # "security.ssl3.ecdhe_ecdsa_aes_128_sha" = F;
   # "security.ssl3.ecdhe_ecdsa_aes_256_sha" = F;
   # "security.ssl3.ecdhe_rsa_aes_128_sha" = F;
   # "security.ssl3.ecdhe_rsa_aes_256_sha" = F;
   # "security.ssl3.rsa_aes_128_gcm_sha256" = F;
   # "security.ssl3.rsa_aes_256_gcm_sha384" = F;
   # "security.ssl3.rsa_aes_128_sha" = F;
   # "security.ssl3.rsa_aes_256_sha" = F;
/* 7004: control TLS versions
 * [WHY] Passive fingerprinting and security ***/
   # "security.tls.version.min" = 3;
   # "security.tls.version.max" = 4;
/* 7005: disable SSL session IDs [FF36+]
 * [WHY] Passive fingerprinting and perf costs. These are session-only
 * and isolated with network partitioning (FF85+) and/or containers ***/
   # "security.ssl.disable_session_identifiers" = T;
/* 7006: onions
 * [WHY] Firefox doesn't support hidden services. Use Tor Browser ***/
   # "dom.securecontext.allowlist_onions" = T;
   # "network.http.referer.hideOnionSource" = T;
/* 7007: referers
 * [WHY] Only cross-origin referers (1602, 5510) matter ***/
   # "network.http.sendRefererHeader" = 2;
   # "network.http.referer.trimmingPolicy" = 0;
/* 7008: set the default Referrer Policy [FF59+]
 * 0=no-referer, 1=same-origin, 2=strict-origin-when-cross-origin, 3=no-referrer-when-downgrade
 * [WHY] Defaults are fine. They can be overridden by a site-controlled Referrer Policy ***/
   # "network.http.referer.defaultPolicy" = 2;
   # "network.http.referer.defaultPolicy.pbmode" = 2;
/* 7010: disable HTTP Alternative Services [FF37+]
 * [WHY] Already isolated with network partitioning (FF85+) ***/
   # "network.http.altsvc.enabled" = F;
/* 7011: disable website control over browser right-click context menu
 * [WHY] Just use Shift-Right-Click ***/
   # "dom.event.contextmenu.enabled" = F;
/* 7012: disable icon fonts (glyphs) and local fallback rendering
 * [WHY] Breakage, font fallback is equivalency, also RFP
 * [1] https:#bugzilla.mozilla.org/789788
 * [2] https:#gitlab.torproject.org/legacy/trac/-/issues/8455 ***/
   # "gfx.downloadable_fonts.enabled" = F;
   # "gfx.downloadable_fonts.fallback_delay" = -1;
/* 7013: disable Clipboard API
 * [WHY] Fingerprintable. Breakage. Cut/copy/paste require user
 * interaction, and paste is limited to focused editable fields ***/
   # "dom.event.clipboardevents.enabled" = F;
/* 7014: disable System Add-on updates
 * [WHY] It can compromise security. System addons ship with prefs, use those ***/
   # "extensions.systemAddon.update.enabled" = F;
   # "extensions.systemAddon.update.url" = E;
/* 7015: enable the DNT (Do Not Track) HTTP header
 * [WHY] DNT is enforced with Tracking Protection which is used in ETP Strict (2701) ***/
   # "privacy.donottrackheader.enabled" = T;
/* 7016: customize ETP settings
 * [NOTE] FPP (fingerprintingProtection) is ignored when RFP (4501) is enabled
 * [WHY] Arkenfox only supports strict (2701) which sets these at runtime ***/
   # "network.cookie.cookieBehavior" = 5;
   # "privacy.fingerprintingProtection" = T;
   # "network.http.referer.disallowCrossSiteRelaxingDefault" = T;
   # "network.http.referer.disallowCrossSiteRelaxingDefault.top_navigation" = T;
   # "privacy.partition.network_state.ocsp_cache" = T;
   # "privacy.query_stripping.enabled" = T;
   # "privacy.trackingprotection.enabled" = T;
   # "privacy.trackingprotection.socialtracking.enabled" = T;
   # "privacy.trackingprotection.cryptomining.enabled" = T;
   # "privacy.trackingprotection.fingerprinting.enabled" = T;
/* 7017: disable service workers
 * [WHY] Already isolated with TCP (2701) behind a pref (2710) ***/
   # "dom.serviceWorkers.enabled" = F;
/* 7018: disable Web Notifications [FF22+]
 * [WHY] Web Notifications are behind a prompt (7002)
 * [1] https:#blog.mozilla.org/en/products/firefox/block-notification-requests/ ***/
   # "dom.webnotifications.enabled" = F;
/* 7019: disable Push Notifications [FF44+]
 * [WHY] Website "push" requires subscription, and the API is required for CRLite (1224)
 * [NOTE] To remove all subscriptions, reset "dom.push.userAgentID"
 * [1] https:#support.mozilla.org/kb/push-notifications-firefox ***/
   # "dom.push.enabled" = F;
/* 7020: disable WebRTC (Web Real-Time Communication)
 * [WHY] Firefox desktop uses mDNS hostname obfuscation and the private IP is never exposed until
 * required in TRUSTED scenarios; i.e. after you grant device (microphone or camera) access
 * [TEST] https:#browserleaks.com/webrtc
 * [1] https:#groups.google.com/g/discuss-webrtc/c/6stQXi72BEU/m/2FwZd24UAQAJ
 * [2] https:#datatracker.ietf.org/doc/html/draft-ietf-mmusic-mdns-ice-candidates#section-3.1.1 ***/
   # "media.peerconnection.enabled" = F;
/* 7021: enable GPC (Global Privacy Control) in non-PB windows
 * [WHY] Passive and active fingerprinting. Mostly redundant with Tracking Protection
 * in ETP Strict (2701) and sanitizing on close (2800s) ***/
   # "privacy.globalprivacycontrol.enabled" = T;

/*** [SECTION 8000]: DON'T BOTHER: FINGERPRINTING
   [WHY] They are insufficient to help anti-fingerprinting and do more harm than good
   [WARNING] DO NOT USE with RFP. RFP already covers these and they can interfere
***/
/* 8001: prefsCleaner: reset items useless for anti-fingerprinting ***/
   # "browser.display.use_document_fonts" = E;
   # "browser.zoom.siteSpecific" = E;
   # "device.sensors.enabled" = E;
   # "dom.enable_performance" = E;
   # "dom.enable_resource_timing" = E;
   # "dom.gamepad.enabled" = E;
   # "dom.maxHardwareConcurrency" = E;
   # "dom.w3c_touch_events.enabled" = E;
   # "dom.webaudio.enabled" = E;
   # "font.system.whitelist" = E;
   # "general.appname.override" = E;
   # "general.appversion.override" = E;
   # "general.buildID.override" = E;
   # "general.oscpu.override" = E;
   # "general.platform.override" = E;
   # "general.useragent.override" = E;
   # "media.navigator.enabled" = E;
   # "media.ondevicechange.enabled" = E;
   # "media.video_stats.enabled" = E;
   # "media.webspeech.synth.enabled" = E;
   # "ui.use_standins_for_native_colors" = E;
   # "webgl.enable-debug-renderer-info" = E;

# [SECTION 9000]: NON-PROJECT RELATED
/* 9001: disable welcome notices ***/
"browser.startup.homepage_override.mstone" = "ignore";
/* 9002: disable General>Browsing>Recommend extensions/features as you browse [FF67+] ***/
"browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons" = F;
"browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features" = F;
/* 9004: disable search terms [FF110+]
 * [SETTING] Search>Search Bar>Use the address bar for search and navigation>Show search terms instead of URL... ***/
"browser.urlbar.showSearchTerms.enabled" = F;

# [SECTION 9999]: DEPRECATED / RENAMED
/* ESR115.x still uses all the following prefs
# [NOTE] replace the * with a slash in the line above to re-enable active ones
# FF116
# 4506: set RFP's font visibility level (1402) [FF94+]
   # [-] https:#bugzilla.mozilla.org/1838415
   # "layout.css.font-visibility.resistFingerprinting" = 1;
# FF117
# 1221: disable Windows Microsoft Family Safety cert [FF50+] [WINDOWS]
   # 0=disable detecting Family Safety mode and importing the root
   # 1=only attempt to detect Family Safety mode (don't import the root)
   # 2=detect Family Safety mode and import the root
   # [1] https:#gitlab.torproject.org/tpo/applications/tor-browser/-/issues/21686
   # [-] https:#bugzilla.mozilla.org/1844908
"security.family_safety.mode" = 0;
# 7018: disable service worker Web Notifications [FF44+]
   # [WHY] Web Notifications are behind a prompt (7002)
   # [1] https:#blog.mozilla.org/en/products/firefox/block-notification-requests/
   # [-] https:#bugzilla.mozilla.org/1842457
   # "dom.webnotifications.serviceworker.enabled" = F;
# FF118
# 1402: limit font visibility (Windows, Mac, some Linux) [FF94+]
   # Uses hardcoded lists with two parts: kBaseFonts + kLangPackFonts [1], bundled fonts are auto-allowed
   # In normal windows: uses the first applicable: RFP over TP over Standard
   # In Private Browsing windows: uses the most restrictive between normal and private
   # 1=only base system fonts, 2=also fonts from optional language packs, 3=also user-installed fonts
   # [1] https:#searchfox.org/mozilla-central/search?path=StandardFonts*.inc
   # [-] https:#bugzilla.mozilla.org/1847599
   # "layout.css.font-visibility.private" = 1;
   # "layout.css.font-visibility.standard" = 1;
   # "layout.css.font-visibility.trackingprotection" = 1;
# 2623: disable permissions delegation [FF73+]
   # Currently applies to cross-origin geolocation, camera, mic and screen-sharing
   # permissions, and fullscreen requests. Disabling delegation means any prompts
   # for these will show/use their correct 3rd party origin
   # [1] https:#groups.google.com/forum/#!topic/mozilla.dev.platform/BdFOMAuCGW8/discussion
   # [-] https:#bugzilla.mozilla.org/1697151
   # "permissions.delegation.enabled" = F;
# FF119
# 0211: use en-US locale regardless of the system or region locale
   # [SETUP-WEB] May break some input methods e.g xim/ibus for CJK languages [1]
   # [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=867501,1629630
   # [-] https:#bugzilla.mozilla.org/1846224
   # "javascript.use_us_english_locale" = T;
# 0711: disable skipping DoH when parental controls are enabled [FF70+]
   # [-] https:#bugzilla.mozilla.org/1586941
"network.dns.skipTRR-when-parental-control-enabled" = F;
# FF123
# 0334: disable PingCentre telemetry (used in several System Add-ons) [FF57+]
   # Defense-in-depth: currently covered by 0331
   # [-] https:#bugzilla.mozilla.org/1868988
"browser.ping-centre.telemetry" = F;
# FF126
# 9003: disable What's New toolbar icon [FF69+]
   # [-] https:#bugzilla.mozilla.org/1724300
"browser.messaging-system.whatsNewPanel.enabled" = F;
# FF127
  # 2630: disable content analysis by DLP (Data Loss Prevention) agents - replaced by default_result
  # [-] https:#bugzilla.mozilla.org/1880314
"browser.contentanalysis.default_allow" = F;
# 4511: enforce non-native widget theme
   # Security: removes/reduces system API calls, e.g. win32k API [1]
   # Fingerprinting: provides a uniform look and feel across platforms [2]
   # [1] https:#bugzilla.mozilla.org/1381938
   # [2] https:#bugzilla.mozilla.org/1411425
   # [-] https:#bugzilla.mozilla.org/1848899
"widget.non-native-theme.enabled" = T;
# ***/
        };
      };
      SearchSuggestEnabled = false; # Enable or disable search suggestions.
      ShowHomeButton = false; # Show the home button on the toolbar.
      StartDownloadsInTempDirectory = true; # Force downloads to start off in a local, temporary location rather than the default download directory.
      WindowsSSO = false; # Allow Windows single sign-on for Microsoft, work, and school accounts.
    };
    profiles.bevicted = {
      id = 0;
      isDefault = true;
    };
  };
}
