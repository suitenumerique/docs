{
  lib,
  buildPythonPackage,
  fetchFromGitHub,
  setuptools-scm,
  wheel,
}:

buildPythonPackage rec {
  pname = "nested-multipart-parser";
  version = "1.5.0";
  pyproject = true;

  src = fetchFromGitHub {
    owner = "remigermain";
    repo = "nested-multipart-parser";
    rev = version;
    hash = "sha256-9IGfYb6mVGkoE/6iDg0ap8c+0vrBDKK1DxzLRyfeWOk=";
  };

  build-system = [
    setuptools-scm
    wheel
  ];

  pythonImportsCheck = [
    "nested_multipart_parser"
  ];

  meta = {
    description = "Parser for nested data for 'multipart/form";
    homepage = "https://github.com/remigermain/nested-multipart-parser";
    license = lib.licenses.mit;
    maintainers = with lib.maintainers; [ soyouzpanda ];
  };
}
