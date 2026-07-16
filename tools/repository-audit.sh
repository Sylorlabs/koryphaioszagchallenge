#!/usr/bin/env bash
set -euo pipefail

root="${AUDIT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$root"
fail=0

record() {
  local name="$1" result="$2" detail="$3"
  printf '%s\t%s\t%s\n' "$name" "$result" "$detail"
  if [[ "$result" != pass ]]; then fail=1; fi
}

if [[ ! -d .git && ! -f .git ]]; then
  record repository fail not-a-git-worktree
  exit 1
fi

untracked="$(git ls-files --others --exclude-standard | rg '\.(zag|sh|md|json|toml|ya?ml|svg|png|desktop)$' || true)"
if [[ -n "$untracked" ]]; then
  record untracked-source fail source-like-files
  printf '%s\n' "$untracked" >&2
else
  record untracked-source pass none
fi

tracked_bad="$(git ls-files | rg '(^|/)(data|build)/|(^|/)\.active-port\.json$|(^|/)(credentials?|secrets?)\.json$|(^|/)[^/]*\.(db|sqlite|log|pem|key)$|(^|/)\.env$' || true)"
if [[ -n "$tracked_bad" ]]; then
  record tracked-runtime-secrets fail forbidden-paths
  printf '%s\n' "$tracked_bad" >&2
else
  record tracked-runtime-secrets pass none
fi

if [[ -f LICENSE && -f docs/PROVENANCE.md ]]; then
  record license-provenance pass present
else
  record license-provenance fail missing
fi

if git diff --check >/dev/null && git diff --cached --check >/dev/null; then
  record patch-hygiene pass clean
else
  record patch-hygiene fail whitespace-errors
fi

generated_dirty="$(git status --short | rg '(^| )docs/[^ ]*generated[^ ]*$|(^| )build/|(^| )data/' || true)"
if [[ -n "$generated_dirty" ]]; then
  record generated-output fail dirty
  printf '%s\n' "$generated_dirty" >&2
else
  record generated-output pass clean
fi

if [[ "${AUDIT_SKIP_TOOLCHAIN:-0}" != 1 ]]; then
  zag_dir="${ZAG_REPO:-$root/toolchain/zag}"
  znc="${ZNC:-$zag_dir/zag-poc/znc}"
  expected_commit="$(awk -F= '$1 == "zag_commit" { print $2 }' TOOLCHAIN.lock)"
  expected_source="$(awk -F= '$1 == "zag_ncodegen_sha256" { print $2 }' TOOLCHAIN.lock)"
  expected_binary="$(awk -F= '$1 == "znc_sha256" { print $2 }' TOOLCHAIN.lock)"
  expected_version="$(awk -F= '$1 == "znc_version" { sub(/^znc_version=/, ""); print }' TOOLCHAIN.lock)"

  if [[ -d "$zag_dir/.git" || -f "$zag_dir/.git" ]] &&
     [[ "$(git -C "$zag_dir" rev-parse HEAD)" == "$expected_commit" ]]; then
    record toolchain-commit pass pinned
  else
    record toolchain-commit fail drift-or-uninitialized
  fi

  actual_source="$(sha256sum "$zag_dir/zag-poc/selfhost/native/ncodegen.zag" 2>/dev/null | awk '{print $1}' || true)"
  if [[ "$actual_source" == "$expected_source" ]]; then
    record toolchain-source pass pinned
  else
    record toolchain-source fail drift
  fi

  actual_binary="$(sha256sum "$znc" 2>/dev/null | awk '{print $1}' || true)"
  actual_version="$($znc --version 2>/dev/null || true)"
  if [[ "$actual_binary" == "$expected_binary" && "$actual_version" == "$expected_version" ]]; then
    record toolchain-binary pass pinned
  else
    record toolchain-binary fail drift
  fi

  if [[ -z "$(git -C "$zag_dir" status --porcelain)" ]]; then
    record toolchain-worktree pass clean
  else
    record toolchain-worktree fail dirty
  fi
fi

exit "$fail"
