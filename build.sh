#!/bin/bash

set -ex
npm install
npm test
electron-forge make
