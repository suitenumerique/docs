{
  pkgs ? import <nixpkgs> { },
}:
{
  devShell = pkgs.mkShellNoCC {
    name = "numerique-docs";
    packages = with pkgs; [
      docker
      docker-compose
      gnumake
    ];
  };
}
