#!/bin/bash

set -ex
npm install

if [ "$(uname)" = "Darwin" ];
then
  npm test
fi

electron-forge make
