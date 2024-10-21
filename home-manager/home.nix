{ config, pkgs, nixgl, ... }:

{
  # Home Manager needs a bit of information about you and the paths it should
  # manage.
  home.username = "bevicted";
  home.homeDirectory = "/home/bevicted";

  # This value determines the Home Manager release that your configuration is
  # compatible with. This helps avoid breakage when a new Home Manager release
  # introduces backwards incompatible changes.
  #
  # You should not change this value, even if you update Home Manager. If you do
  # want to update the value, then make sure to first check the Home Manager
  # release notes.
  home.stateVersion = "24.05"; # Please read the comment before changing.

  imports = [
    # TODO: remove when https://github.com/nix-community/home-manager/pull/5355 gets merged:
    (builtins.fetchurl {
      url = "https://raw.githubusercontent.com/Smona/home-manager/nixgl-compat/modules/misc/nixgl.nix";
      sha256 = "1krclaga358k3swz2n5wbni1b2r7mcxdzr6d7im6b66w3sbpvnb3";
    })
    ./alacritty.nix
    ./gitui.nix
    ./nix.nix
    ./rofi.nix
    ./tmux.nix
  ];

  # nixGL.prefix = "${pkgs.nixgl.nixGLIntel}/bin/nixGLIntel";
  nixGL = {
    packages = nixgl.packages;
    defaultWrapper = "mesa";
  };

  # The home.packages option allows you to install Nix packages into your
  # environment.
  home.packages = [
    pkgs.nixgl.nixGLIntel

    # shells
    pkgs.bash
    pkgs.zsh

    # core tools
    pkgs.git
    pkgs.neovim
    pkgs.fzf
    pkgs.ripgrep
    pkgs.fd
    pkgs.jq
    pkgs.yq
    pkgs.entr

    # langs
    pkgs.go

    # cloud
    pkgs.podman
    pkgs.kubectl
    pkgs.terraform-1_5_7

    # experimentals
    pkgs.sampler
    pkgs.hey

    # fonts
    (pkgs.nerdfonts.override { fonts = [ "JetBrainsMono" ]; })

    # # You can also create simple shell scripts directly inside your
    # # configuration. For example, this adds a command 'my-hello' to your
    # # environment:
    # (pkgs.writeShellScriptBin "my-hello" ''
    #   echo "Hello, ${config.home.username}!"
    # '')
  ];

  # Home Manager is pretty good at managing dotfiles. The primary way to manage
  # plain files is through 'home.file'.
  home.file = {
    # # Building this configuration will create a copy of 'dotfiles/screenrc' in
    # # the Nix store. Activating the configuration will then make '~/.screenrc' a
    # # symlink to the Nix store copy.
    # ".screenrc".source = dotfiles/screenrc;

    # # You can also set the file content immediately.
    # ".gradle/gradle.properties".text = ''
    #   org.gradle.console=verbose
    #   org.gradle.daemon.idletimeout=3600000
    # '';
  };

  # Home Manager can also manage your environment variables through
  # 'home.sessionVariables'. These will be explicitly sourced when using a
  # shell provided by Home Manager. If you don't want to manage your shell
  # through Home Manager then you have to manually source 'hm-session-vars.sh'
  # located at either
  #
  #  ~/.nix-profile/etc/profile.d/hm-session-vars.sh
  #
  # or
  #
  #  ~/.local/state/nix/profiles/profile/etc/profile.d/hm-session-vars.sh
  #
  # or
  #
  #  /etc/profiles/per-user/bevicted/etc/profile.d/hm-session-vars.sh
  #
  home.sessionVariables = {
    LANG="C";
    EDITOR = "nvim";
    LOCALES_ARCHIVE = "${pkgs.glibcLocales}/lib/locale/locale-archive";
  };

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;
}
