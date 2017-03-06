#!/bin/bash

set -x

SCRIPTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT="$SCRIPTDIR/.."

if [ -n "$SURF_ARTIFACT_DIR" ]; then
  SURF_ARTIFACT_DIR="$ROOT"
fi

TRICKLINE_BIN="$( $ROOT/node_modules/.bin/ts-node ./script/find-trickline-exe.ts)"

export TRICKLINE_HEAPSHOT_AND_BAIL=1

if ! timeout -t 30s -- $TRICKLINE_BIN; then
  if [ "$(uname)" = "Darwin" ]; then
    screencapture $SURF_ARTIFACT_DIR/screenshot.png
  else
    import -window root $SURF_ARTIFACT_DIR/screenshot.png
  fi

  exit 1
fi

set -e

$ROOT/node_modules/.bin/bigrig -f $SURF_ARTIFACT_DIR/trickline-timeline*.json > $SURF_ARTIFACT_DIR/bigrig.json
$ROOT/node_modules/.bin/bigrig -f $SURF_ARTIFACT_DIR/trickline-timeline*.json --pretty-print
