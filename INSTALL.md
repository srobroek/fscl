# Verify and install this fork

Download the `fscl-<full-commit>` artifact from a successful Compatibility build in https://github.com/srobroek/fscl/actions. Actions artifacts expire after 90 days; retain a verified copy. This workflow does not publish to npm or create a GitHub release.

Check COMMIT.txt against the run's full head SHA and BUILD.txt against its run URL. Verify the tarball with `sha256sum -c SHA256SUMS` on Linux or `Get-FileHash -Algorithm SHA256 .\fscl-*.tgz` on PowerShell, comparing the resulting hash to SHA256SUMS. The checksum proves byte identity to this build, not independent publisher attestation. The archive includes the synthetic sync receipt, lockfile, build Node version and resolved test-server image digest.

Use Node >=22 (CI tests Node 22 and 24 on Windows and Linux). Install into a NEW versioned directory first:

```powershell
npm install --prefix <new-version-directory> <absolute-path-to-verified-tarball>
node <new-version-directory>/node_modules/fscl/dist/index.js --version
```

The tarball contains built JavaScript, not native dependencies. Installation downloads runtime dependencies; npm installation of a tarball resolves dependency ranges again rather than enforcing the accompanying source lockfile. A native SQLite build may require Python and a C++ toolchain if prebuilt binaries are unavailable. For an exact source dependency tree, check out COMMIT.txt, use `npm ci` with the supplied lockfile, and build. Do not install globally or replace an in-use CLI during ingestion. Coordinate the switch after the writer is idle, preserving its existing launcher and installation directory. Do not change server, budget, credentials or data paths as part of installation.

Rollback: restore the previous launcher/PATH selection and keep using the preserved previous installation. This is a CLI-only rollback; it does not restore or reverse budget changes. No data migration is performed by these installation steps.

## Compatibility limits

- The prompt probe checks synthetic punctuation, Unicode, boundary spaces and bracketed paste. fscl previously trimmed passwords in login and setup; this fork preserves them exactly. A reported Windows terminal-specific special-character corruption was not reproduced with simulated streams. This test does not certify every terminal or clipboard path. Never record or probe a real password.
- Rule modes differ in `src/commands/rules.ts`: single-rule preview emulates a subset of actions, skipping template/formula set actions and `payee_name`; single-rule apply delegates to native `rule-apply-actions`. All-rules mode delegates evaluation to native `rules-run`, but persists only category, payee ID, notes and cleared diffs, omitting `payee_name`. The pinned native engine compiles Handlebars templates and supports `payee_name`; do not assume fscl previews or persistence are equivalent to the native UI, especially for regex capture templates. This fork documents these inherited gaps without changing rule execution.
- Inherited budget initialization can sync feature preferences even on nominal read commands. Do not assume live reads are non-mutating.
- Synthetic integration runs against a disposable Actual 26.10.0 server on loopback port 15007, refuses an initialized server, and verifies upload, writes, independent-client pull and incremental sync. It does not test a private budget.
