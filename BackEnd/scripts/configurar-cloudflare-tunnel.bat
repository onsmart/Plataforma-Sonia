@echo off
REM ============================================
REM Script para configurar Cloudflare Tunnel
REM Windows Batch Script
REM ============================================

echo.
echo ============================================
echo  CONFIGURAR CLOUDFLARE TUNNEL
echo ============================================
echo.

REM Verificar se cloudflared está instalado
where cloudflared >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] cloudflared nao encontrado!
    echo.
    echo Por favor, instale o cloudflared:
    echo 1. Baixe de: https://github.com/cloudflare/cloudflared/releases/latest
    echo 2. Extraia cloudflared.exe
    echo 3. Adicione ao PATH ou coloque na mesma pasta deste script
    echo.
    pause
    exit /b 1
)

echo [OK] cloudflared encontrado!
echo.

REM Passo 1: Autenticar
echo ============================================
echo PASSO 1: Autenticar no Cloudflare
echo ============================================
echo.
echo Isso vai abrir o navegador para fazer login...
pause
cloudflared tunnel login
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha na autenticacao
    pause
    exit /b 1
)

echo.
echo [OK] Autenticado com sucesso!
echo.

REM Passo 2: Criar túnel
echo ============================================
echo PASSO 2: Criar Túnel
echo ============================================
echo.
set /p TUNNEL_NAME="Nome do túnel (padrão: whatsapp-webhook): "
if "%TUNNEL_NAME%"=="" set TUNNEL_NAME=whatsapp-webhook

cloudflared tunnel create %TUNNEL_NAME%
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao criar túnel
    pause
    exit /b 1
)

echo.
echo [OK] Túnel criado: %TUNNEL_NAME%
echo.
echo IMPORTANTE: Anote o Tunnel ID que apareceu acima!
echo.
pause

REM Passo 3: Configurar
echo ============================================
echo PASSO 3: Configurar Túnel
echo ============================================
echo.
set CONFIG_DIR=%USERPROFILE%\.cloudflared
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

echo.
echo Criando arquivo de configuracao...
echo.
echo Por favor, informe:
set /p DOMAIN="Dominio (ou deixe vazio para URL aleatoria): "

if "%DOMAIN%"=="" (
    echo.
    echo Usando URL aleatoria do Cloudflare...
    echo.
    (
        echo tunnel: %TUNNEL_NAME%
        echo.
        echo ingress:
        echo   - service: http://localhost:3333
        echo   - service: http_status:404
    ) > "%CONFIG_DIR%\config.yml"
) else (
    echo.
    echo Configurando dominio: %DOMAIN%
    echo.
    (
        echo tunnel: %TUNNEL_NAME%
        echo.
        echo ingress:
        echo   - hostname: %DOMAIN%
        echo     service: http://localhost:3333
        echo   - service: http_status:404
    ) > "%CONFIG_DIR%\config.yml"
    
    echo Configurando DNS...
    cloudflared tunnel route dns %TUNNEL_NAME% %DOMAIN%
)

echo.
echo [OK] Configuracao criada em: %CONFIG_DIR%\config.yml
echo.

REM Passo 4: Testar
echo ============================================
echo PASSO 4: Testar Túnel
echo ============================================
echo.
echo Iniciando túnel em modo teste...
echo.
echo IMPORTANTE: A URL publica aparecera abaixo!
echo Pressione Ctrl+C para parar o teste.
echo.
pause

cloudflared tunnel run %TUNNEL_NAME%

echo.
echo ============================================
echo CONFIGURACAO CONCLUIDA!
echo ============================================
echo.
echo PROXIMOS PASSOS:
echo 1. Anote a URL publica que apareceu acima
echo 2. Atualize docker-compose.yml com a URL
echo 3. Reinicie o backend e os servicos de apoio apos atualizar a configuracao
echo 4. Para rodar como servico: cloudflared service install
echo.
pause
