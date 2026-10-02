<#
.SYNOPSIS
  AI-MOS PostgreSQL Automated Restore Script
.DESCRIPTION
  Restores a specified backup file (or the latest backup) into the aimosdb database.
.PARAMETER FilePath
  Optional path to the .dump file to restore. If omitted, uses the latest backup in the backups folder.
#>

param(
    [string]$FilePath
)

$ErrorActionPreference = "Stop"

$containerName = "ai-mos-postgres"
$dbUser = "aimosuser"
$dbName = "aimosdb"
$backupDir = Join-Path $PSScriptRoot "..\backups"

# If no file specified, pick latest
if (!$FilePath) {
    $latest = Get-ChildItem -Path $backupDir -Filter "*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (!$latest) {
        Write-Error "No backup files found in $backupDir."
        exit 1
    }
    $FilePath = $latest.FullName
}

if (!(Test-Path $FilePath)) {
    Write-Error "Backup file not found at: $FilePath"
    exit 1
}

$fileName = Split-Path $FilePath -Leaf
$containerTmp = "/tmp/$fileName"

Write-Host "[*] Restoring PostgreSQL database from '$fileName'..." -ForegroundColor Cyan

# Copy file into container
docker cp $FilePath "${containerName}:${containerTmp}"

# Run pg_restore with --clean and --if-exists
docker exec $containerName pg_restore -U $dbUser -d $dbName --clean --if-exists -v $containerTmp
docker exec $containerName rm -f $containerTmp

Write-Host "[+] Database restore completed successfully!" -ForegroundColor Green
