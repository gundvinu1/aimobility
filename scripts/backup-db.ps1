<#
.SYNOPSIS
  AI-MOS PostgreSQL Automated Backup Script
.DESCRIPTION
  Creates a timestamped compressed backup of the aimosdb PostgreSQL database
  running inside the Docker container.
#>

$ErrorActionPreference = "Stop"

$containerName = "ai-mos-postgres"
$dbUser = "aimosuser"
$dbName = "aimosdb"
$backupDir = Join-Path $PSScriptRoot "..\backups"

if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

# Verify container is running
$running = docker ps --filter "name=$containerName" --filter "status=running" -q
if (!$running) {
    Write-Error "Container '$containerName' is not running. Please start it with 'docker compose up -d'."
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFileName = "aimosdb_$timestamp.dump"
$dumpFilePath = Join-Path $backupDir $dumpFileName
$containerTmp = "/tmp/$dumpFileName"

Write-Host "[*] Creating PostgreSQL backup for database '$dbName'..." -ForegroundColor Cyan

# Run pg_dump inside container
docker exec $containerName pg_dump -U $dbUser -d $dbName -F c -b -f $containerTmp
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed."
    exit 1
}

# Copy from container to host
docker cp "${containerName}:${containerTmp}" $dumpFilePath
docker exec $containerName rm -f $containerTmp

$fileSize = (Get-Item $dumpFilePath).Length / 1KB
$roundedSize = [math]::Round($fileSize, 2)
Write-Host "[+] Backup completed successfully!" -ForegroundColor Green
Write-Host "File: $dumpFilePath"
Write-Host "Size: $roundedSize KB"
