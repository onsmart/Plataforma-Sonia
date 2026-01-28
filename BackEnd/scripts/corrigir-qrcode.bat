@echo off
REM ============================================
REM Script para Corrigir Problema de QR Code (Windows)
REM ============================================

echo.
echo ============================================
echo  CORRIGIR PROBLEMA DE QR CODE
echo ============================================
echo.

set EVOLUTION_API_URL=http://localhost:8081
set API_KEY=dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==

echo [1] Verificando Evolution API...
curl -f -s %EVOLUTION_API_URL% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Evolution API esta rodando
) else (
    echo [ERRO] Evolution API nao esta respondendo
    echo Verifique: docker-compose ps
    pause
    exit /b 1
)
echo.

echo [2] Listando instancias...
curl -s -X GET "%EVOLUTION_API_URL%/instance/fetchInstances" -H "apikey: %API_KEY%" > temp_instances.json

echo.
echo Instancias encontradas:
type temp_instances.json | findstr "instanceName"
echo.

set /p INSTANCE_NAME="Digite o nome da instancia (numero do WhatsApp, ex: 11943687794): "
if "%INSTANCE_NAME%"=="" (
    echo [ERRO] Nome da instancia nao informado!
    pause
    exit /b 1
)

echo.
echo ============================================
echo  CORRIGINDO INSTANCIA: %INSTANCE_NAME%
echo ============================================
echo.

echo [3] Verificando status atual...
curl -s -X GET "%EVOLUTION_API_URL%/instance/connect/%INSTANCE_NAME%" -H "apikey: %API_KEY%" > temp_status.json
type temp_status.json
echo.

echo [4] Deletando instancia...
curl -s -X DELETE "%EVOLUTION_API_URL%/instance/delete/%INSTANCE_NAME%" -H "apikey: %API_KEY%"
echo.
echo Aguardando 5 segundos...
timeout /t 5 /nobreak >nul
echo.

echo [5] Recriando instancia...
curl -s -X POST "%EVOLUTION_API_URL%/instance/create" -H "apikey: %API_KEY%" -H "Content-Type: application/json" -d "{\"instanceName\": \"%INSTANCE_NAME%\", \"token\": \"\", \"qrcode\": true}" > temp_create.json
type temp_create.json
echo.

echo [6] Aguardando 10 segundos e verificando QR Code...
timeout /t 10 /nobreak >nul

curl -s -X GET "%EVOLUTION_API_URL%/instance/connect/%INSTANCE_NAME%" -H "apikey: %API_KEY%" > temp_qrcode.json
echo.
echo Resposta do QR Code:
type temp_qrcode.json
echo.

echo.
echo ============================================
echo  CONCLUIDO
echo ============================================
echo.
echo Se o QR Code ainda nao aparecer:
echo   1. Verifique os logs: docker-compose logs evolution-api -f
echo   2. Reinicie: docker-compose restart evolution-api
echo   3. Execute este script novamente
echo.

del temp_*.json 2>nul
pause
