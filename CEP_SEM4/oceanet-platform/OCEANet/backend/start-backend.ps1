# ============================================================================
# Nerexis Backend Startup Script with Auto-Recovery and Persistent Running
# ============================================================================

param(
    [int]$Port = 8000,
    [int]$RestartDelay = 5,
    [int]$HealthCheckInterval = 10
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = $projectRoot
$workspaceRoot = Resolve-Path (Join-Path $projectRoot "..\..\..")
$venvActivate = Join-Path $workspaceRoot ".venv\Scripts\Activate.ps1"
$venvPython = Join-Path $workspaceRoot ".venv\Scripts\python.exe"

# Verify paths
if (-not (Test-Path $venvActivate)) {
    Write-Error "Virtual environment not found: $venvActivate"
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Nerexis Backend v2" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Path: $backendPath" -ForegroundColor Gray
Write-Host "Python: $venvPython" -ForegroundColor Gray
Write-Host "Port: $Port" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

function Test-BackendHealthy {
    param([int]$Port)
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" `
            -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Get-BackendProcess {
    try {
        $procs = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*uvicorn*app.main*"
        }
        return $procs
    } catch {
        return $null
    }
}

function Stop-BackendProcess {
    $procs = Get-BackendProcess
    if ($procs) {
        Write-Host "Stopping existing backend processes..." -ForegroundColor Yellow
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "Backend processes stopped" -ForegroundColor Green
    }
}

function Start-Backend {
    Write-Host "Starting backend server..." -ForegroundColor Yellow
    Write-Host "Command: uvicorn app.main:app --host 0.0.0.0 --port $Port" -ForegroundColor Gray
    
    $env:NEREXIS_ENV = "production"
    $env:NEREXIS_LOG_LEVEL = "INFO"
    
    $processArgs = @(
        "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "$Port",
        "--access-log",
        "--log-level", "info"
    )
    
    Push-Location $backendPath
    & $venvActivate
    
    # Start the backend process
    & $venvPython $processArgs
    
    Pop-Location
}

# Clean up any existing processes
Stop-BackendProcess

# Start the backend in a loop with auto-recovery
$restartCount = 0
$lastRestartTime = $null

while ($true) {
    $restartCount++
    $lastRestartTime = Get-Date
    
    Write-Host ""
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting backend (Restart #$restartCount)" -ForegroundColor Cyan
    
    try {
        Start-Backend
    } catch {
        Write-Host "Backend exited with error: $_" -ForegroundColor Red
    }
    
    # Check if we're in a restart loop
    $timeSinceLastRestart = if ($lastRestartTime) { (Get-Date) - $lastRestartTime } else { $null }
    
    if ($restartCount -gt 1 -and $timeSinceLastRestart.TotalSeconds -lt 10) {
        Write-Host "Excessive restarts detected. Waiting $([int](60 - $timeSinceLastRestart.TotalSeconds)) seconds before retry..." -ForegroundColor Red
        Start-Sleep -Seconds (60 - $timeSinceLastRestart.TotalSeconds)
    } else {
        Write-Host "Backend stopped. Restarting in $RestartDelay seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds $RestartDelay
    }
}
