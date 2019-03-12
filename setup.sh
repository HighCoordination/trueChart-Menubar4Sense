#!/usr/bin/env bash

echo Installing dependencies...

ROOTDIR="$(pwd)"
MODDIR="$ROOTDIR/@highcoordination"

# -- install npm dependencies of @highcoordination modules

# $1 moduleName
function npmiModule {
	cd "$MODDIR/$1"
	npm i --production
}

npmiModule common-sense
npmiModule common-utils

# -- install dependencies and copy modules

cd "$ROOTDIR/tcmenu"
npm i

# -- return to the directory this script got started in

cd "$ROOTDIR"
npm i