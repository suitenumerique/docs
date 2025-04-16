{
  lib,
  python3,
  fetchpatch,
  fetchFromGitHub,
}:
let
  python = python3.override {
    self = python3;
    packageOverrides = self: super: {
      django = super.django_5;

      django-extensions = super.django-extensions.overridePythonAttrs (oldAttrs: {
        nativeCheckInputs = [ self.pyasyncore ];

        patches = lib.optional (lib.versionOlder oldAttrs.version "4.0") (fetchpatch {
          url = "https://patch-diff.githubusercontent.com/raw/browniebroke/django-extensions/pull/2.patch";
          hash = "sha256-oYRfchotvv7E4xOuicPEVjfRZ2jiKfTPHWQZ/+YLE2g=";
        });
      });
    };
  };
in

python.pkgs.buildPythonApplication rec {
  pname = "docs-backend";
  version = "3.1.0";
  pyproject = true;

  src = fetchFromGitHub {
    owner = "suitenumerique";
    repo = "docs";
    tag = "v${version}";
    hash = "sha256-QeHtQWeCk1jwwtbPgQVtTKGIOUnsg9uERgrYNDl8xRk=";
  };

  sourceRoot = "source/src/backend";

  build-system = with python.pkgs; [ setuptools ];

  dependencies = with python.pkgs; [
    beautifulsoup4
    boto3
    celery
    django
    django-configurations
    django-cors-headers
    django-countries
    django-extensions
    django-filter
    django-parler
    django-redis
    django-storages
    django-timezone-field
    django-treebeard
    djangorestframework
    drf-spectacular
    drf-spectacular-sidecar
    easy-thumbnails
    factory-boy
    gunicorn
    jsonschema
    lxml
    markdown
    mozilla-django-oidc
    nested-multipart-parser
    openai
    psycopg
    pycrdt
    pyjwt
    pyopenssl
    python-dockerflow
    python-magic
    redis
    requests
    sentry-sdk
    whitenoise
  ];

  pythonRelaxDeps = true;

  prePatch = ''
    substituteInPlace impress/settings.py \
      --replace-fail "DATA_DIR = " "DATA_DIR = os.getenv('DATA_DIR') #"
  '';

  postBuild = ''
    export DATA_DIR=$(pwd)/data
    ${python.pythonOnBuildForHost.interpreter} manage.py collectstatic --noinput
  '';

  installPhase =
    let
      pythonPath = python.pkgs.makePythonPath dependencies;
    in
    ''
      runHook preInstall

      mkdir -p $out/lib/docs/src
      cp -r {core,demo,impress,locale,manage.py,__init__.py} $out/lib/docs/src
      cp -r data/static $out/lib/docs
      chmod +x $out/lib/docs/src/manage.py
      makeWrapper $out/lib/docs/src/manage.py $out/bin/docs \
        --prefix PYTHONPATH : "${pythonPath}"
      makeWrapper ${lib.getExe python.pkgs.celery} $out/bin/celery \
        --prefix PYTHONPATH : "${pythonPath}:$out/lib/docs/src"
      makeWrapper ${lib.getExe python.pkgs.gunicorn} $out/bin/gunicorn \
        --prefix PYTHONPATH : "${pythonPath}:$out/lib/docs/src"

      runHook postInstall
    '';

  passthru = { inherit python; };

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
