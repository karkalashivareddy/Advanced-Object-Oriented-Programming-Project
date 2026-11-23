# Continuous Integration (GitHub Actions)

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

## Updating the workflow

Edit `project/deployment/github-actions.yml`, re-run the copy command above, and
commit both the template and the installed root copy so they stay in sync.
