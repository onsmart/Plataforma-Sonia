@echo off
REM ============================================
REM Script para Testar Envio de Mensagem via Evolution API
REM ============================================

echo.
echo ============================================
echo  TESTAR ENVIO DE MENSAGEM - EVOLUTION API
echo ============================================
echo.

REM Configurações
set EVOLUTION_API_URL=http://192.168.15.31:8081
set API_KEY=dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==

REM Solicitar informações
set /p INSTANCE_NAME="Digite o nome da instancia (ex: 11943687794): "
if "%INSTANCE_NAME%"=="" (
    echo [ERRO] Nome da instancia nao informado!
    pause
    exit /b 1
)

set /p DESTINO="Digite o numero de destino (ex: 5511943687794): "
if "%DESTINO%"=="" (
    echo [ERRO] Numero de destino nao informado!
    pause
    exit /b 1
)

REM Remover caracteres especiais (deixar apenas numeros)
set DESTINO=%DESTINO:(=%
set DESTINO=%DESTINO:)=%
set DESTINO=%DESTINO:-=%
set DESTINO=%DESTINO: =%

REM Se nao comecar com codigo do pais (55 para Brasil), adicionar automaticamente
if not "%DESTINO:~0,2%"=="55" (
    echo.
    echo [INFO] Adicionando codigo do pais 55 (Brasil) automaticamente...
    set DESTINO=55%DESTINO%
)

set /p MENSAGEM="Digite a mensagem: "
if "%MENSAGEM%"=="" (
    echo [ERRO] Mensagem nao informada!
    pause
    exit /b 1
)

echo.
echo.
echo Configuracao:
echo   URL: %EVOLUTION_API_URL%
echo   Instancia: %INSTANCE_NAME%
echo   Destino: %DESTINO% (com codigo do pais)
echo   Mensagem: %MENSAGEM%
echo.

REM Enviar mensagem (tudo em uma linha para Windows CMD)
echo Enviando mensagem...
echo.

curl --max-time 30 -X POST "%EVOLUTION_API_URL%/message/sendText/%INSTANCE_NAME%" -H "apikey: %API_KEY%" -H "Content-Type: application/json" -d "{\"number\":\"%DESTINO%\",\"text\":\"%MENSAGEM%\"}"

echo.
echo.
echo ============================================
echo  TESTE CONCLUIDO
echo ============================================
echo.

pause
