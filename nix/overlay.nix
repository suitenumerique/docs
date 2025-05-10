self: super: {
  docs-backend = self.callPackage ./packages/docs-backend.nix { };

  docs-frontend = self.callPackage ./packages/docs-frontend.nix { };

  docs-collaboration-server = self.callPackage ./packages/docs-collaboration-server.nix { };

  pythonPackagesExtensions = super.pythonPackagesExtensions ++ [
    (pyself: pysuper: {
      nested-multipart-parser = pyself.callPackage ./packages/nested-multipart-parser.nix { };

      python-dockerflow = pyself.callPackage ./packages/python-dockerflow.nix { };
    })
  ];
}
