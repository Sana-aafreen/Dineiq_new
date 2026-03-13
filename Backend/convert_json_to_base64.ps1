# Helper script to convert JSON files to Base64 for Render deployment
# Run this script in PowerShell from the Backend directory

Write-Host "Converting JSON files to Base64..." -ForegroundColor Green
Write-Host ""

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if files exist
$serviceAccountFile = Join-Path $scriptDir "dineIQ_service_account.json"
$gmailOAuthFile = Join-Path $scriptDir "dineIQ_gmail_OAuth_Credentials.json"

if (Test-Path $serviceAccountFile) {
    Write-Host "Converting $serviceAccountFile..." -ForegroundColor Yellow
    $base64ServiceAccount = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($serviceAccountFile))
    Write-Host ""
    Write-Host "SERVICE_ACCOUNT_JSON_BASE64:" -ForegroundColor Cyan
    Write-Host $base64ServiceAccount
    Write-Host ""
}
else {
    Write-Host "ERROR: dineIQ_service_account.json not found in Backend directory!" -ForegroundColor Red
    Write-Host "Looking for: $serviceAccountFile" -ForegroundColor Yellow
}

if (Test-Path $gmailOAuthFile) {
    Write-Host "Converting $gmailOAuthFile..." -ForegroundColor Yellow
    $base64GmailOAuth = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($gmailOAuthFile))
    Write-Host ""
    Write-Host "GMAIL_OAUTH_JSON_BASE64:" -ForegroundColor Cyan
    Write-Host $base64GmailOAuth
    Write-Host ""
}
else {
    Write-Host "ERROR: dineIQ_gmail_OAuth_Credentials.json not found in Backend directory!" -ForegroundColor Red
    Write-Host "Looking for: $gmailOAuthFile" -ForegroundColor Yellow
}

Write-Host "Copy the above base64 strings and add them as environment variables in Render!" -ForegroundColor Green
