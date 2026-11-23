# Start the LifeLink local development stack and print helpful endpoints.
# Usage: .\project\scripts\dev.ps1
$ErrorActionPreference = 'Stop'

$dockerDir = Join-Path $PSScriptRoot '..\docker'
$envFile = Join-Path $dockerDir '.env'
$exampleFile = Join-Path $dockerDir '.env.example'

if (-not (Test-Path $envFile)) {
    Copy-Item $exampleFile $envFile
    Write-Host "Created $envFile from .env.example (DEV-ONLY defaults)."
}

Push-Location $dockerDir
try {
    Write-Host '==> Starting LifeLink compose stack...'
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed with exit code $LASTEXITCODE" }
    Write-Host ''
    Write-Host '==> Container status'
    docker compose ps
    Write-Host ''
    Write-Host '==> Useful URLs'
    Write-Host '  Frontend SPA      : http://localhost:5173'
    Write-Host '  Frontend health   : http://localhost:5173/healthz'
    Write-Host '  Backend API       : http://localhost:8080'
    Write-Host '  Backend Actuator* : http://localhost:8080/actuator/health'
    Write-Host '  (*) only if Spring Boot Actuator is enabled'
    Write-Host ''
    Write-Host "==> Health / log commands (run from $dockerDir)"
    Write-Host '  docker compose logs -f backend frontend'
    Write-Host '  docker compose exec -T db pg_isready -U lifelink -d lifelink'
    Write-Host '  docker compose exec -T redis redis-cli ping'
    Write-Host '  docker compose exec -T backend nc -z 127.0.0.1 8080'
    Write-Host '  docker compose down        # stop, keep data'
    Write-Host '  docker compose down -v     # stop and DELETE local data'
}
finally {
    Pop-Location
}
