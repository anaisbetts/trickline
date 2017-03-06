#!/bin/bash

set -ex
npm install
#npm test

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

electron-forge make

if [ -n "$SURF_ARTIFACT_DIR" ]; then
  cp $ROOT/out/make/* "$SURF_ARTIFACT_DIR"

  $ROOT/node_modules/.bin/xvfb-maybe $ROOT/script/run-perf-test.sh
fi
