{ pkgs, ... }:

{
  programs.tmux = {
    enable = true;
    catppuccin.enable = true;

    baseIndex = 1;

    keyMode = "vi";

    prefix = "C-a";

    mouse = true;
    clock24 = true;
    escapeTime = 5;
    historyLimit = 10000;

    extraConfig = ''
set-option -sa terminal-overrides ",xterm*:Tc"
set -g renumber-windows on

bind r source-file ~/.config/tmux/tmux.conf

bind -T copy-mode-vi v send-keys -X begin-selection
bind -T copy-mode-vi C-v send-keys -X rectangle-select
bind -T copy-mode-vi y send-keys -X copy-selection-and-cancel

bind -r f run-shell "tmux neww tmux-sessionizer"

bind '"' split-window -c "#{pane_current_path}"
bind % split-window -h -c "#{pane_current_path}"
bind c new-window -c "#{pane_current_path}"
    '';

    plugins = with pkgs; [
      {
        plugin = tmuxPlugins.sensible;
      }
      {
        plugin = tmuxPlugins.vim-tmux-navigator;
      }
      {
        plugin = tmuxPlugins.yank;
        extraConfig = "set -g @yank_action 'copy-pipe'";
      }
      {
        plugin = tmuxPlugins.fingers;
      }
    ];
  };
}
