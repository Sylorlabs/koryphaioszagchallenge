#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
audit="$repo_root/tools/repository-audit.sh"
tmp="$(mktemp -d /tmp/koryphaios-audit.XXXXXX)"
trap 'rm -rf "$tmp"' EXIT

cd "$tmp"
git init -q
git config user.email audit@example.invalid
git config user.name 'Repository Audit'
mkdir -p docs
printf 'test license\n' > LICENSE
printf 'test provenance\n' > docs/PROVENANCE.md
git add LICENSE docs/PROVENANCE.md
git commit -qm baseline

AUDIT_ROOT="$tmp" AUDIT_SKIP_TOOLCHAIN=1 "$audit" >/tmp/koryphaios-audit-clean.out

printf 'fn main() i32 { return 0; }\n' > forgotten.zag
if AUDIT_ROOT="$tmp" AUDIT_SKIP_TOOLCHAIN=1 "$audit" >/tmp/koryphaios-audit-untracked.out 2>&1; then
  echo 'repository-audit-selftest: FAIL untracked source accepted' >&2
  exit 1
fi
rm forgotten.zag

printf '{"apiKey":"must-not-be-tracked"}\n' > credentials.json
git add credentials.json
if AUDIT_ROOT="$tmp" AUDIT_SKIP_TOOLCHAIN=1 "$audit" >/tmp/koryphaios-audit-secret.out 2>&1; then
  echo 'repository-audit-selftest: FAIL tracked credentials accepted' >&2
  exit 1
fi

echo 'repository-audit-selftest: PASS clean-accept untracked-reject secret-reject'
