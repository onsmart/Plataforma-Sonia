param(
    [string]$Server = "servidoronsmart@192.168.15.31",
    [string]$RemotePath = "~/plataform-backend",
    [string]$Pm2Name = "backend",
    [switch]$RunLocalTests,
    [switch]$RunLocalBuild,
    [switch]$KeepLocalZip,
    [string]$RemoteRestartCommand = ""
)

$ErrorActionPreference = "Stop"

function Write-Info($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-WarnMsg($Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Require-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando obrigatorio nao encontrado: $Name"
    }
}

function Invoke-CheckedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = ""
    )

    $previousLocation = Get-Location

    try {
        if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
            Set-Location -LiteralPath $WorkingDirectory
        }

        & $FilePath @Arguments
        $exitCode = $LASTEXITCODE

        if ($exitCode -ne 0) {
            throw "Falha ao executar: $FilePath $($Arguments -join ' ')"
        }
    }
    finally {
        Set-Location -LiteralPath $previousLocation
    }
}

function Remove-IfExists([string]$PathToRemove) {
    if (Test-Path -LiteralPath $PathToRemove) {
        Remove-Item -LiteralPath $PathToRemove -Recurse -Force
    }
}

Require-Command "ssh"
Require-Command "scp"
Require-Command "robocopy.exe"
Require-Command "tar.exe"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendSource = Join-Path $projectRoot "BackEnd"

if (-not (Test-Path -LiteralPath $backendSource)) {
    throw "Pasta BackEnd nao encontrada em $backendSource"
}

$packageJson = Join-Path $backendSource "package.json"
if (-not (Test-Path -LiteralPath $packageJson)) {
    throw "package.json do backend nao encontrado em $packageJson"
}

if ($RunLocalTests) {
    Write-Info "Executando testes locais do backend..."
    Invoke-CheckedProcess -FilePath "npm.cmd" -Arguments @("test") -WorkingDirectory $backendSource
}

if ($RunLocalBuild) {
    Write-Info "Executando build local do backend..."
    Invoke-CheckedProcess -FilePath "npm.cmd" -Arguments @("run", "build") -WorkingDirectory $backendSource
}

$deployTempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("sonia-backend-deploy-" + [guid]::NewGuid().ToString("N"))
$packageRoot = Join-Path $deployTempRoot "package"
$stagingBackend = Join-Path $packageRoot "BackEnd"
$localArchivePath = Join-Path $deployTempRoot "BackEnd.deploy.tar.gz"

Write-Info "Preparando pacote de deploy..."
New-Item -ItemType Directory -Path $stagingBackend -Force | Out-Null

$robocopyLog = Join-Path $deployTempRoot "robocopy.log"
$robocopyArgs = @(
    $backendSource,
    $stagingBackend,
    "/E",
    "/R:2",
    "/W:1",
    "/XD", "node_modules", "dist", ".git", ".backups",
    "/XF", ".env", "*.log",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP",
    "/LOG:$robocopyLog"
)

& robocopy.exe @robocopyArgs | Out-Null
$robocopyExit = $LASTEXITCODE
if ($robocopyExit -ge 8) {
    throw "Falha ao copiar arquivos para o pacote de deploy. Veja: $robocopyLog"
}

Invoke-CheckedProcess -FilePath "tar.exe" -Arguments @(
    "-czf",
    $localArchivePath,
    "-C",
    $packageRoot,
    "BackEnd"
) -WorkingDirectory $projectRoot

$remoteArchiveName = "BackEnd.deploy.tar.gz"
$trimmedRemotePath = $RemotePath.Trim().TrimEnd('/')
$remoteArchivePath = if ($trimmedRemotePath -eq "~") {
    "~/$remoteArchiveName"
} else {
    "$trimmedRemotePath/$remoteArchiveName"
}

Write-Info "Enviando pacote para $Server..."
Invoke-CheckedProcess -FilePath "scp" -Arguments @($localArchivePath, "$Server`:$remoteArchivePath") -WorkingDirectory $projectRoot

$remoteRoot = if ($RemotePath.StartsWith("~/")) {
    '$HOME/' + $RemotePath.Substring(2)
} else {
    $RemotePath
}

$escapedRemoteRoot = $remoteRoot.Replace('"', '\"')
$escapedPm2Name = $Pm2Name.Replace('"', '\"')

$restartBlock = if ([string]::IsNullOrWhiteSpace($RemoteRestartCommand)) {
@"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$escapedPm2Name" >/dev/null 2>&1; then
    pm2 restart "$escapedPm2Name"
  else
    pm2 start dist/index.js --name "$escapedPm2Name"
  fi
elif command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files 2>/dev/null | grep -q "^$escapedPm2Name\.service"; then
    sudo systemctl restart "$escapedPm2Name"
  else
    echo "[WARN] Nenhum processo pm2 ou service '$escapedPm2Name' encontrado para reiniciar."
  fi
else
  echo "[WARN] pm2/systemctl nao encontrados no servidor. Reinicie o processo manualmente."
fi
"@
} else {
    $RemoteRestartCommand
}

$remoteScriptPath = Join-Path $deployTempRoot "remote-deploy.sh"
$remoteScript = @"
#!/usr/bin/env bash
set -euo pipefail

REMOTE_ROOT="$escapedRemoteRoot"
BACKEND_DIR="`$REMOTE_ROOT/BackEnd"
ARCHIVE_FILE="`$REMOTE_ROOT/$remoteArchiveName"
ENV_BACKUP=""

mkdir -p "`$REMOTE_ROOT"

if [ ! -f "`$ARCHIVE_FILE" ]; then
  echo "[ERRO] Arquivo de deploy nao encontrado: `$ARCHIVE_FILE"
  exit 1
fi

find "`$REMOTE_ROOT" -maxdepth 1 -type f \( -name "BackEnd*.zip" -o -name "BackEnd*.tar.gz" \) ! -name "$remoteArchiveName" -delete 2>/dev/null || true
rm -f "`$REMOTE_ROOT/package.json" "`$REMOTE_ROOT/package-lock.json" 2>/dev/null || true

if [ -f "`$BACKEND_DIR/.env" ]; then
  ENV_BACKUP="/tmp/sonia-backend-env-`$`$"
  cp "`$BACKEND_DIR/.env" "`$ENV_BACKUP"
fi

rm -rf "`$BACKEND_DIR"

if ! command -v tar >/dev/null 2>&1; then
  echo "[ERRO] tar nao encontrado no servidor"
  exit 1
fi

tar -xzf "`$ARCHIVE_FILE" -C "`$REMOTE_ROOT"
rm -f "`$ARCHIVE_FILE"

if [ -n "`$ENV_BACKUP" ] && [ -f "`$ENV_BACKUP" ]; then
  mv "`$ENV_BACKUP" "`$BACKEND_DIR/.env"
fi

cd "`$BACKEND_DIR"

if [ -f package-lock.json ]; then
  if ! npm ci; then
    echo "[WARN] npm ci falhou; tentando npm install para sincronizar dependencias..."
    npm install
  fi
else
  npm install
fi

npm run build

$restartBlock

echo "[OK] Backend atualizado com sucesso em `$BACKEND_DIR"
"@

$remoteScriptNormalized = $remoteScript.Replace("`r`n", "`n").Replace("`r", "`n")
[System.IO.File]::WriteAllText($remoteScriptPath, $remoteScriptNormalized, [System.Text.Encoding]::ASCII)

Write-Info "Executando atualizacao remota..."
$remoteScriptContent = [System.IO.File]::ReadAllText($remoteScriptPath, [System.Text.Encoding]::ASCII).Replace("`r`n", "`n").Replace("`r", "`n")
$remoteScriptContent | ssh $Server "bash -s"
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar comandos remotos no servidor"
}

Write-Info "Deploy do backend concluido."
Write-Host "Servidor: $Server"
Write-Host "Pasta remota: $RemotePath/BackEnd"

if (-not $KeepLocalZip) {
    Remove-IfExists $deployTempRoot
} else {
    Write-WarnMsg "Pacote local preservado em: $localArchivePath"
}
