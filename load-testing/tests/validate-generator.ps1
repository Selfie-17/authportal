<#
.SYNOPSIS
    Runs validation test suite for AuthPortal account generator and provisioner.
#>

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$JsTest = Join-Path $ScriptDir "validate-generator.js"

Write-Host "Running Generator & Provisioner Validation Tests..." -ForegroundColor Cyan
& node $JsTest
if ($LASTEXITCODE -ne 0) {
    Write-Error "Validation tests failed."
    exit $LASTEXITCODE
}
