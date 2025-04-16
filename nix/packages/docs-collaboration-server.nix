{
  lib,
  fetchFromGitHub,
  stdenv,
  fetchYarnDeps,
  nodejs,
  fixup-yarn-lock,
  yarn,
  makeWrapper,
}:

stdenv.mkDerivation rec {
  pname = "docs-collaboration-server";
  version = "3.1.0";

  src = (fetchFromGitHub {
    owner = "suitenumerique";
    repo = "docs";
    rev = "v${version}";
    hash = "sha256-QeHtQWeCk1jwwtbPgQVtTKGIOUnsg9uERgrYNDl8xRk=";
  });
  
  sourceRoot = "source/src/frontend";

  offlineCache = fetchYarnDeps {
    yarnLock = "${src}/src/frontend/yarn.lock";
    hash = "sha256-tNKKN4rpU1vM8NTW1bLB+a+gz7EqxPGY5lUdcwD/Dkc=";
  };

  nativeBuildInputs = [
    nodejs
    fixup-yarn-lock
    yarn
    makeWrapper
  ];

  configurePhase = ''
    runHook preConfigure

    export HOME=$(mktemp -d)
    yarn config --offline set yarn-offline-mirror "$offlineCache"
    fixup-yarn-lock yarn.lock
    yarn --offline --frozen-lockfile --ignore-platform --ignore-scripts --no-progress --non-interatctive install
    patchShebangs node_modules

    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild

    cd servers/y-provider

    yarn --offline build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/{lib,bin}
    cp -r {dist,package.json,../../node_modules} $out/lib

    makeWrapper ${lib.getExe nodejs} "$out/bin/docs-collaboration-server" \
      --add-flags "$out/lib/dist/start-server.js" --set NODE_PATH "$out/lib/node_modules"

    runHook postInstall
  '';

  meta = {
    description = "A collaborative note taking, wiki and documentation platform that scales. Built with Django and React. Opensource alternative to Notion or Outline";
    homepage = "https://github.com/suitenumerique/docs";
    changelog = "https://github.com/suitenumerique/docs/blob/${src.rev}/CHANGELOG.md";
    license = lib.licenses.mit;
    maintainers = with lib.maintainers; [ soyouzpanda ];
    mainProgram = "docs";
    platforms = lib.platforms.all;
  };
}

