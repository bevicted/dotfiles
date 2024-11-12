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
          # "browser.cache.memory.enable" = F;
          # "browser.cache.memory.capacity" = 0;
          "signon.rememberSignons" = F;
          "permissions.memory_only" = F;
          # "security.nocertdb" = T;
          # "browser.chrome.site_icons" = F;
          # "browser.sessionstore.max_tabs_undo" = 0;
          "browser.sessionstore.resume_from_crash" = T;
          "browser.download.forbid_open_with" = T;
          "browser.urlbar.suggest.history" = F;
          "browser.urlbar.suggest.bookmark" = T;
          "browser.urlbar.suggest.openpage" = T;
          "browser.urlbar.suggest.topsites" = F;
          "browser.urlbar.maxRichResults" = 5;
          # "browser.urlbar.autoFill" = F; # NOTE: unsure
          # "places.history.enabled" = F;
          "browser.taskbar.lists.enabled" = F;
          "browser.taskbar.lists.frequent.enabled" = F;
          "browser.taskbar.lists.recent.enabled" = F;
          "browser.taskbar.lists.tasks.enabled" = F;
          "browser.download.folderList" = 2;
          "extensions.formautofill.addresses.enabled" = F;
          "extensions.formautofill.creditCards.enabled" = F;
          "dom.popup_allowed_events" = "click dblclick mousedown pointerdown";
          "browser.pagethumbnails.capturing_disabled" = T; # TODO: decide
          "alerts.useSystemBackend.windows.notificationserver.enabled" = F;
          "keyword.enabled" = F;

          # [SECTION 6000]: DON'T TOUCH
          "extensions.blocklist.enabled" = T;
          "network.http.referer.spoofSource" = F;
          "security.dialog_enable_delay" = 1000;
          "privacy.firstparty.isolate" = F;
          "extensions.webcompat.enable_shims" = T;
          "security.tls.version.enable-deprecated" = F;
          "extensions.webcompat-reporter.enabled" = F;
          "extensions.quarantinedDomains.enabled" = T;

          # [SECTION 9000]: NON-PROJECT RELATED
          "browser.startup.homepage_override.mstone" = "ignore";
          "browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons" = F;
          "browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features" = F;
          "browser.urlbar.showSearchTerms.enabled" = F;
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
