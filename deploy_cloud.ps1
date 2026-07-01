# NITDEM Cloud Deployment Orchestration Script
# This script guides you through logging in to your new GCP/Firebase account and deploying the services.

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   NITDEM CLOUD DEPLOYMENT INITIALIZATION  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Choose Action
Write-Host "1. Deploy Python STGNN Model API to Google Cloud Run"
Write-Host "2. Deploy Vite Frontend Website to Firebase Hosting"
Write-Host "3. Deploy Both"
$choice = Read-Host "Select an option (1, 2, or 3)"

$originalDir = Get-Location

if ($choice -eq "1" -or $choice -eq "3") {
    Write-Host "`n[STEP 1] Google Cloud Platform Deployment..." -ForegroundColor Green
    Write-Host "Please login to your NEW Google Cloud account in the browser." -ForegroundColor Yellow
    gcloud auth login

    $projectId = Read-Host "Enter your Google Cloud Project ID (e.g. nitdem-traffic-monitoring)"
    if (-not $projectId) {
        Write-Host "Project ID is required. Skipping GCP deployment." -ForegroundColor Red
    } else {
        gcloud config set project $projectId
        
        Write-Host "`nBuilding and deploying STGNN model to Cloud Run..." -ForegroundColor Green
        # Navigate to ML_Model directory
        Set-Location "$originalDir/ML_Model"
        
        gcloud run deploy stgnn-traffic-api `
            --source . `
            --port 8080 `
            --allow-unauthenticated `
            --set-env-vars="GCS_INPUT_BUCKET=input_parameters,GCS_OUTPUT_BUCKET=output_measures" `
            --region asia-south1
            
        Set-Location $originalDir
        Write-Host "`nSTGNN Inference API deployment command complete." -ForegroundColor Green
    }
}

if ($choice -eq "2" -or $choice -eq "3") {
    Write-Host "`n[STEP 2] Firebase Hosting Frontend Deployment..." -ForegroundColor Green
    Write-Host "Please login to your NEW Firebase account in the browser." -ForegroundColor Yellow
    firebase login --reauth

    Write-Host "`nBuilding the production frontend bundle..." -ForegroundColor Green
    npm run build

    Write-Host "`nInitializing Firebase hosting configuration..." -ForegroundColor Green
    firebase use --add

    Write-Host "`nDeploying to Firebase Hosting..." -ForegroundColor Green
    firebase deploy
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "       DEPLOYMENT ATTEMPT COMPLETE         " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
