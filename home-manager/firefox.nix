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
      AllowedDomainsForApps = ""; # Define domains allowed to access Google Workspace.
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
      DisableBuiltinPDFViewer = false; # Disable PDF.js, the built-in PDF viewer in Firefox.
      DisableDefaultBrowserAgent = true; # Prevent the default browser agent from taking any actions. Only applicable to Windows; other platforms don’t have the agent.
      DisableDeveloperTools = false; # Block access to the developer tools.
      DisableEncryptedClientHello = false; # Disable use of the TLS feature Encrypted Client Hello (ECH).
      DisableFeedbackCommands = true; # Disable commands to send feedback from the Help menu (Submit Feedback and Report Deceptive Site).
      DisableFirefoxAccounts = false; # Disable account-based services, including sync.
      DisableFirefoxScreenshots = true; # Disable the Firefox Screenshots feature.
      DisableFirefoxStudies = true; # Prevent Firefox from running studies.
      DisableForgetButton = false; # Prevent access to the Forget button.
      DisableFormHistory = false; # Don’t remember search and form history.
      DisableMasterPasswordCreation = true; # If true, a Primary Password can’t be created.
      DisablePasswordReveal = true; # Do not allow passwords to be revealed in saved logins.
      DisablePocket = true; # Disable the feature to save webpages to Pocket.
      DisablePrivateBrowsing = false; # Disable Private Browsing.
      DisableProfileImport = true; # Disable the menu command to Import data from another browser.
      DisableProfileRefresh = false; # Disable the Refresh Firefox button in the about:support page.
      # Disable the feature to restart in Safe Mode. Note: the Shift key to enter Safe Mode can only be disabled on Windows using Group Policy.
      DisableSafeMode = {
        InvalidCertificate = false;
        SafeBrowsing = true;
      };
      DisableSecurityBypass = false; # Prevent the user from bypassing certain security warnings.
      DisableSetDesktopBackground = true; # Disable the menu command Set as Desktop Background for images.
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
        ImproveSuggest = true;
      };
      HardwareAcceleration = false; # If false, turn off hardware acceleration. NOTE: sites track you through hardware specs
      # Set and optionally lock the homepage.
      Homepage = {
        StartPage = "previous-session";
      };
      HttpsOnlyMode = true; # Allow HTTPS-Only Mode to be enabled.
      # Allow certain websites to install add-ons.
      InstallAddonsPermission = {
        Default = false;
      };
      ManualAppUpdateOnly = true; # Allow manual updates only and do not notify the user about updates.
      NewTabPage = false; # Enable or disable the New Tab page.
      NoDefaultBookmarks = true; # Disable creation of the default bookmarks bundled with Firefox, and the Smart Bookmarks (Most Visited, Recent Tags). Note: this policy is only effective if used before the first run of the profile.
      OfferToSaveLogins = false; # Enforce the setting to allow Firefox to offer to remember saved logins and passwords. Both true and false values are accepted.
      OfferToSaveLoginsDefault = false; # Set the default value for allowing Firefox to offer to remember saved logins and passwords. Both true and false values are accepted.
      OverrideFirstRunPage = ""; # Override the first run page. Set this policy to blank if you want to disable the first run page.
      OverridePostUpdatePage = ""; # Override the post-update “What’s New” page. Set this policy to blank if you want to disable the post-update page.
      PasswordManagerEnabled = false; # Enable saving passwords to the password manager.
      # Disable or configure PDF.js, the built-in PDF viewer in Firefox.
      PDFjs = {
        Enabled = true;
        EnablePermissions = false;
      }; 
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
      PostQuantumKeyAgreementEnabled = false; # Enable post-quantum key agreement for TLS.
      PrimaryPassword = false; # Require or prevent using a Primary Password.
      PrintingEnabled = false; # Enable or disable printing.
      PrivateBrowsingModeAvailability = 0; # Set availability of private browsing mode.
      PromptForDownloadLocation = false; # Ask where to save files when downloading.
      SearchBar = "unified"; # Set the default location of the search bar. The user is still allowed to customize it.
      SanitizeOnShutdown = {
        Cache = true;
        Cookies = false;
        Downloads = true;
        FormData = true;
        History = false;
        Sessions = false;
        SiteSettings = false;
        OfflineApps = true;
        Locked = true;
      };
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
          "toolkit.telemetry.server" = "data:,";
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

          ## STUDIES
          "app.shield.optoutstudies.enabled" = F;
          "app.normandy.enabled" = F;
          "app.normandy.api_url" = E;

          ## CRASH REPORTS
          "breakpad.reportURL" = E;
          "browser.tabs.crashReporting.sendReport" = F;
          "browser.crashReports.unsubmittedCheck.enabled" = F;
          "browser.crashReports.unsubmittedCheck.autoSubmit2" = F;

            /** OTHER ***/
            /* 0360: disable Captive Portal detection
* [1] https:#www.eff.org/deeplinks/2017/08/how-captive-portals-interfere-wireless-security-and-privacy ***/
            "captivedetect.canonicalURL" = E;
              "network.captive-portal-service.enabled" = F; # [FF52+]
            /* 0361: disable Network Connectivity checks [FF65+]
* [1] https:#bugzilla.mozilla.org/1460537 ***/
            "network.connectivity-service.enabled" = F;

            /*** [SECTION 0400]: SAFE BROWSING (SB)
SB has taken many steps to preserve privacy. If required, a full url is never sent
to Google, only a part-hash of the prefix, hidden with noise of other real part-hashes.
Firefox takes measures such as stripping out identifying parameters and since SBv4 (FF57+)
doesn't even use cookies. (#Turn on browser.safebrowsing.debug to monitor this activity)

[1] https:#feeding.cloud.geek.nz/posts/how-safe-browsing-works-in-firefox/
[2] https:#wiki.mozilla.org/Security/Safe_Browsing
[3] https:#support.mozilla.org/kb/how-does-phishing-and-malware-protection-work
[4] https:#educatedguesswork.org/posts/safe-browsing-privacy/
***/
              /* 0401: disable SB (Safe Browsing)
* [WARNING] Do this at your own risk! These are the master switches
* [SETTING] Privacy & Security>Security>... Block dangerous and deceptive content ***/
              # "browser.safebrowsing.malware.enabled" = F;
              # "browser.safebrowsing.phishing.enabled" = F;
              /* 0402: disable SB checks for downloads (both local lookups + remote)
* This is the master switch for the safebrowsing.downloads* prefs (0403, 0404)
* [SETTING] Privacy & Security>Security>... "Block dangerous downloads" ***/
              # "browser.safebrowsing.downloads.enabled" = F;
            /* 0403: disable SB checks for downloads (remote)
* To verify the safety of certain executable files, Firefox may submit some information about the
* file, including the name, origin, size and a cryptographic hash of the contents, to the Google
* Safe Browsing service which helps Firefox determine whether or not the file should be blocked
* [SETUP-SECURITY] If you do not understand this, or you want this protection, then override this ***/
            "browser.safebrowsing.downloads.remote.enabled" = F;
              # "browser.safebrowsing.downloads.remote.url" = E; # Defense-in-depth
              /* 0404: disable SB checks for unwanted software
* [SETTING] Privacy & Security>Security>... "Warn you about unwanted and uncommon software" ***/
              # "browser.safebrowsing.downloads.remote.block_potentially_unwanted" = F;
              # "browser.safebrowsing.downloads.remote.block_uncommon" = F;
              /* 0405: disable "ignore this warning" on SB warnings [FF45+]
* If clicked, it bypasses the block for that session. This is a means for admins to enforce SB
* [TEST] see https:#github.com/arkenfox/user.js/wiki/Appendix-A-Test-Sites#-mozilla
* [1] https:#bugzilla.mozilla.org/1226490 ***/
              # "browser.safebrowsing.allowOverride" = F;

            # [SECTION 0600]: BLOCK IMPLICIT OUTBOUND [not explicitly asked for - e.g. clicked on]
            /* 0601: disable link prefetching
* [1] https:#developer.mozilla.org/docs/Web/HTTP/Link_prefetching_FAQ ***/
            "network.prefetch-next" = F;
            /* 0602: disable DNS prefetching
* [1] https:#developer.mozilla.org/docs/Web/HTTP/Headers/X-DNS-Prefetch-Control ***/
            "network.dns.disablePrefetch" = T;
              "network.dns.disablePrefetchFromHTTPS" = T;
            /* 0603: disable predictor / prefetching ***/
            "network.predictor.enabled" = F;
              "network.predictor.enable-prefetch" = F; # [FF48+] [DEFAULT: false]
            /* 0604: disable link-mouseover opening connection to linked server
* [1] https:#news.slashdot.org/story/15/08/14/2321202/how-to-quash-firefoxs-silent-requests ***/
            "network.http.speculative-parallel-limit" = 0;
            /* 0605: disable mousedown speculative connections on bookmarks and history [FF98+] ***/
"browser.places.speculativeConnect.enabled" = F;
              /* 0610: enforce no "Hyperlink Auditing" (click tracking)
* [1] https:#www.bleepingcomputer.com/news/software/major-browsers-to-prevent-disabling-of-click-tracking-privacy-risk/ ***/
# "browser.send_pings" = F; # [DEFAULT: false]

            # [SECTION 0700]: DNS / DoH / PROXY / SOCKS
            /* 0702: set the proxy server to do any DNS lookups when using SOCKS
* e.g. in Tor, this stops your local DNS server from knowing your Tor destination
* as a remote Tor node will handle the DNS request
* [1] https:#trac.torproject.org/projects/tor/wiki/doc/TorifyHOWTO/WebBrowsers ***/
            "network.proxy.socks_remote_dns" = T;
            /* 0703: disable using UNC (Uniform Naming Convention) paths [FF61+]
* [SETUP-CHROME] Can break extensions for profiles on network shares
* [1] https:#bugzilla.mozilla.org/1413868 ***/
            "network.file.disable_unc_paths" = T; # [HIDDEN PREF]
            /* 0704: disable GIO as a potential proxy bypass vector
* Gvfs/GIO has a set of supported protocols like obex, network, archive, computer,
* dav, cdda, gphoto2, trash, etc. From FF87-117, by default only sftp was accepted
* [1] https:#bugzilla.mozilla.org/1433507
* [2] https:#en.wikipedia.org/wiki/GVfs
* [3] https:#en.wikipedia.org/wiki/GIO_(software) ***/
            "network.gio.supported-protocols" = E; # [HIDDEN PREF] [DEFAULT: "" FF118+]
            /* 0705: disable proxy direct failover for system requests [FF91+]
* [WARNING] Default true is a security feature against malicious extensions [1]
* [SETUP-CHROME] If you use a proxy and you trust your extensions
* [1] https:#blog.mozilla.org/security/2021/10/25/securing-the-proxy-api-for-firefox-add-ons/ ***/
            # "network.proxy.failover_direct" = F;
/* 0706: disable proxy bypass for system request failures [FF95+]
* RemoteSettings, UpdateService, Telemetry [1]
* [WARNING] If false, this will break the fallback for some security features
* [SETUP-CHROME] If you use a proxy and you understand the security impact
* [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=1732792,1733994,1733481 ***/
# "network.proxy.allow_bypass" = F;
        /* 0710: enable DNS-over-HTTPS (DoH) [FF60+]
* 0=default, 2=increased (TRR (Trusted Recursive Resolver) first), 3=max (TRR only), 5=off (no rollout)
 * see "doh-rollout.home-region": USA 2019, Canada 2021, Russia/Ukraine 2022 [3]
 * [SETTING] Privacy & Security>DNS over HTTPS
 * [1] https:#hacks.mozilla.org/2018/05/a-cartoon-intro-to-dns-over-https/
 * [2] https:#wiki.mozilla.org/Security/DOH-resolver-policy
 * [3] https:#support.mozilla.org/kb/firefox-dns-over-https
 * [4] https:#www.eff.org/deeplinks/2020/12/dns-doh-and-odoh-oh-my-year-review-2020 ***/
   # "network.trr.mode" = 3;
/* 0712: set DoH provider
 * The custom uri is the value shown when you "Choose provider>Custom>"
 * [NOTE] If you USE custom then "network.trr.uri" should be set the same
 * [SETTING] Privacy & Security>DNS over HTTPS>Increased/Max>Choose provider ***/
   # "network.trr.uri" = "https:#example.dns";
   # "network.trr.custom_uri" = "https:#example.dns";

# [SECTION 0800]: LOCATION BAR / SEARCH BAR / SUGGESTIONS / HISTORY / FORMS
/* 0801: disable location bar making speculative connections [FF56+]
 * [1] https:#bugzilla.mozilla.org/1348275 ***/
"browser.urlbar.speculativeConnect.enabled" = F;
/* 0802: disable location bar contextual suggestions
 * [NOTE] The UI is controlled by the .enabled pref
 * [SETTING] Search>Address Bar>Suggestions from...
 * [1] https:#blog.mozilla.org/data/2021/09/15/data-and-firefox-suggest/ ***/
"browser.urlbar.quicksuggest.enabled" = F; # [FF92+]
"browser.urlbar.suggest.quicksuggest.nonsponsored" = F; # [FF95+]
"browser.urlbar.suggest.quicksuggest.sponsored" = F; # [FF92+]
/* 0803: disable live search suggestions
 * [NOTE] Both must be true for live search to work in the location bar
 * [SETUP-CHROME] Override these if you trust and use a privacy respecting search engine
 * [SETTING] Search>Show search suggestions | Show search suggestions in address bar results ***/
"browser.search.suggest.enabled" = F;
"browser.urlbar.suggest.searches" = F;
/* 0805: disable urlbar trending search suggestions [FF118+]
 * [SETTING] Search>Search Suggestions>Show trending search suggestions (FF119) ***/
"browser.urlbar.trending.featureGate" = F;
/* 0806: disable urlbar suggestions ***/
"browser.urlbar.addons.featureGate" = F; # [FF115+]
"browser.urlbar.mdn.featureGate" = F; # [FF117+] [HIDDEN PREF]
"browser.urlbar.pocket.featureGate" = F; # [FF116+] [DEFAULT: false]
"browser.urlbar.weather.featureGate" = F; # [FF108+] [DEFAULT: false]
"browser.urlbar.yelp.featureGate" = F; # [FF124+] [DEFAULT: false]
/* 0807: disable urlbar clipboard suggestions [FF118+] ***/
   # "browser.urlbar.clipboard.featureGate" = F;
/* 0808: disable recent searches [FF120+]
 * [NOTE] Recent searches are cleared with history (2811)
 * [1] https:#support.mozilla.org/kb/search-suggestions-firefox ***/
   # "browser.urlbar.recentsearches.featureGate" = F;
/* 0810: disable search and form history
 * [NOTE] We also clear formdata on exit (2811)
 * [SETUP-WEB] Be aware that autocomplete form data can be read by third parties [1][2]
 * [SETTING] Privacy & Security>History>Custom Settings>Remember search and form history
 * [1] https:#blog.mindedsecurity.com/2011/10/autocompleteagain.html
 * [2] https:#bugzilla.mozilla.org/381681 ***/
"browser.formfill.enable" = F;
/* 0815: disable tab-to-search [FF85+]
 * Alternatively, you can exclude on a per-engine basis by unchecking them in Options>Search
 * [SETTING] Search>Address Bar>When using the address bar, suggest>Search engines ***/
   # "browser.urlbar.suggest.engines" = F;
/* 0820: disable coloring of visited links
 * [SETUP-HARDEN] Bulk rapid history sniffing was mitigated in 2010 [1][2]. Slower and more expensive
 * redraw timing attacks were largely mitigated in FF77+ [3]. Using RFP (4501) further hampers timing
 * attacks. Don't forget clearing history on exit (2811). However, social engineering [2#limits][4][5]
 * and advanced targeted timing attacks could still produce usable results
 * [1] https:#developer.mozilla.org/docs/Web/CSS/Privacy_and_the_:visited_selector
 * [2] https:#dbaron.org/mozilla/visited-privacy
 * [3] https:#bugzilla.mozilla.org/1632765
 * [4] https:#earthlng.github.io/testpages/visited_links.html (see github wiki APPENDIX A on how to use)
 * [5] https:#lcamtuf.blogspot.com/2016/08/css-mix-blend-mode-is-bad-for-keeping.html ***/
   # "layout.css.visited_links_enabled" = F;
/* 0830: enable separate default search engine in Private Windows and its UI setting
 * [SETTING] Search>Default Search Engine>Choose a different default search engine for Private Windows only ***/
"browser.search.separatePrivateDefault" = T; # [FF70+]
"browser.search.separatePrivateDefault.ui.enabled" = T; # [FF71+]

/*** [SECTION 0900]: PASSWORDS
   [1] https:#support.mozilla.org/kb/use-primary-password-protect-stored-logins-and-pas
***/
/* 0903: disable auto-filling username & password form fields
 * can leak in cross-site forms *and* be spoofed
 * [NOTE] Username & password is still available when you enter the field
 * [SETTING] Privacy & Security>Logins and Passwords>Autofill logins and passwords
 * [1] https:#freedom-to-tinker.com/2017/12/27/no-boundaries-for-user-identities-web-trackers-exploit-browser-login-managers/
 * [2] https:#homes.esat.kuleuven.be/~asenol/leaky-forms/ ***/
"signon.autofillForms" = F;
/* 0904: disable formless login capture for Password Manager [FF51+] ***/
"signon.formlessCapture.enabled" = F;
/* 0905: limit (or disable) HTTP authentication credentials dialogs triggered by sub-resources [FF41+]
 * hardens against potential credentials phishing
 * 0 = don't allow sub-resources to open HTTP authentication credentials dialogs
 * 1 = don't allow cross-origin sub-resources to open HTTP authentication credentials dialogs
 * 2 = allow sub-resources to open HTTP authentication credentials dialogs (default) ***/
"network.auth.subresource-http-auth-allow" = 1;
/* 0906: enforce no automatic authentication on Microsoft sites [FF91+] [WINDOWS 10+]
 * [SETTING] Privacy & Security>Logins and Passwords>Allow Windows single sign-on for...
 * [1] https:#support.mozilla.org/kb/windows-sso ***/
   # "network.http.windows-sso.enabled" = F; # [DEFAULT: false]

# [SECTION 1000]: DISK AVOIDANCE
/* 1001: disable disk cache
 * [NOTE] We also clear cache on exit (2811)
 * [SETUP-CHROME] If you think disk cache helps perf, then feel free to override this ***/
"browser.cache.disk.enable" = F;
/* 1002: disable media cache from writing to disk in Private Browsing
 * [NOTE] MSE (Media Source Extensions) are already stored in-memory in PB ***/
"browser.privatebrowsing.forceMediaMemoryCache" = T; # [FF75+]
"media.memory_cache_max_size" = 65536;
/* 1003: disable storing extra session data [SETUP-CHROME]
 * define on which sites to save extra session data such as form content, cookies and POST data
 * 0=everywhere, 1=unencrypted sites, 2=nowhere ***/
"browser.sessionstore.privacy_level" = 2;
/* 1005: disable automatic Firefox start and session restore after reboot [FF62+] [WINDOWS]
 * [1] https:#bugzilla.mozilla.org/603903 ***/
"toolkit.winRegisterApplicationRestart" = F;
/* 1006: disable favicons in shortcuts [WINDOWS]
 * URL shortcuts use a cached randomly named .ico file which is stored in your
 * profile/shortcutCache directory. The .ico remains after the shortcut is deleted
 * If set to false then the shortcuts use a generic Firefox icon ***/
"browser.shell.shortcutFavicons" = F;

/*** [SECTION 1200]: HTTPS (SSL/TLS / OCSP / CERTS / HPKP)
   Your cipher and other settings can be used in server side fingerprinting
   [TEST] https:#www.ssllabs.com/ssltest/viewMyClient.html
   [TEST] https:#browserleaks.com/ssl
   [TEST] https:#ja3er.com/
   [1] https:#www.securityartwork.es/2017/02/02/tls-client-fingerprinting-with-bro/
***/
/** SSL (Secure Sockets Layer) / TLS (Transport Layer Security) ***/
/* 1201: require safe negotiation
 * Blocks connections to servers that don't support RFC 5746 [2] as they're potentially vulnerable to a
 * MiTM attack [3]. A server without RFC 5746 can be safe from the attack if it disables renegotiations
 * but the problem is that the browser can't know that. Setting this pref to true is the only way for the
 * browser to ensure there will be no unsafe renegotiations on the channel between the browser and the server
 * [SETUP-WEB] SSL_ERROR_UNSAFE_NEGOTIATION: is it worth overriding this for that one site?
 * [STATS] SSL Labs (May 2024) reports over 99.7% of top sites have secure renegotiation [4]
 * [1] https:#wiki.mozilla.org/Security:Renegotiation
 * [2] https:#datatracker.ietf.org/doc/html/rfc5746
 * [3] https:#cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2009-3555
 * [4] https:#www.ssllabs.com/ssl-pulse/ ***/
"security.ssl.require_safe_negotiation" = T;
/* 1206: disable TLS1.3 0-RTT (round-trip time) [FF51+]
 * This data is not forward secret, as it is encrypted solely under keys derived using
 * the offered PSK. There are no guarantees of non-replay between connections
 * [1] https:#github.com/tlswg/tls13-spec/issues/1001
 * [2] https:#www.rfc-editor.org/rfc/rfc9001.html#name-replay-attacks-with-0-rtt
 * [3] https:#blog.cloudflare.com/tls-1-3-overview-and-q-and-a/ ***/
"security.tls.enable_0rtt_data" = F;

/** OCSP (Online Certificate Status Protocol)
   [1] https:#scotthelme.co.uk/revocation-is-broken/
   [2] https:#blog.mozilla.org/security/2013/07/29/ocsp-stapling-in-firefox/
***/
/* 1211: enforce OCSP fetching to confirm current validity of certificates
 * 0=disabled, 1=enabled (default), 2=enabled for EV certificates only
 * OCSP (non-stapled) leaks information about the sites you visit to the CA (cert authority)
 * It's a trade-off between security (checking) and privacy (leaking info to the CA)
 * [NOTE] This pref only controls OCSP fetching and does not affect OCSP stapling
 * [SETTING] Privacy & Security>Security>Certificates>Query OCSP responder servers...
 * [1] https:#en.wikipedia.org/wiki/Ocsp ***/
"security.OCSP.enabled" = 1; # [DEFAULT: 1]
/* 1212: set OCSP fetch failures (non-stapled, see 1211) to hard-fail
 * [SETUP-WEB] SEC_ERROR_OCSP_SERVER_ERROR
 * When a CA cannot be reached to validate a cert, Firefox just continues the connection (=soft-fail)
 * Setting this pref to true tells Firefox to instead terminate the connection (=hard-fail)
 * It is pointless to soft-fail when an OCSP fetch fails: you cannot confirm a cert is still valid (it
 * could have been revoked) and/or you could be under attack (e.g. malicious blocking of OCSP servers)
 * [1] https:#blog.mozilla.org/security/2013/07/29/ocsp-stapling-in-firefox/
 * [2] https:#www.imperialviolet.org/2014/04/19/revchecking.html ***/
"security.OCSP.require" = T;

/** CERTS / HPKP (HTTP Public Key Pinning) ***/
/* 1223: enable strict PKP (Public Key Pinning)
 * 0=disabled, 1=allow user MiTM (default; such as your antivirus), 2=strict
 * [SETUP-WEB] MOZILLA_PKIX_ERROR_KEY_PINNING_FAILURE ***/
"security.cert_pinning.enforcement_level" = 2;
/* 1224: enable CRLite [FF73+]
 * 0 = disabled
 * 1 = consult CRLite but only collect telemetry
 * 2 = consult CRLite and enforce both "Revoked" and "Not Revoked" results
 * 3 = consult CRLite and enforce "Not Revoked" results, but defer to OCSP for "Revoked" (default)
 * [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=1429800,1670985,1753071
 * [2] https:#blog.mozilla.org/security/tag/crlite/ ***/
"security.remote_settings.crlite_filters.enabled" = T;
"security.pki.crlite_mode" = 2;

/** MIXED CONTENT ***/
/* 1241: disable insecure passive content (such as images) on https pages ***/
   # "security.mixed_content.block_display_content" = T; # Defense-in-depth (see 1244)
/* 1244: enable HTTPS-Only mode in all windows
 * When the top-level is HTTPS, insecure subresources are also upgraded (silent fail)
 * [SETTING] to add site exceptions: Padlock>HTTPS-Only mode>On (after "Continue to HTTP Site")
 * [SETTING] Privacy & Security>HTTPS-Only Mode (and manage exceptions)
 * [TEST] http:#example.com [upgrade]
 * [TEST] http:#httpforever.com/ | http:#http.rip [no upgrade] ***/
"dom.security.https_only_mode" = T; # [FF76+]
   # "dom.security.https_only_mode_pbm" = T; # [FF80+]
/* 1245: enable HTTPS-Only mode for local resources [FF77+] ***/
   # "dom.security.https_only_mode.upgrade_local" = T;
/* 1246: disable HTTP background requests [FF82+]
 * When attempting to upgrade, if the server doesn't respond within 3 seconds, Firefox sends
 * a top-level HTTP request without path in order to check if the server supports HTTPS or not
 * This is done to avoid waiting for a timeout which takes 90 seconds
 * [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=1642387,1660945 ***/
"dom.security.https_only_mode_send_http_background_request" = F;

/** UI (User Interface) ***/
/* 1270: display warning on the padlock for "broken security" (if 1201 is false)
 * Bug: warning padlock not indicated for subresources on a secure page! [2]
 * [1] https:#wiki.mozilla.org/Security:Renegotiation
 * [2] https:#bugzilla.mozilla.org/1353705 ***/
"security.ssl.treat_unsafe_negotiation_as_broken" = T;
/* 1272: display advanced information on Insecure Connection warning pages
 * only works when it's possible to add an exception
 * i.e. it doesn't work for HSTS discrepancies (https:#subdomain.preloaded-hsts.badssl.com/)
 * [TEST] https:#expired.badssl.com/ ***/
"browser.xul.error_pages.expert_bad_cert" = T;

/*** [SECTION 1600]: REFERERS
                  full URI: https:#example.com:8888/foo/bar.html?id=1234
     scheme+host+port+path: https:#example.com:8888/foo/bar.html
          scheme+host+port: https:#example.com:8888
   [1] https:#feeding.cloud.geek.nz/posts/tweaking-referrer-for-privacy-in-firefox/
***/
/* 1602: control the amount of cross-origin information to send [FF52+]
 * 0=send full URI (default), 1=scheme+host+port+path, 2=scheme+host+port ***/
"network.http.referer.XOriginTrimmingPolicy" = 2;

# [SECTION 1700]: CONTAINERS
/* 1701: enable Container Tabs and its UI setting [FF50+]
 * [SETTING] General>Tabs>Enable Container Tabs
 * https:#wiki.mozilla.org/Security/Contextual_Identity_Project/Containers ***/
"privacy.userContext.enabled" = T;
"privacy.userContext.ui.enabled" = T;
/* 1702: set behavior on "+ Tab" button to display container menu on left click [FF74+]
 * [NOTE] The menu is always shown on long press and right click
 * [SETTING] General>Tabs>Enable Container Tabs>Settings>Select a container for each new tab ***/
   # "privacy.userContext.newTabContainerOnLeftClick.enabled" = T;
/* 1703: set external links to open in site-specific containers [FF123+]
 * [SETUP-WEB] Depending on your container extension(s) and their settings
 * true=Firefox will not choose a container (so your extension can)
 * false=Firefox will choose the container/no-container (default)
 * [1] https:#bugzilla.mozilla.org/1874599 ***/
   # "browser.link.force_default_user_context_id_for_external_opens" = T;

# [SECTION 2000]: PLUGINS / MEDIA / WEBRTC
/* 2002: force WebRTC inside the proxy [FF70+] ***/
"media.peerconnection.ice.proxy_only_if_behind_proxy" = T;
/* 2003: force a single network interface for ICE candidates generation [FF42+]
 * When using a system-wide proxy, it uses the proxy interface
 * [1] https:#developer.mozilla.org/docs/Web/API/RTCIceCandidate
 * [2] https:#wiki.mozilla.org/Media/WebRTC/Privacy ***/
"media.peerconnection.ice.default_address_only" = T;
/* 2004: force exclusion of private IPs from ICE candidates [FF51+]
 * [SETUP-HARDEN] This will protect your private IP even in TRUSTED scenarios after you
 * grant device access, but often results in breakage on video-conferencing platforms ***/
   # "media.peerconnection.ice.no_host" = T;
/* 2020: disable GMP (Gecko Media Plugins)
 * [1] https:#wiki.mozilla.org/GeckoMediaPlugins ***/
   # "media.gmp-provider.enabled" = F;

# [SECTION 2400]: DOM (DOCUMENT OBJECT MODEL)
/* 2402: prevent scripts from moving and resizing open windows ***/
"dom.disable_window_move_resize" = T;

# [SECTION 2600]: MISCELLANEOUS
/* 2603: remove temp files opened from non-PB windows with an external application
 * [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=302433,1738574 ***/
"browser.download.start_downloads_in_tmp_dir" = T; # [FF102+]
"browser.helperApps.deleteTempFileOnExit" = T;
/* 2606: disable UITour backend so there is no chance that a remote page can use it ***/
"browser.uitour.enabled" = F;
   # "browser.uitour.url" = E; # Defense-in-depth
/* 2608: reset remote debugging to disabled
 * [1] https:#gitlab.torproject.org/tpo/applications/tor-browser/-/issues/16222 ***/
"devtools.debugger.remote-enabled" = F; # [DEFAULT: false]
/* 2615: disable websites overriding Firefox's keyboard shortcuts [FF58+]
 * 0 (default) or 1=allow, 2=block
 * [SETTING] to add site exceptions: Ctrl+I>Permissions>Override Keyboard Shortcuts ***/
   # "permissions.default.shortcuts" = 2;
/* 2616: remove special permissions for certain mozilla domains [FF35+]
 * [1] resource:#app/defaults/permissions ***/
"permissions.manager.defaultsUrl" = E;
/* 2617: remove webchannel whitelist ***/
"webchannel.allowObject.urlWhitelist" = E;
/* 2619: use Punycode in Internationalized Domain Names to eliminate possible spoofing
 * [SETUP-WEB] Might be undesirable for non-latin alphabet users since legitimate IDN's are also punycoded
 * [TEST] https:#www.xn--80ak6aa92e.com/ (www.apple.com)
 * [1] https:#wiki.mozilla.org/IDN_Display_Algorithm
 * [2] https:#en.wikipedia.org/wiki/IDN_homograph_attack
 * [3] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=punycode+firefox
 * [4] https:#www.xudongz.com/blog/2017/idn-phishing/ ***/
"network.IDN_show_punycode" = T;
/* 2620: enforce PDFJS, disable PDFJS scripting
 * This setting controls if the option "Display in Firefox" is available in the setting below
 *   and by effect controls whether PDFs are handled in-browser or externally ("Ask" or "Open With")
 * [WHY] pdfjs is lightweight, open source, and secure: the last exploit was June 2015 [1]
 *   It doesn't break "state separation" of browser content (by not sharing with OS, independent apps).
 *   It maintains disk avoidance and application data isolation. It's convenient. You can still save to disk.
 * [NOTE] JS can still force a pdf to open in-browser by bundling its own code
 * [SETUP-CHROME] You may prefer a different pdf reader for security/workflow reasons
 * [SETTING] General>Applications>Portable Document Format (PDF)
 * [1] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=pdf.js+firefox ***/
"pdfjs.disabled" = F; # [DEFAULT: false]
"pdfjs.enableScripting" = F; # [FF86+]
/* 2624: disable middle click on new tab button opening URLs or searches using clipboard [FF115+] */
"browser.tabs.searchclipboardfor.middleclick" = F; # [DEFAULT: false NON-LINUX]
/* 2630: disable content analysis by DLP (Data Loss Prevention) agents
 * DLP agents are background processes on managed computers that allow enterprises to monitor locally running
 * applications for data exfiltration events, which they can allow/block based on customer defined DLP policies.
 * 0=Block all requests, 1=Warn on all requests (which lets the user decide), 2=Allow all requests
 * [1] https:#github.com/chromium/content_analysis_sdk */
"browser.contentanalysis.enabled" = F; # [FF121+] [DEFAULT: false]
"browser.contentanalysis.default_result" = 0; # [FF127+] [DEFAULT: 0]

/** DOWNLOADS ***/
/* 2651: enable user interaction for security by always asking where to download
 * [SETUP-CHROME] On Android this blocks longtapping and saving images
 * [SETTING] General>Downloads>Always ask you where to save files ***/
"browser.download.useDownloadDir" = F;
/* 2652: disable downloads panel opening on every download [FF96+] ***/
"browser.download.alwaysOpenPanel" = F;
/* 2653: disable adding downloads to the system's "recent documents" list ***/
"browser.download.manager.addToRecentDocs" = F;
/* 2654: enable user interaction for security by always asking how to handle new mimetypes [FF101+]
 * [SETTING] General>Files and Applications>What should Firefox do with other files ***/
"browser.download.always_ask_before_handling_new_types" = T;

/** EXTENSIONS ***/
/* 2660: limit allowed extension directories
 * 1=profile, 2=user, 4=application, 8=system, 16=temporary, 31=all
 * The pref value represents the sum: e.g. 5 would be profile and application directories
 * [SETUP-CHROME] Breaks usage of files which are installed outside allowed directories
 * [1] https:#archive.is/DYjAM ***/
"extensions.enabledScopes" = 5; # [HIDDEN PREF]
   # "extensions.autoDisableScopes" = 15; # [DEFAULT: 15]
/* 2661: disable bypassing 3rd party extension install prompts [FF82+]
 * [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=1659530,1681331 ***/
"extensions.postDownloadThirdPartyPrompt" = F;
/* 2662: disable webextension restrictions on certain mozilla domains (you also need 4503) [FF60+]
 * [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=1384330,1406795,1415644,1453988 ***/
   # "extensions.webextensions.restrictedDomains" = E;

# [SECTION 2700]: ETP (ENHANCED TRACKING PROTECTION)
/* 2701: enable ETP Strict Mode [FF86+]
 * ETP Strict Mode enables Total Cookie Protection (TCP)
 * [NOTE] Adding site exceptions disables all ETP protections for that site and increases the risk of
 * cross-site state tracking e.g. exceptions for SiteA and SiteB means PartyC on both sites is shared
 * [1] https:#blog.mozilla.org/security/2021/02/23/total-cookie-protection/
 * [SETTING] to add site exceptions: Urlbar>ETP Shield
 * [SETTING] to manage site exceptions: Options>Privacy & Security>Enhanced Tracking Protection>Manage Exceptions ***/
"browser.contentblocking.category" = "strict"; # [HIDDEN PREF]
/* 2702: disable ETP web compat features [FF93+]
 * [SETUP-HARDEN] Includes skip lists, heuristics (SmartBlock) and automatic grants
 * Opener and redirect heuristics are granted for 30 days, see [3]
 * [1] https:#blog.mozilla.org/security/2021/07/13/smartblock-v2/
 * [2] https:#hg.mozilla.org/mozilla-central/rev/e5483fd469ab#l4.12
 * [3] https:#developer.mozilla.org/docs/Web/Privacy/State_Partitioning#storage_access_heuristics ***/
   # "privacy.antitracking.enableWebcompat" = F;

# [SECTION 2800]: SHUTDOWN & SANITIZING
/* 2810: enable Firefox to clear items on shutdown
 * [NOTE] In FF129+ clearing "siteSettings" on shutdown (2811), or manually via site data (2820) and
 * via history (2830), will no longer remove sanitize on shutdown "cookie and site data" site exceptions (2815) 
 * [SETTING] Privacy & Security>History>Custom Settings>Clear history when Firefox closes | Settings ***/
"privacy.sanitize.sanitizeOnShutdown" = T;

/** SANITIZE ON SHUTDOWN: IGNORES "ALLOW" SITE EXCEPTIONS | v2 migration is FF128+ ***/
/* 2811: set/enforce what items to clear on shutdown (if 2810 is true) [SETUP-CHROME]
 * [NOTE] If "history" is true, downloads will also be cleared ***/
"privacy.clearOnShutdown.cache" = T;     # [DEFAULT: true]
"privacy.clearOnShutdown_v2.cache" = T;  # [FF128+] [DEFAULT: true]
"privacy.clearOnShutdown.downloads" = T; # [DEFAULT: true]
"privacy.clearOnShutdown.formdata" = T;  # [DEFAULT: true]
"privacy.clearOnShutdown.history" = T;   # [DEFAULT: true]
"privacy.clearOnShutdown_v2.historyFormDataAndDownloads" = T; # [FF128+] [DEFAULT: true]
   # "privacy.clearOnShutdown.siteSettings" = F; # [DEFAULT: false]
   # "privacy.clearOnShutdown_v2.siteSettings" = F; # [FF128+] [DEFAULT: false]
/* 2812: set Session Restore to clear on shutdown (if 2810 is true) [FF34+]
 * [NOTE] Not needed if Session Restore is not used (0102) or it is already cleared with history (2811)
 * [NOTE] If true, this prevents resuming from crashes (also see 5008) ***/
   # "privacy.clearOnShutdown.openWindows" = T;

/** SANITIZE ON SHUTDOWN: RESPECTS "ALLOW" SITE EXCEPTIONS FF103+ | v2 migration is FF128+ ***/
/* 2815: set "Cookies" and "Site Data" to clear on shutdown (if 2810 is true) [SETUP-CHROME]
 * [NOTE] Exceptions: A "cookie" permission also controls "offlineApps" (see note below). For cross-domain logins,
 * add exceptions for both sites e.g. https:#www.youtube.com (site) + https:#accounts.google.com (single sign on)
 * [NOTE] "offlineApps": Offline Website Data: localStorage, service worker cache, QuotaManager (IndexedDB, asm-cache)
 * [NOTE] "sessions": Active Logins (has no site exceptions): refers to HTTP Basic Authentication [1], not logins via cookies
 * [WARNING] Be selective with what sites you "Allow", as they also disable partitioning (1767271)
 * [SETTING] to add site exceptions: Ctrl+I>Permissions>Cookies>Allow (when on the website in question)
 * [SETTING] to manage site exceptions: Options>Privacy & Security>Permissions>Settings
 * [1] https:#en.wikipedia.org/wiki/Basic_access_authentication ***/
"privacy.clearOnShutdown.cookies" = T; # Cookies
"privacy.clearOnShutdown.offlineApps" = T; # Site Data
"privacy.clearOnShutdown.sessions" = T;  # Active Logins [DEFAULT: true]
"privacy.clearOnShutdown_v2.cookiesAndStorage" = T; # Cookies, Site Data, Active Logins [FF128+]

/** SANITIZE SITE DATA: IGNORES "ALLOW" SITE EXCEPTIONS ***/
/* 2820: set manual "Clear Data" items [SETUP-CHROME] [FF128+]
 * Firefox remembers your last choices. This will reset them when you start Firefox
 * [SETTING] Privacy & Security>Browser Privacy>Cookies and Site Data>Clear Data ***/
"privacy.clearSiteData.cache" = T;
"privacy.clearSiteData.cookiesAndStorage" = F; # keep false until it respects "allow" site exceptions
"privacy.clearSiteData.historyFormDataAndDownloads" = T;
   # "privacy.clearSiteData.siteSettings" = F;

/** SANITIZE HISTORY: IGNORES "ALLOW" SITE EXCEPTIONS | clearHistory migration is FF128+ ***/
/* 2830: set manual "Clear History" items, also via Ctrl-Shift-Del [SETUP-CHROME]
 * Firefox remembers your last choices. This will reset them when you start Firefox
 * [NOTE] Regardless of what you set "downloads" to, as soon as the dialog
 * for "Clear Recent History" is opened, it is synced to the same as "history"
 * [SETTING] Privacy & Security>History>Custom Settings>Clear History ***/
"privacy.cpd.cache" = T;    # [DEFAULT: true]
"privacy.clearHistory.cache" = T;
"privacy.cpd.formdata" = T; # [DEFAULT: true]
"privacy.cpd.history" = T;  # [DEFAULT: true]
   # "privacy.cpd.downloads" = T; # not used, see note above
"privacy.clearHistory.historyFormDataAndDownloads" = T;
"privacy.cpd.cookies" = F;
"privacy.cpd.sessions" = T; # [DEFAULT: true]
"privacy.cpd.offlineApps" = F; # [DEFAULT: false]
"privacy.clearHistory.cookiesAndStorage" = F;
   # "privacy.cpd.openWindows" = F; # Session Restore
   # "privacy.cpd.passwords" = F;
   # "privacy.cpd.siteSettings" = F;
   # "privacy.clearHistory.siteSettings" = F;

/** SANITIZE MANUAL: TIMERANGE ***/
/* 2840: set "Time range to clear" for "Clear Data" (2820) and "Clear History" (2830)
 * Firefox remembers your last choice. This will reset the value when you start Firefox
 * 0=everything, 1=last hour, 2=last two hours, 3=last four hours, 4=today
 * [NOTE] Values 5 (last 5 minutes) and 6 (last 24 hours) are not listed in the dropdown,
 * which will display a blank value, and are not guaranteed to work ***/
"privacy.sanitize.timeSpan" = 0;

/*** [SECTION 4000]: FPP (fingerprintingProtection)
   RFP (4501) overrides FPP

   In FF118+ FPP is on by default in private windows (4001) and in FF119+ is controlled
   by ETP (2701). FPP will also use Remote Services in future to relax FPP protections
   on a per site basis for compatibility (4004).

   https:#searchfox.org/mozilla-central/source/toolkit/components/resistfingerprinting/RFPTargetsDefault.inc

   1826408 - restrict fonts to system (kBaseFonts + kLangPackFonts) (Windows, Mac, some Linux)
      https:#searchfox.org/mozilla-central/search?path=StandardFonts*.inc
   1858181 - subtly randomize canvas per eTLD+1, per session and per window-mode (FF120+)
***/
/* 4001: enable FPP in PB mode [FF114+]
 * [NOTE] In FF119+, FPP for all modes (7016) is enabled with ETP Strict (2701) ***/
   # "privacy.fingerprintingProtection.pbmode" = T; # [DEFAULT: true FF118+]
/* 4002: set global FPP overrides [FF114+]
 * uses "RFPTargets" [1] which despite the name these are not used by RFP
 * e.g. "+AllTargets,-CSSPrefersColorScheme,-JSDateTimeUTC" = all targets but allow prefers-color-scheme and do not change timezone
 * e.g. "-AllTargets,+CanvasRandomization,+JSDateTimeUTC" = no targets but do use FPP canvas and change timezone
 * [NOTE] Not supported by arkenfox. Either use RFP or FPP at defaults
 * [1] https:#searchfox.org/mozilla-central/source/toolkit/components/resistfingerprinting/RFPTargets.inc ***/
   # "privacy.fingerprintingProtection.overrides" = E;
/* 4003: set granular FPP overrides
 * JSON format: e.g."[{\"firstPartyDomain\": \"netflix.com\", \"overrides\": \"-CanvasRandomization,-FrameRate,\"}]"
 * [NOTE] Not supported by arkenfox. Either use RFP or FPP at defaults ***/
   # "privacy.fingerprintingProtection.granularOverrides" = E;
/* 4004: disable remote FPP overrides [FF127+] ***/
   # "privacy.fingerprintingProtection.remoteOverrides.enabled" = F;

/*** [SECTION 4500]: OPTIONAL RFP (resistFingerprinting)
   RFP overrides FPP (4000)

   FF128+ Arkenfox by default uses FPP (automatically enabled with ETP Strict). For most people
   this is all you need. To use RFP instead, add RFP (4501) to your overrides, and optionally
   add letterboxing (4504), spoof_english (4506), and webgl (4520).

   RFP is an all-or-nothing buy in: you cannot pick and choose what parts you want
   [TEST] https:#arkenfox.github.io/TZP/tzp.html

   [WARNING] DO NOT USE extensions to alter RFP protected metrics

    418986 - limit window.screen & CSS media queries (FF41)
   1281949 - spoof screen orientation (FF50)
   1360039 - spoof navigator.hardwareConcurrency as 2 (FF55)
 FF56
   1333651 - spoof User Agent & Navigator API
      version: android version spoofed as ESR (FF119 or lower)
      OS: JS spoofed as Windows 10, OS 10.15, Android 10, or Linux | HTTP Headers spoofed as Windows or Android
   1369319 - disable device sensor API
   1369357 - disable site specific zoom
   1337161 - hide gamepads from content
   1372072 - spoof network information API as "unknown" when dom.netinfo.enabled = true
   1333641 - reduce fingerprinting in WebSpeech API
 FF57
   1369309 - spoof media statistics
   1382499 - reduce screen co-ordinate fingerprinting in Touch API
   1217290 & 1409677 - enable some fingerprinting resistance for WebGL
   1354633 - limit MediaError.message to a whitelist
 FF58+
   1372073 - spoof/block fingerprinting in MediaDevices API (FF59)
      Spoof: enumerate devices as one "Internal Camera" and one "Internal Microphone"
      Block: suppresses the ondevicechange event
   1039069 - warn when language prefs are not set to "en*" (FF59)
   1222285 & 1433592 - spoof keyboard events and suppress keyboard modifier events (FF59)
      Spoofing mimics the content language of the document. Currently it only supports en-US.
      Modifier events suppressed are SHIFT and both ALT keys. Chrome is not affected.
   1337157 - disable WebGL debug renderer info (FF60)
   1459089 - disable OS locale in HTTP Accept-Language headers (ANDROID) (FF62)
   1479239 - return "no-preference" with prefers-reduced-motion (FF63)
   1363508 - spoof/suppress Pointer Events (FF64)
   1492766 - spoof pointerEvent.pointerid (FF65)
   1485266 - disable exposure of system colors to CSS or canvas (FF67)
   1494034 - return "light" with prefers-color-scheme (FF67)
   1564422 - spoof audioContext outputLatency (FF70)
   1595823 - return audioContext sampleRate as 44100 (FF72)
   1607316 - spoof pointer as coarse and hover as none (ANDROID) (FF74)
   1621433 - randomize canvas (previously FF58+ returned an all-white canvas) (FF78)
   1506364 - return "no-preference" with prefers-contrast (FF80)
   1653987 - limit font visibility to bundled and "Base Fonts" (Windows, Mac, some Linux) (FF80)
   1461454 - spoof smooth=true and powerEfficient=false for supported media in MediaCapabilities (FF82)
    531915 - use fdlibm's sin, cos and tan in jsmath (FF93, ESR91.1)
   1756280 - enforce navigator.pdfViewerEnabled as true and plugins/mimeTypes as hard-coded values (FF100-115)
   1692609 - reduce JS timing precision to 16.67ms (previously FF55+ was 100ms) (FF102)
   1422237 - return "srgb" with color-gamut (FF110)
   1794628 - return "none" with inverted-colors (FF114)
   1554751 - return devicePixelRatio as 2 (previously FF41+ was 1) (FF127)
   1787790 - normalize system fonts (FF128)
   1835987 - spoof timezone as Atlantic/Reykjavik (previously FF55+ was UTC) (FF128)
***/
/* 4501: enable RFP
 * [NOTE] pbmode applies if true and the original pref is false
 * [SETUP-WEB] RFP can cause some website breakage: mainly canvas, use a canvas site exception via the urlbar.
 * RFP also has a few side effects: mainly that timezone is GMT, and websites will prefer light theme ***/
   # "privacy.resistFingerprinting" = T; # [FF41+]
   # "privacy.resistFingerprinting.pbmode" = T; # [FF114+]
/* 4502: set RFP new window size max rounded values [FF55+]
 * [SETUP-CHROME] sizes round down in hundreds: width to 200s and height to 100s, to fit your screen
 * [1] https:#bugzilla.mozilla.org/1330882 ***/
"privacy.window.maxInnerWidth" = 1600;
"privacy.window.maxInnerHeight" = 900;
/* 4503: disable mozAddonManager Web API [FF57+]
 * [NOTE] To allow extensions to work on AMO, you also need 2662
 * [1] https:#bugzilla.mozilla.org/buglist.cgi?bug_id=1384330,1406795,1415644,1453988 ***/
"privacy.resistFingerprinting.block_mozAddonManager" = T;
/* 4504: enable letterboxing [FF67+]
 * Dynamically resizes the inner window by applying margins in stepped ranges [2]
 * If you use the dimension pref, then it will only apply those resolutions.
 * The format is "width1xheight1, width2xheight2, ..." (e.g. "800x600, 1000x1000")
 * [SETUP-WEB] This is independent of RFP (4501). If you're not using RFP, or you are but
 * dislike the margins, then flip this pref, keeping in mind that it is effectively fingerprintable
 * [WARNING] DO NOT USE: the dimension pref is only meant for testing
 * [1] https:#bugzilla.mozilla.org/1407366
 * [2] https:#hg.mozilla.org/mozilla-central/rev/6d2d7856e468#l2.32 ***/
   # "privacy.resistFingerprinting.letterboxing" = T; # [HIDDEN PREF]
   # "privacy.resistFingerprinting.letterboxing.dimensions" = E; # [HIDDEN PREF]
/* 4505: disable RFP by domain [FF91+] ***/
   # "privacy.resistFingerprinting.exemptedDomains" = "*.example.invalid";
/* 4506: disable RFP spoof english prompt [FF59+]
 * 0=prompt, 1=disabled, 2=enabled
 * [NOTE] When changing from value 2, preferred languages ('intl.accept_languages') is not reset.
 * [SETUP-WEB] when enabled, sets 'en-US, en' for displaying pages and 'en-US' as locale.
 * [SETTING] General>Language>Choose your preferred language for displaying pages>Choose>Request English... ***/
"privacy.spoof_english" = 1;
/* 4510: disable using system colors
 * [SETTING] General>Language and Appearance>Fonts and Colors>Colors>Use system colors ***/
"browser.display.use_system_colors" = F; # [DEFAULT: false NON-WINDOWS]
/* 4512: enforce links targeting new windows to open in a new tab instead
 * 1=most recent window or tab, 2=new window, 3=new tab
 * Stops malicious window sizes and some screen resolution leaks.
 * You can still right-click a link and open in a new window
 * [SETTING] General>Tabs>Open links in tabs instead of new windows
 * [TEST] https:#arkenfox.github.io/TZP/tzp.html#screen
 * [1] https:#gitlab.torproject.org/tpo/applications/tor-browser/-/issues/9881 ***/
"browser.link.open_newwindow" = 3; # [DEFAULT: 3]
/* 4513: set all open window methods to abide by "browser.link.open_newwindow" (4512)
 * [1] https:#searchfox.org/mozilla-central/source/dom/tests/browser/browser_test_new_window_from_content.js ***/
"browser.link.open_newwindow.restriction" = 0;
/* 4520: disable WebGL (Web Graphics Library) ***/
   # "webgl.disabled" = T;

/*** [SECTION 5000]: OPTIONAL OPSEC
   Disk avoidance, application data isolation, eyeballs...
***/
/* 5001: start Firefox in PB (Private Browsing) mode
 * [NOTE] In this mode all windows are "private windows" and the PB mode icon is not displayed
 * [NOTE] The P in PB mode can be misleading: it means no "persistent" disk state such as history,
 * caches, searches, cookies, localStorage, IndexedDB etc (which you can achieve in normal mode).
 * In fact, PB mode limits or removes the ability to control some of these, and you need to quit
 * Firefox to clear them. PB is best used as a one off window (Menu>New Private Window) to provide
 * a temporary self-contained new session. Close all private windows to clear the PB session.
 * [SETTING] Privacy & Security>History>Custom Settings>Always use private browsing mode
 * [1] https:#wiki.mozilla.org/Private_Browsing
 * [2] https:#support.mozilla.org/kb/common-myths-about-private-browsing ***/
   # "browser.privatebrowsing.autostart" = T;
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
   # "permissions.memory_only" = T; # [HIDDEN PREF]
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
   # "browser.urlbar.suggest.topsites" = F; # [FF78+]
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
   # "extensions.formautofill.addresses.enabled" = F; # [FF55+]
   # "extensions.formautofill.creditCards.enabled" = F; # [FF56+]
/* 5018: limit events that can cause a pop-up ***/
   # "dom.popup_allowed_events" = "click dblclick mousedown pointerdown";
/* 5019: disable page thumbnail collection ***/
   # "browser.pagethumbnails.capturing_disabled" = T; # [HIDDEN PREF]
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
   # "mathml.disabled" = T; # 1173199
/* 5502: disable in-content SVG (Scalable Vector Graphics) [FF53+]
 * [1] https:#cve.mitre.org/cgi-bin/cvekey.cgi?keyword=firefox+svg ***/
   # "svg.disabled" = T; # 1216893
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
   # "javascript.options.jit_trustedprincipals" = T; # [FF75+] [HIDDEN PREF]
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
   # "network.trr.bootstrapAddr" = "10.0.0.1"; # [HIDDEN PREF]

# [SECTION 6000]: DON'T TOUCH
/* 6001: enforce Firefox blocklist
 * [WHY] It includes updates for "revoked certificates"
 * [1] https:#blog.mozilla.org/security/2015/03/03/revoking-intermediate-certificates-introducing-onecrl/ ***/
"extensions.blocklist.enabled" = T; # [DEFAULT: true]
/* 6002: enforce no referer spoofing
 * [WHY] Spoofing can affect CSRF (Cross-Site Request Forgery) protections ***/
"network.http.referer.spoofSource" = F; # [DEFAULT: false]
/* 6004: enforce a security delay on some confirmation dialogs such as install, open/save
 * [1] https:#www.squarefree.com/2004/07/01/race-conditions-in-security-dialogs/ ***/
"security.dialog_enable_delay" = 1000; # [DEFAULT: 1000]
/* 6008: enforce no First Party Isolation [FF51+]
 * [WARNING] Replaced with network partitioning (FF85+) and TCP (2701), and enabling FPI
 * disables those. FPI is no longer maintained except at Tor Project for Tor Browser's config ***/
"privacy.firstparty.isolate" = F; # [DEFAULT: false]
/* 6009: enforce SmartBlock shims (about:compat) [FF81+]
 * [1] https:#blog.mozilla.org/security/2021/03/23/introducing-smartblock/ ***/
"extensions.webcompat.enable_shims" = T; # [HIDDEN PREF] [DEFAULT: true]
/* 6010: enforce no TLS 1.0/1.1 downgrades
 * [TEST] https:#tls-v1-1.badssl.com:1010/ ***/
"security.tls.version.enable-deprecated" = F; # [DEFAULT: false]
/* 6011: enforce disabling of Web Compatibility Reporter [FF56+]
 * Web Compatibility Reporter adds a "Report Site Issue" button to send data to Mozilla
 * [WHY] To prevent wasting Mozilla's time with a custom setup ***/
"extensions.webcompat-reporter.enabled" = F; # [DEFAULT: false]
/* 6012: enforce Quarantined Domains [FF115+]
 * [WHY] https:#support.mozilla.org/kb/quarantined-domains */
"extensions.quarantinedDomains.enabled" = T; # [DEFAULT: true]
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
   # "permissions.default.xr" = 0; # Virtual Reality
/* 7003: disable non-modern cipher suites [1]
 * [WHY] Passive fingerprinting. Minimal/non-existent threat of downgrade attacks
 * [1] https:#browserleaks.com/ssl ***/
   # "security.ssl3.ecdhe_ecdsa_aes_128_sha" = F;
   # "security.ssl3.ecdhe_ecdsa_aes_256_sha" = F;
   # "security.ssl3.ecdhe_rsa_aes_128_sha" = F;
   # "security.ssl3.ecdhe_rsa_aes_256_sha" = F;
   # "security.ssl3.rsa_aes_128_gcm_sha256" = F; # no PFS
   # "security.ssl3.rsa_aes_256_gcm_sha384" = F; # no PFS
   # "security.ssl3.rsa_aes_128_sha" = F; # no PFS
   # "security.ssl3.rsa_aes_256_sha" = F; # no PFS
/* 7004: control TLS versions
 * [WHY] Passive fingerprinting and security ***/
   # "security.tls.version.min" = 3; # [DEFAULT: 3]
   # "security.tls.version.max" = 4;
/* 7005: disable SSL session IDs [FF36+]
 * [WHY] Passive fingerprinting and perf costs. These are session-only
 * and isolated with network partitioning (FF85+) and/or containers ***/
   # "security.ssl.disable_session_identifiers" = T;
/* 7006: onions
 * [WHY] Firefox doesn't support hidden services. Use Tor Browser ***/
   # "dom.securecontext.allowlist_onions" = T; # [FF97+] 1382359/1744006
   # "network.http.referer.hideOnionSource" = T; # 1305144
/* 7007: referers
 * [WHY] Only cross-origin referers (1602, 5510) matter ***/
   # "network.http.sendRefererHeader" = 2;
   # "network.http.referer.trimmingPolicy" = 0;
/* 7008: set the default Referrer Policy [FF59+]
 * 0=no-referer, 1=same-origin, 2=strict-origin-when-cross-origin, 3=no-referrer-when-downgrade
 * [WHY] Defaults are fine. They can be overridden by a site-controlled Referrer Policy ***/
   # "network.http.referer.defaultPolicy" = 2; # [DEFAULT: 2]
   # "network.http.referer.defaultPolicy.pbmode" = 2; # [DEFAULT: 2]
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
   # "gfx.downloadable_fonts.enabled" = F; # [FF41+]
   # "gfx.downloadable_fonts.fallback_delay" = -1;
/* 7013: disable Clipboard API
 * [WHY] Fingerprintable. Breakage. Cut/copy/paste require user
 * interaction, and paste is limited to focused editable fields ***/
   # "dom.event.clipboardevents.enabled" = F;
/* 7014: disable System Add-on updates
 * [WHY] It can compromise security. System addons ship with prefs, use those ***/
   # "extensions.systemAddon.update.enabled" = F; # [FF62+]
   # "extensions.systemAddon.update.url" = E; # [FF44+]
/* 7015: enable the DNT (Do Not Track) HTTP header
 * [WHY] DNT is enforced with Tracking Protection which is used in ETP Strict (2701) ***/
   # "privacy.donottrackheader.enabled" = T;
/* 7016: customize ETP settings
 * [NOTE] FPP (fingerprintingProtection) is ignored when RFP (4501) is enabled
 * [WHY] Arkenfox only supports strict (2701) which sets these at runtime ***/
   # "network.cookie.cookieBehavior" = 5; # [DEFAULT: 5]
   # "privacy.fingerprintingProtection" = T; # [FF114+] [ETP FF119+]
   # "network.http.referer.disallowCrossSiteRelaxingDefault" = T;
   # "network.http.referer.disallowCrossSiteRelaxingDefault.top_navigation" = T; # [FF100+]
   # "privacy.partition.network_state.ocsp_cache" = T; # [DEFAULT: true FF123+]
   # "privacy.query_stripping.enabled" = T; # [FF101+]
   # "privacy.trackingprotection.enabled" = T;
   # "privacy.trackingprotection.socialtracking.enabled" = T;
   # "privacy.trackingprotection.cryptomining.enabled" = T; # [DEFAULT: true]
   # "privacy.trackingprotection.fingerprinting.enabled" = T; # [DEFAULT: true]
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
"browser.startup.homepage_override.mstone" = "ignore"; # [HIDDEN PREF]
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
   # "layout.css.font-visibility.resistFingerprinting" = 1; # [DEFAULT: 1]
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
   # "javascript.use_us_english_locale" = T; # [HIDDEN PREF]
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
"widget.non-native-theme.enabled" = T; # [DEFAULT: true]
# ***/
        };
      };
      SearchSuggestEnabled = false; # Enable or disable search suggestions.
      ShowHomeButton = false; # Show the home button on the toolbar.
      StartDownloadsInTempDirectory = false; # Force downloads to start off in a local, temporary location rather than the default download directory.
      WindowsSSO = false; # Allow Windows single sign-on for Microsoft, work, and school accounts.
    };
    profiles.bevicted = {
      id = 0;
      isDefault = true;
    };
  };
}
