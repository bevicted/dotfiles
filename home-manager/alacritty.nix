{ config, pkgs, ... }:

let
  fontFamily = "JetBrainsMono Nerd Font";
in {
  programs.alacritty = {
    enable = true;
    package = config.lib.nixGL.wrap pkgs.alacritty;
    catppuccin.enable = true;
    settings = {
      env = {
        "TERM" = "xterm-256color";
      };
      font = {
        size = 12.0;
        normal = {
          family = fontFamily;
          style = "Regular";
        };
        bold = {
          family = fontFamily;
          style = "Bold";
        };
        italic = {
          family = fontFamily;
          style = "Italic";
        };
        bold_italic = {
          family = fontFamily;
          style = "Bold Italic";
        };
      };
    };
  };
}
