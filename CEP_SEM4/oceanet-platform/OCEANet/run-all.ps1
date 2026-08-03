$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Resolve-Path (Join-Path $projectRoot "..\..")

$backendPath = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend"
$venvActivate = Join-Path $workspaceRoot ".venv\Scripts\Activate.ps1"
$venvPython = Join-Path $workspaceRoot ".venv\Scripts\python.exe"
$gfwToken = $env:NEREXIS_GFW_API_TOKEN
$primaryBackendPort = 8000
$fallbackBackendPort = 8001
$backendPort = $primaryBackendPort
$runMode = if ([string]::IsNullOrWhiteSpace($env:OCEANET_RUN_MODE)) { "prod" } else { $env:OCEANET_RUN_MODE.Trim().ToLower() }
$useProdMode = $runMode -ne "dev"
$modeLabel = if ($useProdMode) { "production" } else { "development" }

function Test-BackendHealthy {
    param([int]$Port)
    try {
        $probe = Invoke-WebRequest -Uri "http://localhost:$Port/health" -UseBasicParsing -TimeoutSec 2
        return $probe.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Get-PortListenerPid {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        return [int]$conn.OwningProcess
    } catch {
        return $null
    }
}

if (-not (Test-Path $backendPath)) {
    Write-Error "Backend folder not found: $backendPath"
    exit 1
}

if (-not (Test-Path $frontendPath)) {
    Write-Error "Frontend folder not found: $frontendPath"
    exit 1
}

if (-not (Test-Path $venvActivate)) {
    Write-Error "Virtual environment activate script not found: $venvActivate"
    exit 1
}

if (-not (Test-Path $venvPython)) {
    Write-Error "Virtual environment Python executable not found: $venvPython"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($gfwToken)) {
    if ($useProdMode) {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; Remove-Item Env:NEREXIS_GFW_API_TOKEN -ErrorAction SilentlyContinue; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --port $backendPort"
    } else {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; Remove-Item Env:NEREXIS_GFW_API_TOKEN -ErrorAction SilentlyContinue; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --reload --port $backendPort"
    }
} else {
    if ($useProdMode) {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; `$env:NEREXIS_GFW_API_TOKEN='$gfwToken'; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --port $backendPort"
    } else {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; `$env:NEREXIS_GFW_API_TOKEN='$gfwToken'; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --reload --port $backendPort"
    }
}

if ($useProdMode) {
    $frontendCommand = "Set-Location '$frontendPath'; `$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:$backendPort'; `$env:NODE_ENV='production'; `$env:NEXT_TELEMETRY_DISABLED='1'; npm run build; npm run start"
} else {
    $frontendCommand = "Set-Location '$frontendPath'; `$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:$backendPort'; npm run dev"
}

$backendListening = $false
$frontendListening = $false
$primaryBackendHealthy = Test-BackendHealthy -Port $primaryBackendPort
$fallbackBackendHealthy = Test-BackendHealthy -Port $fallbackBackendPort

if ($primaryBackendHealthy) {
    $backendPort = $primaryBackendPort
} elseif ($fallbackBackendHealthy) {
    $backendPort = $fallbackBackendPort
} else {
    $primaryListenerPid = Get-PortListenerPid -Port $primaryBackendPort
    if ($primaryListenerPid) {
        $backendPort = $fallbackBackendPort
    } else {
        $backendPort = $primaryBackendPort
    }
}

if ([string]::IsNullOrWhiteSpace($gfwToken)) {
    if ($useProdMode) {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; Remove-Item Env:NEREXIS_GFW_API_TOKEN -ErrorAction SilentlyContinue; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --port $backendPort"
    } else {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; Remove-Item Env:NEREXIS_GFW_API_TOKEN -ErrorAction SilentlyContinue; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --reload --port $backendPort"
    }
} else {
    if ($useProdMode) {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; `$env:NEREXIS_GFW_API_TOKEN='$gfwToken'; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --port $backendPort"
    } else {
        $backendCommand = "Set-Location '$backendPath'; `$env:NEREXIS_DATASET_REFRESH_INTERVAL_SECONDS='60'; `$env:NEREXIS_SYNC_REPORT_RETENTION='10000'; `$env:NEREXIS_GFW_API_TOKEN='$gfwToken'; & '$venvActivate'; & '$venvPython' -m uvicorn app.main:app --reload --port $backendPort"
    }
}

if ($useProdMode) {
    $frontendCommand = "Set-Location '$frontendPath'; `$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:$backendPort'; `$env:NODE_ENV='production'; `$env:NEXT_TELEMETRY_DISABLED='1'; if (-not (Test-Path '.next/BUILD_ID')) { npm run build }; npm run start"
} else {
    $frontendCommand = "Set-Location '$frontendPath'; `$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:$backendPort'; npm run dev"
}

try {
    $backendListening = [bool](Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction Stop | Select-Object -First 1)
} catch {
    $backendListening = $false
}

try {
    $frontendListening = [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop | Select-Object -First 1)
} catch {
    $frontendListening = $false
}

if ($frontendListening -and $backendPort -ne $primaryBackendPort) {
    $frontendPid = Get-PortListenerPid -Port 3000
    if ($frontendPid) {
        try {
            Stop-Process -Id $frontendPid -Force -ErrorAction Stop
            $frontendListening = $false
            Write-Host "Restarting frontend to align API base with backend on port $backendPort."
        } catch {
        }
    }
}

$startBackend = -not $backendListening
$startFrontend = -not $frontendListening

if (-not $startBackend -and -not $startFrontend) {
    Write-Host "Backend and frontend already running; skipping duplicate launch."
    Write-Host "Run mode: $modeLabel"
    Write-Host "Backend: http://localhost:$backendPort"
    Write-Host "Frontend: http://localhost:3000"
    exit 0
}

if ($useProdMode -and $startFrontend) {
    Write-Host "Preparing frontend production build (if needed)..."
    Push-Location $frontendPath
    try {
        if (-not (Test-Path ".next/BUILD_ID")) {
            npm run build
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Frontend build failed."
                exit 1
            }
        }
    } finally {
        Pop-Location
    }
}

if ($startBackend) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null
} else {
    Write-Host "Backend already listening on port $backendPort; not launching a duplicate backend process."
}

$backendReady = $backendListening
if ($startBackend) {
    $backendReady = $false
    for ($attempt = 1; $attempt -le 45; $attempt++) {
        try {
            $probe = Invoke-WebRequest -Uri "http://localhost:$backendPort/health" -UseBasicParsing -TimeoutSec 2
            if ($probe.StatusCode -eq 200) {
                $backendReady = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 700
        }
    }
}

if (-not $backendReady) {
    Write-Warning "Backend did not become ready within the expected time. Frontend will still be started."
}

if ($startFrontend) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null
} else {
    Write-Host "Frontend already listening on port 3000; not launching a duplicate frontend process."
}

if ($startBackend -and $startFrontend) {
    Write-Host "Started backend and frontend in two new PowerShell windows."
} elseif ($startBackend) {
    Write-Host "Started backend in a new PowerShell window. Frontend was already running."
} elseif ($startFrontend) {
    Write-Host "Started frontend in a new PowerShell window. Backend was already running."
}
Write-Host "Run mode: $modeLabel (set OCEANET_RUN_MODE=dev to force dev mode)"
Write-Host "Backend: http://localhost:$backendPort"
Write-Host "Frontend: http://localhost:3000"