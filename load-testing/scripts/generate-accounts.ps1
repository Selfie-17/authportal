<#
.SYNOPSIS
    Generates dummy student accounts for AuthPortal k6 load testing.
.DESCRIPTION
    Creates sequential, properly-formatted test accounts matching RGUKT institutional format
    (e.g., n000001@rguktn.ac.in, Academic ID: N000001) and saves them to data/users.json.
.PARAMETER Count
    Number of accounts to generate (e.g. 50, 100, 500, 1000). Default is 100.
.PARAMETER StartId
    Starting sequential number. Default is 1.
.PARAMETER Prefix
    Prefix letter. Default is 'n'.
.PARAMETER Domain
    Email domain. Default is 'rguktn.ac.in'.
.PARAMETER Password
    Password for dummy accounts (8-100 characters). Default is 'Password123!'.
.PARAMETER OutputFile
    Destination JSON path. Default is 'data/users.json'.
.PARAMETER GenerateSql
    Switch to also generate an idempotent SQL seed file.
#>

param (
    [int]$Count = 100,
    [int]$StartId = 1,
    [string]$Prefix = "n",
    [string]$Domain = "rguktn.ac.in",
    [string]$Password = "Password123!",
    [string]$OutputFile = "",
    [switch]$GenerateSql
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$JsScript = Join-Path $ScriptDir "generate-accounts.js"

if (-not $OutputFile) {
    $OutputFile = Join-Path $ProjectDir "data\users.json"
}

$ArgsList = @(
    $JsScript,
    "--count", $Count,
    "--start-id", $StartId,
    "--prefix", $Prefix,
    "--domain", $Domain,
    "--password", $Password,
    "--output", $OutputFile
)

if ($GenerateSql) {
    $ArgsList += "--sql"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " AuthPortal Test Account Generator" -ForegroundColor Green
Write-Host " Count:       $Count" -ForegroundColor Yellow
Write-Host " Start ID:    $StartId" -ForegroundColor Yellow
Write-Host " Domain:      $Domain" -ForegroundColor Yellow
Write-Host " Output:      $OutputFile" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

& node $ArgsList
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate accounts."
    exit $LASTEXITCODE
}

Write-Host "`nAccount generation completed successfully!" -ForegroundColor Green
