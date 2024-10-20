{ ... }:
{
  programs.rofi = {
    enable = true;
    theme = "Arc-Dark";
    extraConfig = {
      modi = "drun,run";
      show-icons = true;
      matching = "fuzzy";
    };
  };
}
