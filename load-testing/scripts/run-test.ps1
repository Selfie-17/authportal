<#
.SYNOPSIS
    Automated execution runner for AuthPortal k6 load testing suite.
.DESCRIPTION
    Executes specified k6 test scripts with safety verification, environment targeting,
    and structured JSON/HTML summary reporting in load-testing/results/.
.PARAMETER TestName
    Name or number of the test script to execute (e.g. "01", "baseline", "02-normal-usage-test.js").
.PARAMETER Environment
    Target environment: "local", "staging", or "production". Defaults to "local".
.PARAMETER BaseUrl
    Optional custom base URL override.
.PARAMETER Mode
    Workload mode for tests supporting multiple profiles (e.g. "student-only" or "blended"). Defaults to "student-only".
#>

param (
    [string]$TestName = "01-baseline-test.js",
    [ValidateSet("local", "staging", "production")]
    [string]$Environment = "local",
    [string]$BaseUrl = "",
    [ValidateSet("student-only", "blended", "diagnostic")]
    [string]$Mode = "student-only"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$K6Path = Join-Path $ProjectDir "bin\k6.exe"
$TestsDir = Join-Path $ProjectDir "tests"
$ResultsDir = Join-Path $ProjectDir "results"

if (-not (Test-Path $K6Path)) {
    Write-Error "k6 binary not found at $K6Path. Please verify installation."
    exit 1
}

# Resolve test file
$TargetFile = ""
if (Test-Path (Join-Path $TestsDir $TestName)) {
    $TargetFile = Join-Path $TestsDir $TestName
} else {
    $Matched = Get-ChildItem -Path $TestsDir -Filter "*$TestName*.js" | Select-Object -First 1
    if ($Matched) {
        $TargetFile = $Matched.FullName
    } else {
        Write-Error "Could not find any test file matching '$TestName' in $TestsDir"
        exit 1
    }
}

# Safety Confirmation for non-local environments
if ($Environment -ne "local") {
    Write-Warning "======================================================================"
    Write-Warning "CAUTION: Target environment is set to '$Environment'."
    Write-Warning "Ensure you have authorization to run load testing against this domain."
    Write-Warning "======================================================================"
    $Confirm = Read-Host "Type 'CONFIRM' to proceed with load testing against $Environment"
    if ($Confirm -ne "CONFIRM") {
        Write-Host "Execution aborted by user." -ForegroundColor Yellow
        exit 0
    }
}

if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TestBaseName = [System.IO.Path]::GetFileNameWithoutExtension($TargetFile)
$ResultJson = Join-Path $ResultsDir "$($TestBaseName)_$($Environment)_$Timestamp.json"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running Load Test: $TestBaseName" -ForegroundColor Green
Write-Host " Environment:       $Environment" -ForegroundColor Green
Write-Host " Workload Mode:     $Mode" -ForegroundColor Green
if ($BaseUrl) {
    Write-Host " Base URL:          $BaseUrl" -ForegroundColor Green
}
Write-Host " Test File:         $TargetFile" -ForegroundColor Gray
Write-Host " Output JSON:       $ResultJson" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

$EnvArgs = @("-e", "TARGET_ENV=$Environment", "-e", "WORKLOAD_MODE=$Mode")
if ($BaseUrl) {
    $EnvArgs += @("-e", "BASE_URL=$BaseUrl")
}

& $K6Path run @EnvArgs --summary-export=$ResultJson $TargetFile
$ExitCode = $LASTEXITCODE

if ($ExitCode -eq 0) {
    Write-Host "`nTest completed successfully within SLO thresholds!" -ForegroundColor Green
} else {
    Write-Host "`nTest finished with threshold alerts or errors (Exit code: $ExitCode)." -ForegroundColor Yellow
}
