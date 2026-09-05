#!/bin/sh
set -eu
cd "$(dirname "$0")"
: "${JAVA_HOME:=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export JAVA_HOME
mkdir -p .tooling/signing dist
if [ ! -f .tooling/signing/release.jks ]; then
  umask 077
  openssl rand -base64 32 > .tooling/signing/password
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore .tooling/signing/release.jks -storepass:file .tooling/signing/password -keypass:file .tooling/signing/password -alias borrius -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Borrius Courier, O=Personal' >/dev/null 2>&1
fi
.tooling/gradle-8.13/bin/gradle assembleRelease --console plain
.tooling/sdk/build-tools/35.0.0/zipalign -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk dist/borrius-courier-aligned.apk
.tooling/sdk/build-tools/35.0.0/apksigner sign --ks .tooling/signing/release.jks --ks-pass file:.tooling/signing/password --out dist/borrius-courier.apk dist/borrius-courier-aligned.apk
.tooling/sdk/build-tools/35.0.0/apksigner verify dist/borrius-courier.apk
rm dist/borrius-courier-aligned.apk
