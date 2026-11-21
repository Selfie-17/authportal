<#
.SYNOPSIS
    Safe cleanup utility for AuthPortal dummy load-test accounts.
.DESCRIPTION
    Strictly targets dummy student accounts matching ^n\d{6}@rguktn\.ac\.in$.
    Never touches administrators, teachers, or non-matching student accounts.
    Requires explicit typing of 'CONFIRM' before execution.
.PARAMETER SqlOnly
    Switch to generate SQL cleanup script without modifying the database.
.PARAMETER TargetUrl
    Backend target URL.
#>

param (
    [switch]$SqlOnly,
    [string]$TargetUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$JsScript = Join-Path $ScriptDir "cleanup-dummy-accounts.js"
$DataFile = Join-Path $ProjectDir "data\users.json"

Write-Warning "======================================================================"
Write-Warning "CAUTION: This will clean up dummy test accounts matching ^n\d{6}@rguktn.ac.in$."
Write-Warning "Faculty, admin accounts, and real users will NOT be affected."
Write-Warning "======================================================================"

if ($SqlOnly) {
    & node $JsScript --sql-only --data $DataFile
    exit 0
}

$Confirmation = Read-Host "Type 'CONFIRM' to proceed with dummy account cleanup"
if ($Confirmation -ne "CONFIRM") {
    Write-Host "Cleanup aborted by user." -ForegroundColor Yellow
    exit 0
}

& node $JsScript --confirm --target $TargetUrl --data $DataFile
Write-Host "`nCleanup script generated / completed safely!" -ForegroundColor Green
