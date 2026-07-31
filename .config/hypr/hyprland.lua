-- Personal Hyprland config (converted from hyprland.conf via hyprlang2lua).
-- Hyprland docs: https://wiki.hypr.land/Configuring/
--
-- Split config into separate .lua modules and pull them in with require()
-- (e.g. require("myColors") loads myColors.lua; see require("monitors") below).


-- Monitors -- https://wiki.hypr.land/Configuring/Monitors/
hl.monitor({
    output = "",
    mode = "preferred",
    position = "auto",
    scale = "auto",
})

-- Machine-specific monitor overrides (refresh rate, position, VRR).
-- Untracked — copy monitors.lua.example to monitors.lua and edit.
-- Soft load: a machine without monitors.lua (e.g. laptop, no externals) falls
-- through to the wildcard default above; real errors inside it still surface.
local ok, err = pcall(require, "monitors")
if not ok and not tostring(err):find("module 'monitors' not found", 1, true) then
    error(err)
end


-- Programs
local terminal = "ghostty"
local menu = "hyprlauncher"


-- Environment variables -- https://wiki.hypr.land/Configuring/Environment-variables/
hl.env("XCURSOR_SIZE", "24")
hl.env("HYPRCURSOR_SIZE", "24")
hl.env("GTK_THEME", "Adwaita:dark")

-- Nvidia — https://wiki.hypr.land/Nvidia/
hl.env("LIBVA_DRIVER_NAME", "nvidia")
hl.env("__GLX_VENDOR_LIBRARY_NAME", "nvidia")
hl.env("NVD_BACKEND", "direct")


-- Look and feel -- https://wiki.hypr.land/Configuring/Variables/
hl.config({
    general = {
        gaps_in = 3,
        gaps_out = 0,
        border_size = 1,
        col = {
            active_border = { colors = { "rgba(33ccffee)", "rgba(00ff99ee)" }, angle = 45 },
            inactive_border = "rgba(595959aa)",
        },
        resize_on_border = false,
        -- Tearing only engages for windows with the `immediate` rule (see window rules).
        -- Other windows are unaffected. https://wiki.hypr.land/Configuring/Tearing/
        allow_tearing = true,
        layout = "dwindle",
    },
    -- Required for tearing on nvidia: hw cursor blocks tearing engagement.
    -- Also avoids known nvidia hw-cursor flicker.
    cursor = {
        no_hardware_cursors = true,
    },
    decoration = {
        rounding = 10,
        rounding_power = 2,
        active_opacity = 1.0,
        inactive_opacity = 1.0,
        shadow = {
            enabled = false,
            range = 4,
            render_power = 3,
            color = "rgba(1a1a1aee)",
        },
        blur = {
            enabled = true,
            size = 2,
            passes = 1,
            vibrancy = 0.1696,
        },
    },
    animations = {
        enabled = true,
    },
    dwindle = {
        preserve_split = true,
    },
    misc = {
        force_default_wallpaper = 0,
        disable_hyprland_logo = true,
    },
    input = {
        kb_layout = "us,hu",
        kb_variant = "",
        kb_model = "",
        kb_options = "grp:caps_toggle",
        kb_rules = "",
        follow_mouse = 1,
        sensitivity = 0, -- -1.0 - 1.0, 0 means no modification.
        touchpad = {
            natural_scroll = false,
        },
    },
    xwayland = {
        force_zero_scaling = true, -- unscale XWayland so it is not a pixelated mess
    },
})


-- Animation curves + timings -- https://wiki.hypr.land/Configuring/Animations/
hl.curve("easeOutQuint", { type = "bezier", points = { { 0.23, 1 }, { 0.32, 1 } } })
hl.curve("easeInOutCubic", { type = "bezier", points = { { 0.65, 0.05 }, { 0.36, 1 } } })
hl.curve("linear", { type = "bezier", points = { { 0, 0 }, { 1, 1 } } })
hl.curve("almostLinear", { type = "bezier", points = { { 0.5, 0.5 }, { 0.75, 1.0 } } })
hl.curve("quick", { type = "bezier", points = { { 0.15, 0 }, { 0.1, 1 } } })

-- leaf, speed, bezier, [style]
local animations = {
    { "global",        10,   "default" },
    { "border",        5.39, "easeOutQuint" },
    { "windows",       4.79, "easeOutQuint" },
    { "windowsIn",     4.1,  "easeOutQuint", "popin 87%" },
    { "windowsOut",    1.49, "linear",       "popin 87%" },
    { "fadeIn",        1.73, "almostLinear" },
    { "fadeOut",       1.46, "almostLinear" },
    { "fade",          3.03, "quick" },
    { "layers",        3.81, "easeOutQuint" },
    { "layersIn",      4,    "easeOutQuint", "fade" },
    { "layersOut",     1.5,  "linear",       "fade" },
    { "fadeLayersIn",  1.79, "almostLinear" },
    { "fadeLayersOut", 1.39, "almostLinear" },
    { "workspaces",    1.94, "almostLinear", "fade" },
    { "workspacesIn",  1.21, "almostLinear", "fade" },
    { "workspacesOut", 1.94, "almostLinear", "fade" },
}
for _, a in ipairs(animations) do
    local t = { leaf = a[1], enabled = true, speed = a[2], bezier = a[3] }
    if a[4] then t.style = a[4] end
    hl.animation(t)
end


-- Keybindings -- https://wiki.hypr.land/Configuring/Binds/
local mainMod = "SUPER" -- "Windows" key as main modifier

hl.bind(mainMod .. " + T", hl.dsp.exec_cmd(terminal))
hl.bind(mainMod .. " + C", hl.dsp.window.close())
hl.bind(mainMod .. " + SHIFT + CTRL + M", hl.dsp.exit())
hl.bind(mainMod .. " + F", hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + R", hl.dsp.exec_cmd(menu))
hl.bind(mainMod .. " + P", hl.dsp.window.pseudo())
hl.bind(mainMod .. " + J", hl.dsp.layout("togglesplit"))

-- Move focus with mainMod + arrow keys
hl.bind(mainMod .. " + left", hl.dsp.focus({ direction = "left" }))
hl.bind(mainMod .. " + right", hl.dsp.focus({ direction = "right" }))
hl.bind(mainMod .. " + up", hl.dsp.focus({ direction = "up" }))
hl.bind(mainMod .. " + down", hl.dsp.focus({ direction = "down" }))

-- Workspaces 1-10 (SUPER+1..9,0 to focus; +SHIFT to move active window there)
for i = 1, 10 do
    local key = tostring(i % 10) -- 1..9 then "0" for workspace 10
    hl.bind(mainMod .. " + " .. key, hl.dsp.focus({ workspace = i }))
    hl.bind(mainMod .. " + SHIFT + " .. key, hl.dsp.window.move({ workspace = i }))
end

-- Scroll through workspaces with mainMod + scroll
hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mainMod .. " + mouse_up", hl.dsp.focus({ workspace = "e-1" }))

-- Move/resize windows with mainMod + LMB/RMB drag
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(), { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

-- Laptop multimedia keys for volume and LCD brightness
hl.bind("XF86AudioRaiseVolume", hl.dsp.exec_cmd("wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 5%+"), { locked = true, repeating = true })
hl.bind("XF86AudioLowerVolume", hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-"), { locked = true, repeating = true })
hl.bind("XF86AudioMute", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"), { locked = true, repeating = true })
hl.bind("XF86AudioMicMute", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"), { locked = true, repeating = true })
hl.bind("XF86MonBrightnessUp", hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%+"), { locked = true, repeating = true })
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%-"), { locked = true, repeating = true })

-- Requires playerctl
hl.bind("XF86AudioNext", hl.dsp.exec_cmd("playerctl next"), { locked = true })
hl.bind("XF86AudioPause", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPlay", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPrev", hl.dsp.exec_cmd("playerctl previous"), { locked = true })

-- Custom
hl.bind(mainMod .. " + N", hl.dsp.global("quickshell:controlcenter"))
hl.bind(mainMod .. " + L", hl.dsp.exec_cmd("loginctl lock-session"))
hl.bind(mainMod .. " + S", hl.dsp.exec_cmd("slurp | grim -g - - | wl-copy"))
hl.bind(mainMod .. " + SHIFT + S", hl.dsp.exec_cmd("slurp | grim -g - \"${HOME}/screenshots/$(date +%Y-%m-%d_%H-%M-%S).png\""))
hl.bind(mainMod .. " + equal", hl.dsp.exec_cmd("ghostty --class=com.local.floatcalc -e sh -c 'printf \"\\033[1;36m== qalc — calculator ==\\033[0m\\n\\n\"; exec qalc'"))
hl.bind(mainMod .. " + SHIFT + F", hl.dsp.window.fullscreen({ mode = "fullscreen", action = "toggle" }))

-- Push-to-talk (Discord on Voice Activity). mouse:276 = thumb btn 2 (Discord "mouse 9").
-- Mic muted by default; opens only while held. Works regardless of window focus.
hl.bind("mouse:276", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 0"))
hl.bind("mouse:276", hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 1"), { release = true })


-- Window rules -- https://wiki.hypr.land/Configuring/Window-Rules/

-- Ignore maximize requests from apps
hl.window_rule({
    match = { class = ".*" },
    suppress_event = "maximize",
})

-- Fix some dragging issues with XWayland
hl.window_rule({
    match = {
        class = "^$",
        title = "^$",
        xwayland = true,
        float = true,
        fullscreen = false,
        pin = false,
    },
    no_focus = true,
})

-- Allow tearing for games (uncapped fps, lowest input latency).
-- Requires general.allow_tearing=true and cursor.no_hardware_cursors=true.
for _, class in ipairs({ "^(steam_app_.*)$", "^(gamescope.*)$", "^(cs2)$" }) do
    hl.window_rule({ match = { class = class }, immediate = true })
end

-- Floating calculator (ghostty --class=floatcalc -e qalc)
hl.window_rule({
    match = { class = "^(com\\.local\\.floatcalc)$" },
    float = true,
    size = "600 400",
    center = true,
})


-- Autostart: launched on Hyprland start.
hl.on("hyprland.start", function()
    hl.exec_cmd(terminal)
    hl.exec_cmd("quickshell")
    hl.exec_cmd("1password --silent")
    hl.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 1") -- start muted for push-to-talk
end)
