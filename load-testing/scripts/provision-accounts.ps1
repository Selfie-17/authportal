<#
.SYNOPSIS
    Provisions generated dummy student accounts into AuthPortal.
.DESCRIPTION
    Idempotently registers dummy accounts via POST /api/auth/register.
    Accounts that already exist (HTTP 409) are safely skipped without modification.
.PARAMETER TargetUrl
    Base URL of the AuthPortal backend. Default is 'http://localhost:8080'.
.PARAMETER DataFile
    Path to the users dataset. Default is 'data/users.json'.
.PARAMETER BatchSize
    Concurrent batch size for requests. Default is 5.
.PARAMETER DelayMs
    Delay in milliseconds between batches. Default is 100.
.PARAMETER DryRun
    Validates dataset format without sending live network requests.
#>

param (
    [string]$TargetUrl = "http://localhost:8080",
    [string]$DataFile = "",
    [int]$BatchSize = 5,
    [int]$DelayMs = 100,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$JsScript = Join-Path $ScriptDir "provision-accounts.js"

if (-not $DataFile) {
    $DataFile = Join-Path $ProjectDir "data\users.json"
}

$ArgsList = @(
    $JsScript,
    "--target", $TargetUrl,
    "--data", $DataFile,
    "--batch", $BatchSize,
    "--delay", $DelayMs
)

if ($DryRun) {
    $ArgsList += "--dry-run"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Provisioning Dummy Accounts into AuthPortal" -ForegroundColor Green
Write-Host " Target URL:  $TargetUrl" -ForegroundColor Yellow
Write-Host " Data File:   $DataFile" -ForegroundColor Yellow
Write-Host " Batch Size:  $BatchSize" -ForegroundColor Yellow
Write-Host " Dry Run:     $($DryRun.IsPresent)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

& node $ArgsList
if ($LASTEXITCODE -ne 0) {
    Write-Error "Provisioning failed."
    exit $LASTEXITCODE
}
