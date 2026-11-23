# Continuous Integration (GitHub Actions)

Date: 2026-11-23
Status: **CI is not installed and has not run.** Root `.github/workflows` is intentionally absent, and `project/deployment/github-actions.yml` is a template only. Installing it is a Git-state change outside the permitted `project/` documentation scope, so CI is documented here only as a deployment step; no GitHub Actions result is claimed anywhere in these docs. The commands below are local verification commands plus installation instructions for a future coordinator.

## Where GitHub looks for workflows

GitHub Actions **only** discovers workflow files at the repository root in
`.github/workflows/`. A YAML file placed in `project/deployment/` is a template
and will never run by itself. This repository policy intentionally keeps the
root `.github/` directory out of the project subtree, so the workflow is stored
here and installed explicitly.

## Install the workflow (exact command)

From the **repository root** (the directory containing this `project/` folder):

```bash
mkdir -p .github/workflows && cp project/deployment/github-actions.yml .github/workflows/lifelink-ci.yml
```

Commit the installed copy under `.github/workflows/lifelink-ci.yml`. After that,
GitHub will run it on pushes to `main`, `master`, `develop` and on pull requests.

Windows PowerShell equivalent:

```powershell
New-Item -ItemType Directory -Force -Path .github/workflows | Out-Null
Copy-Item project/deployment/github-actions.yml .github/workflows/lifelink-ci.yml
```

## What the pipeline does

| Job | Toolchain | Command(s) |
| --- | --- | --- |
| `backend` | Temurin JDK 21, Maven wrapper | `chmod +x ./mvnw`, then `./mvnw -B verify` |
| `frontend` | Node 24 | `npm ci`, `npm run build`, `npm test` (`CI=true`) |
| `security` | Trivy filesystem scan | SARIF report uploaded to the Security tab; High/Critical findings fail the job |

`defaults.run.working-directory` is `project/backend` and `project/frontend`
respectively, so the commands run from the correct subprojects.

The security job uses `exit-code: '1'` — findings are **not** hidden with
`continue-on-error`. The SARIF upload step uses `if: always()` so results are
still visible in GitHub even when the scan fails the build. The job needs the
`security-events: write` permission for that upload.

## Local equivalents before installation

These are the commands the template mirrors; detailed local results are maintained by the quality workstream in [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md):

```bash
# backend
cd project/backend && ./mvnw -B verify       # Windows: .\mvnw.cmd -B verify

# frontend
cd project/frontend && npm ci && CI=true npm run build && CI=true npm test
```

Additional local checks recorded for the final Phase 2 run (not part of the CI
template): backend 93 tests with 0 failures/errors/skips, frontend 33 unit tests,
Playwright 6 passed on Chrome and Edge with retries 0
([`../evidence/PLAYWRIGHT_RESULTS.json`](../evidence/PLAYWRIGHT_RESULTS.json)),
and the standalone SockJS/STOMP smoke test (`npm run test:stomp`,
[`../evidence/STOMP_SMOKE_RESULT.json`](../evidence/STOMP_SMOKE_RESULT.json)).
Browser E2E can be repeated with `npm run test:e2e` from `project/frontend`.

## Updating the workflow

Edit `project/deployment/github-actions.yml`, re-run the copy command above, and
commit both the template and the installed root copy so they stay in sync. Installing and committing the workflow is a Git-state change and is deliberately left to the project coordinator; this documentation work does not perform it.
