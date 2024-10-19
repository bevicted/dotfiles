{ ... }:
{
  programs.rofi = {
    enable = true;
    theme = "arc-dark";
    extraConfig = {
      modi = "drun,run";
      show-icons = true;
      matching = "fuzzy";
      # TODO: this doesn't exist here, maybe I don't even need it though
      # timeout = {
      #   action = "kb-cancel";
      #   delay =  0;
      # };
      # filebrowser = {
      #   directories-first = true;
      #   sorting-method =    "name";
      # };
    };
  };
}
