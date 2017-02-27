#!/bin/bash

set -ex
npm install
npm test

electron-forge make

if [ -z "$SURF_ARTIFACT_DIR" ]; then
	mv ./out/make/* "$SURF_ARTIFACT_DIR"
fi
