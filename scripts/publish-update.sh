#!/usr/bin/env bash
# One command for an over-the-air update to every live app version.
#
#   scripts/publish-update.sh "What changed"
#
# Builds from 1.1.5 on use the "fingerprint" runtime policy: versions that share native code share
# one runtime, so a single publish reaches them all. Versions built before that (listed in
# scripts/legacy-runtimes.txt) each have their own runtime and get their own publish, done here by
# pinning runtimeVersion for that one run. app.json is restored after every pass.
#
# Only for JavaScript changes. A change to native code (a new native module, app.json plugins,
# icons, splash) needs a new App Store build, and must not be pushed to the legacy runtimes.
set -uo pipefail
cd "$(dirname "$0")/.."
MSG="${1:?Usage: scripts/publish-update.sh \"message\"}"
LOGDIR="$(mktemp -d)"
cp app.json "$LOGDIR/app.json.orig"
restore() { cp "$LOGDIR/app.json.orig" app.json; }
trap restore EXIT

publish() { # $1 = label
  local log="$LOGDIR/$1.log"
  npx eas-cli update --branch production --environment production --message "$MSG" --non-interactive >"$log" 2>&1
  local rc=$?
  local group runtime
  group=$(grep -m1 "Update group ID" "$log" | awk '{print $NF}')
  runtime=$(grep -m1 "Runtime version" "$log" | awk '{print $NF}')
  if [ $rc -eq 0 ] && [ -n "$group" ]; then
    echo "  ok   $1 (runtime $runtime, group $group)"
  else
    echo "  FAIL $1 (exit $rc) — log: $log"; FAILED=1
  fi
}

FAILED=0
echo "Publishing: $MSG"
publish current
for v in $(grep -v '^\s*#' scripts/legacy-runtimes.txt | grep -v '^\s*$'); do
  restore
  python3 - "$v" <<'PY'
import json, sys
p = "app.json"
d = json.load(open(p))
d["expo"]["runtimeVersion"] = sys.argv[1]
# The version too, so anything reading it in the app sees the binary's own number, as before.
d["expo"]["version"] = sys.argv[1]
json.dump(d, open(p, "w"), indent=2)
open(p, "a").write("\n")
PY
  publish "$v"
done
restore
[ $FAILED -eq 0 ] && echo "All published." || { echo "Some publishes failed."; exit 1; }
