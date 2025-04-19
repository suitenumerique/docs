{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools-scm,
  wheel,
}:

buildPythonPackage rec {
  pname = "python-dockerflow";
  version = "2024.04.2";
  pyproject = true;

  src = fetchFromGitHub {
    owner = "mozilla-services";
    repo = "python-dockerflow";
    rev = version;
    hash = "sha256-5Ov605FyhX+n6vFks2sdtviGqkrgDIMXpcvgqR85jmQ=";
  };

  build-system = [
    setuptools-scm
    wheel
  ];

  pythonImportsCheck = [
    "dockerflow"
  ];

  meta = {
    description = "A Python package to implement tools and helpers for Mozilla Dockerflow";
    homepage = "https://github.com/mozilla-services/python-dockerflow";
    license = lib.licenses.mpl20;
    maintainers = with lib.maintainers; [ soyouzpanda ];
  };
}
