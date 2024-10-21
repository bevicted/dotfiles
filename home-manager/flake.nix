{
  description = "Home Manager configuration of bevicted";

  inputs = {
    # Specify the source of Home Manager and Nixpkgs.
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    nixgl = {
      url = "github:nix-community/nixGL";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixpkgs_terraform.url = "github:nixos/nixpkgs/517501bcf14ae6ec47efd6a17dda0ca8e6d866f9";
    catppuccin.url = "github:catppuccin/nix";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, nixgl, nixpkgs_terraform, catppuccin, home-manager, ... }:
    let
      system = "x86_64-linux";
      pkgs_terraform = nixpkgs_terraform.legacyPackages.${system};
      terraform_overlay = final: prev: {
        terraform-1_5_7 = pkgs_terraform.terraform;
      };
      pkgs = import nixpkgs {
        inherit system;
        overlays = [
          nixgl.overlay
          terraform_overlay
        ];
      };
    in {
      homeConfigurations."bevicted" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;

        # Specify your home configuration modules here, for example,
        # the path to your home.nix.
        modules = [
          ./home.nix
          catppuccin.homeManagerModules.catppuccin
        ];

        extraSpecialArgs = {
          inherit nixgl;
        };

        # Optionally use extraSpecialArgs
        # to pass through arguments to home.nix
      };
    };
}
