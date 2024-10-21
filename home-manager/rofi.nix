{ ... }:

{
  programs.rofi = {
    enable = true;
    catppuccin.enable = true;
    extraConfig = {
      modi = "drun,run";
      show-icons = true;
      matching = "fuzzy";
    };
  };
}
