@echo off
REM ============================================
REM Script para Upload do BackEnd.zip para Servidor
REM Windows Batch Script
REM ============================================

echo.
echo ============================================
echo  UPLOAD BACKEND.ZIP PARA SERVIDOR
echo ============================================
echo.

REM Verificar se o arquivo existe
if not exist "BackEnd.zip" (
    echo [ERRO] Arquivo BackEnd.zip nao encontrado!
    echo.
    echo Por favor, crie o arquivo BackEnd.zip primeiro:
    echo   Compress-Archive -Path BackEnd\* -DestinationPath BackEnd.zip -Force
    echo.
    pause
    exit /b 1
)

echo [OK] Arquivo BackEnd.zip encontrado!
echo.

REM Solicitar informações do servidor
set /p SERVER="Digite o endereco do servidor (ex: servidoronsmart@192.168.1.100): "
if "%SERVER%"=="" (
    echo [ERRO] Servidor nao informado!
    pause
    exit /b 1
)

set /p REMOTE_PATH="Digite o caminho remoto (padrao: ~/plataform-backend): "
if "%REMOTE_PATH%"=="" set REMOTE_PATH=~/plataform-backend

echo.
echo Configuracao:
echo   Arquivo: BackEnd.zip
echo   Servidor: %SERVER%
echo   Caminho remoto: %REMOTE_PATH%
echo.

REM Verificar se SCP esta disponivel
where scp >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] SCP nao encontrado!
    echo.
    echo Por favor, instale:
    echo   - Git Bash: https://git-scm.com/downloads
    echo   - Ou WinSCP: https://winscp.net/
    echo.
    pause
    exit /b 1
)

echo Fazendo upload do BackEnd.zip...
echo.

scp BackEnd.zip %SERVER%:%REMOTE_PATH%/

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  UPLOAD CONCLUIDO COM SUCESSO!
    echo ============================================
    echo.
    echo Proximos passos no servidor:
    echo   1. ssh %SERVER%
    echo   2. cd %REMOTE_PATH%
    echo   3. unzip -o BackEnd.zip
    echo   4. rm BackEnd.zip
    echo   5. cp .env.example .env
    echo   6. nano .env
    echo   7. npm install
    echo   8. npm run build
    echo   9. sudo ./scripts/setup-server.sh
    echo  10. sudo ./scripts/setup-cloudflare-tunnel.sh
    echo  11. ./scripts/deploy.sh
    echo.
) else (
    echo.
    echo [ERRO] Falha no upload!
    echo Verifique:
    echo   - Conexao com o servidor
    echo   - Credenciais SSH
    echo   - Permissoes da pasta remota
    echo.
)

pause
