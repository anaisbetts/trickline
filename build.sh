#!/bin/bash

set -ex
npm install
npm test

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

#electron-forge make
electron-forge package

if [ -n "$SURF_ARTIFACT_DIR" ]; then
	#cp $ROOT/out/make/* "$SURF_ARTIFACT_DIR"

	TRICKLINE_BIN="$( $ROOT/node_modules/.bin/ts-node ./script/find-trickline-exe.ts)"
	TRICKLINE_HEAPSHOT_AND_BAIL=1 $ROOT/node_modules/.bin/xvfb-maybe $TRICKLINE_BIN

	$ROOT/node_modules/.bin/bigrig -f $SURF_ARTIFACT_DIR/trickline-timeline*.json > $SURF_ARTIFACT_DIR/bigrig.json
	$ROOT/node_modules/.bin/bigrig -f $SURF_ARTIFACT_DIR/trickline-timeline*.json --pretty-print
fi