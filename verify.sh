#!/usr/bin/env bash
# Single authority gate for the native rewrite.
set -euo pipefail
cd "$(dirname "$0")"

profile="${1:-foundation}"
znc="${ZNC:-$PWD/toolchain/zag/zag-poc/znc}"
fail=0

record() {
  local name="$1" result="$2" detail="$3"
  printf '%s\t%s\t%s\n' "$name" "$result" "$detail"
  if [[ "$result" != "pass" ]]; then fail=1; fi
}

if audit_output="$(tools/repository-audit.sh 2>/tmp/koryphaios-repository-audit.log)"; then
  record repository-audit pass tracked-source-secrets-provenance-toolchain-generated
else
  record repository-audit fail policy-violation
  printf '%s\n' "$audit_output" >&2
  sed -n '1,80p' /tmp/koryphaios-repository-audit.log >&2
fi

if tools/repository-audit-selftest.sh | rg -q 'repository-audit-selftest: PASS'; then
  record repository-audit-selftest pass negative-fixtures
else
  record repository-audit-selftest fail fixture-failure
fi

if [[ -x "$znc" ]]; then record compiler-path pass native; else record compiler-path fail missing; fi
expected="$(awk -F= '$1 == "znc_sha256" { print $2 }' TOOLCHAIN.lock)"
actual="$(sha256sum "$znc" | awk '{ print $1 }')"
if [[ "$expected" == "$actual" ]]; then record compiler-lock pass pinned; else record compiler-lock fail drift; fi

if git ls-files | rg '(^build/|^data/|\.db(-|$)|\.log$|^frontend/public/)' >/dev/null; then
  record git-hygiene fail tracked-generated-or-browser-artifact
else
  record git-hygiene pass clean
fi
if [[ -f LICENSE && -f docs/PROVENANCE.md ]]; then record provenance pass documented; else record provenance fail missing-license-or-provenance; fi

if "$znc" src/native/main.zag -o build/koryphaios --analyze-strict >/tmp/koryphaios-zag-build.log 2>&1; then
  record native-build pass strict
else
  record native-build fail strict-build
  sed -n '1,80p' /tmp/koryphaios-zag-build.log >&2
fi

if [[ -x build/koryphaios ]] && headless_output="$(build/koryphaios --headless-test)" &&
   printf '%s\n' "$headless_output" | rg -q 'session=create-reuse-force-rename-confirm-delete' &&
   printf '%s\n' "$headless_output" | rg -q 'knowledge=markdown-memory-rules'; then
  record native-headless pass contract-keyboard-pointer-session-lifecycle-knowledge-renderer
else
  record native-headless fail failed
fi

if "$znc" src/native/core_test.zag -o build/core_test --analyze-strict >/tmp/koryphaios-zag-core-build.log 2>&1 &&
   core_output="$(build/core_test)" &&
   printf '%s\n' "$core_output" | rg -q 'production chat fails closed before persistence' &&
   printf '%s\n' "$core_output" | rg -q 'Cline NDJSON snapshots stream once and persist assistant output' &&
   printf '%s\n' "$core_output" | rg -q 'Cline cancellation sends SIGTERM' &&
   printf '%s\n' "$core_output" | rg -q 'Cline timeout kills and reaps' &&
   printf '%s\n' "$core_output" | rg -q 'Codex selection executes JSONL' &&
   printf '%s\n' "$core_output" | rg -q 'memory and rules write through to authoritative Markdown' &&
   printf '%s\n' "$core_output" | rg -q 'test simulator persists user and assistant without estimated usage' &&
   printf '%s\n' "$core_output" | rg -q 'NATIVE CORE: ALL PASS'; then
  record native-core pass persistence-recovery-cline-and-codex-direct-exec-auth-stream-cancel-timeout-exact-usage-provider-fail-closed-session-settings-errors
else
  record native-core fail failed
  sed -n '1,80p' /tmp/koryphaios-zag-core-build.log >&2
fi

if "$znc" src/native/provider_codex_test.zag -o build/provider_codex_test --analyze-strict >/tmp/koryphaios-codex-build.log 2>&1 &&
   codex_output="$(build/provider_codex_test)" &&
   printf '%s\n' "$codex_output" | rg -q 'codex-provider: 10/10 passed'; then
  record codex-provider pass direct-exec-jsonl-auth-stderr-exit-cancel-exact-usage
else
  record codex-provider fail failed
  sed -n '1,80p' /tmp/koryphaios-codex-build.log >&2
fi

if "$znc" probe/x509test.zag -o build/x509test --analyze-strict >/tmp/koryphaios-x509-build.log 2>&1 &&
   x509_output="$(build/x509test)" &&
   printf '%s\n' "$x509_output" | rg -q 'X509 TESTS: 20 checks, 0 failed'; then
  record tls-x509-foundation pass strict-der-san-hostname-validity-tls13-leaf-fail-closed
else
  record tls-x509-foundation fail failed
  sed -n '1,80p' /tmp/koryphaios-x509-build.log >&2
fi

if "$znc" probe/x509chaintest.zag -o build/x509chaintest --analyze-strict >/tmp/koryphaios-x509-chain-build.log 2>&1 &&
   chain_output="$(build/x509chaintest)" &&
   printf '%s\n' "$chain_output" | rg -q 'X509 CHAIN TESTS: 16 checks, 0 failed'; then
  record tls-trust-store-foundation pass bounded-system-ca-constraints-direct-anchor-fail-closed
else
  record tls-trust-store-foundation fail failed
  sed -n '1,80p' /tmp/koryphaios-x509-chain-build.log >&2
fi

if "$znc" src/native/atspi_test.zag -o build/atspi_test --analyze-strict >/tmp/koryphaios-atspi-build.log 2>&1 &&
   atspi_output="$(build/atspi_test)" &&
   printf '%s\n' "$atspi_output" | rg -q 'NATIVE ACCESSIBILITY: 21 checks, 0 failed'; then
  record accessibility-foundation pass semantic-tree-focus-actions-dbus-discovery-fail-closed
else
  record accessibility-foundation fail failed
  sed -n '1,80p' /tmp/koryphaios-atspi-build.log >&2
fi

if "$znc" src/native/secret_storage_test.zag -o build/secret_storage_test --analyze-strict >/tmp/koryphaios-secret-build.log 2>&1 &&
   secret_output="$(build/secret_storage_test)" &&
   printf '%s\n' "$secret_output" | rg -q 'SECRET STORAGE: ALL PASS'; then
  record secret-storage-foundation pass encrypted-vault-aead-atomic-0600-secret-service-fail-closed
else
  record secret-storage-foundation fail failed
  sed -n '1,80p' /tmp/koryphaios-secret-build.log >&2
fi

migration_ok=1
if ! "$znc" src/native/migration_test.zag -o build/migration_test --analyze-strict >/tmp/koryphaios-migration-build.log 2>&1 ||
   ! build/migration_test | rg -q 'NATIVE MIGRATION: ALL PASS'; then
  migration_ok=0
fi
if ! "$znc" src/native/migration_recovery_test.zag -o build/migration_recovery_test --analyze-strict >/tmp/koryphaios-migration-recovery-build.log 2>&1 ||
   ! build/migration_recovery_test | rg -q 'NATIVE MIGRATION RECOVERY: ALL PASS'; then
  migration_ok=0
fi
if [[ "$migration_ok" == 1 ]]; then
  migration_root="$(mktemp -d /tmp/koryphaios-migration-cli.XXXXXX)"
  mkdir -p "$migration_root/project"
  if build/koryphaios --project "$migration_root/project" --migrate tests/fixtures/migration/portable-v0.json | rg -q 'migration: PASS migrated sessions=2 messages=3' &&
     build/koryphaios --project "$migration_root/project" --migrate tests/fixtures/migration/portable-v0.json | rg -q 'migration: PASS already-current'; then
    record migration-foundation pass validation-backup-atomic-idempotent-cli
  else
    record migration-foundation fail cli-integration
  fi
  rm -rf "$migration_root"
else
  record migration-foundation fail unit-or-recovery
  sed -n '1,80p' /tmp/koryphaios-migration-build.log >&2
  sed -n '1,80p' /tmp/koryphaios-migration-recovery-build.log >&2
fi

if rg -n -i 'coming soon|placeholder|fake provider|estimated tokens' src/native >/tmp/koryphaios-placeholder-audit.log; then
  record placeholder-audit fail forbidden-native-placeholder
  sed -n '1,40p' /tmp/koryphaios-placeholder-audit.log >&2
else
  record placeholder-audit pass no-forbidden-markers
fi

if rg -n -- '--yolo|--act|workspace-write|danger-full-access|auto-approve[^\n]*true' src/native src/backend \
   >/tmp/koryphaios-security-preset-audit.log; then
  record security-preset-audit fail unconfirmed-dangerous-provider-policy
  sed -n '1,40p' /tmp/koryphaios-security-preset-audit.log >&2
else
  record security-preset-audit pass cline-plan-only-codex-read-only
fi

if rg -n 'http_server_make|frontend/public|/api/|WebSocket UI' src/native |
   rg -v 'No HTTP server|No UI action|No HTTP listener|No HTTP or WebSocket' >/tmp/koryphaios-browser-audit.log; then
  record browser-boundary fail browser-transport-reference
  sed -n '1,40p' /tmp/koryphaios-browser-audit.log >&2
else
  record browser-boundary pass in-process-only
fi

capture_ok=1
for spec in "1024 640 1" "1280 720 1" "1440 900 1" "1280 800 2"; do
  read -r w h scale <<<"$spec"
  path="/tmp/koryphaios-native-$w-$h-$scale.bmp"
  if ! build/koryphaios --capture "$path" --width "$w" --height "$h" --scale "$scale" >/dev/null ||
     ! file "$path" | rg -q "$w x $h"; then
    capture_ok=0
  fi
done
if [[ "$capture_ok" == 1 ]]; then record deterministic-captures pass four-resolutions-including-hidpi; else record deterministic-captures fail capture-error; fi

capture_a="/tmp/koryphaios-native-determinism-a.bmp"
capture_b="/tmp/koryphaios-native-determinism-b.bmp"
build/koryphaios --capture "$capture_a" --width 1024 --height 640 >/dev/null
build/koryphaios --capture "$capture_b" --width 1024 --height 640 >/dev/null
if cmp -s "$capture_a" "$capture_b"; then record capture-determinism pass byte-identical; else record capture-determinism fail changed-pixels; fi

if tools/package-selftest.sh | rg -q 'package-selftest: PASS'; then
  record packaging-foundation pass static-checksums-install-launch-uninstall
else
  record packaging-foundation fail package-selftest
fi

if performance_output="$(tools/performance-gate.sh build/koryphaios)"; then
  record performance-foundation pass "$(printf '%s' "$performance_output" | sed 's/^performance-gate: PASS //')"
else
  record performance-foundation fail threshold
fi

case "$profile" in
  foundation) ;;
  release)
    record parity fail unresolved-native-workflows
    record tls-pki fail x509-chain-validation-not-implemented
    record secret-service fail encrypted-live-item-operations-not-implemented
    record migration-completeness fail sqlite-and-remaining-domains-not-implemented
    record accessibility fail atspi-object-server-events-and-live-client-proof-not-implemented
    record performance-live fail x11-idle-cpu-and-p95-input-latency-not-proven
    record packaging fail signed-update-manifest-not-provisioned
    ;;
  *)
    record invocation fail unknown-profile
    ;;
esac

if (( fail )); then exit 1; fi
