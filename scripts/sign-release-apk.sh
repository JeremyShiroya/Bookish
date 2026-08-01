#!/usr/bin/env bash
# Sign a release APK so it can REPLACE an install signed with the old key.
#
# THE PROBLEM THIS SOLVES
# Android refuses to install an APK whose signing certificate differs from the
# one already installed. The only other way out is to uninstall first, and
# uninstalling takes the whole library with it — on this device that is ~635MB
# of books, covers and PDFs, most of which the JSON backup in Settings does not
# cover (it exports IndexedDB; the covers and PDFs live on the filesystem).
#
# APK Signature Scheme v3 has an answer: key rotation. A "lineage" file is proof,
# signed by the OLD key, that it authorises the NEW key. An APK signed with the
# new key AND carrying that lineage is accepted as an update to an app signed
# with the old one — no uninstall, nothing lost. Supported on Android 9+.
#
# So the debug key that signed the current install stays useful exactly once:
# to bless the real release key. After that, releases are signed with the release
# key and the lineage travels with every build.
#
# USAGE
#   1. Create a release keystore (once), from the repo root. Choose your own
#      password; it is never stored in this repo. keytool lives inside a JDK and
#      is usually not on PATH — on Windows use Android Studio's copy at
#      "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe":
#        keytool -genkeypair -v -keystore android/bookish-release.jks \
#          -alias bookish -keyalg RSA -keysize 4096 -validity 10000
#
#   2. Create the lineage (once), proving debug -> release:
#        ./scripts/sign-release-apk.sh rotate
#
#   3. Sign a built release APK with it (every release):
#        ./scripts/sign-release-apk.sh sign path/to/app-release-unsigned.apk
#
# Passwords are prompted for by keytool/apksigner themselves — this script never
# takes them as arguments, so they stay out of your shell history.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/AppData/Local/Android/Sdk}}"
DEBUG_KEYSTORE="${DEBUG_KEYSTORE:-$HOME/.android/debug.keystore}"
RELEASE_KEYSTORE="${RELEASE_KEYSTORE:-$ROOT/android/bookish-release.jks}"
RELEASE_ALIAS="${RELEASE_ALIAS:-bookish}"
LINEAGE="${LINEAGE:-$ROOT/android/signing-lineage.bin}"

die() { printf '\n  x %s\n\n' "$1" >&2; exit 1; }

# apksigner is a Java program, so it needs a JDK — and on a normal Android dev
# machine there is one (Android Studio bundles it) that is simply not on PATH.
# Finding it here means this script works out of the box instead of failing with
# "JAVA_HOME is not set" in the middle of a signing run.
ensure_java() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then return; fi
  if command -v java >/dev/null 2>&1; then return; fi

  local candidate
  for candidate in \
    "/c/Program Files/Android/Android Studio/jbr" \
    "/c/Program Files/Android/Android Studio/jre" \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/opt/android-studio/jbr" \
    "$HOME/Android/Studio/jbr"
  do
    if [ -x "$candidate/bin/java" ] || [ -x "$candidate/bin/java.exe" ]; then
      export JAVA_HOME="$candidate"
      return
    fi
  done

  die "No Java found. Install a JDK, or set JAVA_HOME (Android Studio bundles one, e.g. 'C:\\Program Files\\Android\\Android Studio\\jbr')."
}

ensure_java

find_tool() {
  local name="$1"
  local found
  found="$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1)${name}"
  [ -x "$found" ] || found="${found}.bat"
  [ -f "$found" ] || die "Could not find $name under $SDK/build-tools. Set ANDROID_SDK_ROOT."
  printf '%s' "$found"
}

APKSIGNER="$(find_tool apksigner)"
ZIPALIGN="$(find_tool zipalign)"

case "${1:-}" in
  rotate)
    [ -f "$DEBUG_KEYSTORE" ] || die "No debug keystore at $DEBUG_KEYSTORE — nothing to rotate FROM."
    [ -f "$RELEASE_KEYSTORE" ] || die "No release keystore at $RELEASE_KEYSTORE. Create it first (see the header of this script)."
    [ -f "$LINEAGE" ] && die "A lineage already exists at $LINEAGE. Delete it only if you are certain — regenerating breaks upgradeability from the old key."

    echo "Rotating: debug key -> release key"
    echo "The debug keystore password is 'android'; the release password is the one you chose."
    "$APKSIGNER" rotate \
      --out "$LINEAGE" \
      --old-signer --ks "$DEBUG_KEYSTORE" --ks-key-alias androiddebugkey \
      --new-signer --ks "$RELEASE_KEYSTORE" --ks-key-alias "$RELEASE_ALIAS"

    echo
    echo "Lineage written to $LINEAGE"
    echo "Keep it FOREVER and back it up with the keystore — without it, a release-signed"
    echo "build can never replace an install made with the old key."
    ;;

  sign)
    APK="${2:-}"
    [ -n "$APK" ] || die "Usage: $0 sign <path-to-unsigned-or-signed.apk>"
    [ -f "$APK" ] || die "No such APK: $APK"
    [ -f "$RELEASE_KEYSTORE" ] || die "No release keystore at $RELEASE_KEYSTORE."
    [ -f "$LINEAGE" ] || die "No lineage at $LINEAGE. Run '$0 rotate' first, or the APK will not install over the current one."

    ALIGNED="${APK%.apk}-aligned.apk"
    OUT="${APK%.apk}-signed.apk"

    # zipalign before signing: apksigner refuses to align afterwards, and an
    # unaligned APK wastes memory at runtime.
    "$ZIPALIGN" -f -p 4 "$APK" "$ALIGNED"

    # Both signers plus the lineage: the v3 block then carries the proof that
    # the old key authorised the new one.
    "$APKSIGNER" sign \
      --lineage "$LINEAGE" \
      --ks "$DEBUG_KEYSTORE" --ks-key-alias androiddebugkey \
      --next-signer --ks "$RELEASE_KEYSTORE" --ks-key-alias "$RELEASE_ALIAS" \
      --out "$OUT" \
      "$ALIGNED"

    rm -f "$ALIGNED"

    echo
    "$APKSIGNER" verify --print-certs --verbose "$OUT" | head -20
    echo
    echo "Signed: $OUT"
    echo "Install over the existing app with:  adb install -r \"$OUT\""
    ;;

  verify)
    APK="${2:-}"
    [ -f "$APK" ] || die "Usage: $0 verify <apk>"
    "$APKSIGNER" verify --print-certs --verbose "$APK"
    ;;

  *)
    sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
