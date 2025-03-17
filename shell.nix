{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShellNoCC {
    nativeBuildInputs = with pkgs.buildPackages; [
			docker
			docker-compose
			gnumake
		];
}

