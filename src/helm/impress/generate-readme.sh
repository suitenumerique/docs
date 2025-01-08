#!/bin/bash

docker image ls | grep readme-generator-for-helm
if [ "$?" -ne "0" ]; then
  git clone https://github.com/bitnami/readme-generator-for-helm.git /tmp/readme-generator-for-helm
  cd /tmp/readme-generator-for-helm
  docker build -t readme-generator-for-helm:latest .
  cd $(dirname -- "${BASH_SOURCE[0]}")
fi
docker run --rm -it -v .:/source -w /source readme-generator-for-helm:latest readme-generator -v values.yaml -r README.md
