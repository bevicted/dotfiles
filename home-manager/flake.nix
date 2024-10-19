{
  description = "Home Manager configuration of bevicted";

  inputs = {
    # Specify the source of Home Manager and Nixpkgs.
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    nixpkgs_terraform.url = "github:nixos/nixpkgs/517501bcf14ae6ec47efd6a17dda0ca8e6d866f9";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, nixpkgs_terraform, home-manager, ... }:
    let
      system = "x86_64-linux";
      pkgs_terraform = nixpkgs_terraform.legacyPackages.${system};
      terraform_overlay = final: prev: {
        terraform = pkgs_terraform.terraform;
      };
      pkgs = nixpkgs.legacyPackages.${system}.extend terraform_overlay;
    in {
      homeConfigurations."bevicted" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;

        # Specify your home configuration modules here, for example,
        # the path to your home.nix.
        modules = [ ./home.nix ];

        # Optionally use extraSpecialArgs
        # to pass through arguments to home.nix
      };
    };
}
