@echo off
REM ============================================
REM Script para Upload do BackEnd para Servidor
REM Windows Batch Script
REM ============================================

echo.
echo ============================================
echo  UPLOAD PARA SERVIDOR
echo ============================================
echo.

REM Configurações
set /p SERVER="Digite o endereco do servidor (ex: servidoronsmart@192.168.1.100): "
if "%SERVER%"=="" (
    echo [ERRO] Servidor nao informado!
    pause
    exit /b 1
)

set REMOTE_PATH=~/plataform-backend

echo.
echo Configuracao:
echo   Servidor: %SERVER%
echo   Pasta remota: %REMOTE_PATH%
echo.

REM Verificar se rsync esta disponivel (Git Bash)
where rsync >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] rsync nao encontrado.
    echo.
    echo Opcoes:
    echo   1. Instalar Git Bash (recomendado)
    echo   2. Usar WinSCP (interface grafica)
    echo   3. Usar SCP manualmente
    echo.
    echo Continuando com metodo alternativo...
    echo.
    
    REM Usar SCP como alternativa
    where scp >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] SCP tambem nao encontrado!
        echo.
        echo Por favor, instale:
        echo   - Git Bash: https://git-scm.com/downloads
        echo   - Ou WinSCP: https://winscp.net/
        echo.
        pause
        exit /b 1
    )
    
    echo Usando SCP...
    echo.
    echo [AVISO] SCP copiara tudo, incluindo node_modules.
    echo Recomenda-se usar rsync ou compactar antes.
    echo.
    pause
    
    scp -r BackEnd %SERVER%:%REMOTE_PATH%
    goto :end
)

REM Usar rsync (melhor opcao)
echo Usando rsync (excluindo node_modules, dist, .env)...
echo.

rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.env' --exclude '.git' ^
  BackEnd/ %SERVER%:%REMOTE_PATH%/

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  UPLOAD CONCLUIDO COM SUCESSO!
    echo ============================================
    echo.
    echo Proximos passos no servidor:
    echo   1. ssh %SERVER%
    echo   2. cd %REMOTE_PATH%
    echo   3. cp .env.example .env
    echo   4. nano .env
    echo   5. npm install
    echo   6. npm run build
    echo   7. sudo ./scripts/setup-server.sh
    echo   8. sudo ./scripts/setup-cloudflare-tunnel.sh
    echo   9. ./scripts/deploy.sh
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

:end
pause
