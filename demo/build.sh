#!/usr/bin/env bash
# Rebuild the PawSnap demo from the team's front end plus the in-browser Firebase stand-in.
# Usage: demo/build.sh [workdir]   ->  output in <workdir>/app/build
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-$HERE/.work}"
rm -rf "$WORK" && mkdir -p "$WORK"
git clone -q https://github.com/MawinSkalet/Petsnaps "$WORK/app"
cd "$WORK/app"
git checkout -q a132e1d                        # final team commit, 29 Oct 2025
mkdir -p demo
cp -r "$HERE/firebase-shim" "$HERE/make_art.py" demo/
cp "$HERE/DemoBar.js" src/
git apply "$HERE/app.patch"
python3 demo/make_art.py >/dev/null
python3 - <<'PY' || true
from PIL import Image
Image.open("public/Pawsnap.png").convert("RGBA").save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
PY
npm install --no-audit --no-fund --loglevel=error
CI=false npx react-scripts build
echo "Built: $WORK/app/build"
