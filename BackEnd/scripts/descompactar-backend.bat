@echo off
REM ============================================
REM Script para Descompactar BackEnd.zip no Servidor Windows
REM Execute este script no servidor Windows
REM ============================================

echo.
echo ============================================
echo  DESCOMPACTAR BACKEND.ZIP
echo ============================================
echo.

REM Verificar se o arquivo existe
if not exist "BackEnd.zip" (
    echo [ERRO] Arquivo BackEnd.zip nao encontrado!
    echo.
    echo Por favor, certifique-se de que:
    echo   1. Voce esta na pasta correta
    echo   2. O arquivo BackEnd.zip foi enviado para esta pasta
    echo.
    pause
    exit /b 1
)

echo [OK] Arquivo BackEnd.zip encontrado!
echo.

REM Verificar se ja existe conteudo
if exist "BackEnd" (
    echo [AVISO] Pasta BackEnd ja existe!
    set /p OVERWRITE="Deseja sobrescrever? (s/N): "
    if /i not "%OVERWRITE%"=="s" (
        echo Operacao cancelada.
        pause
        exit /b 0
    )
    echo Removendo pasta BackEnd existente...
    rmdir /s /q BackEnd
)

REM Descompactar
echo Descompactando BackEnd.zip...
echo.

powershell -Command "Expand-Archive -Path BackEnd.zip -DestinationPath . -Force"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo  DESCOMPACTACAO CONCLUIDA!
    echo ============================================
    echo.
    
    REM Verificar estrutura
    if exist "BackEnd" (
        echo [OK] Pasta BackEnd criada com sucesso!
        echo.
        echo Estrutura:
        dir BackEnd /b | more
        echo.
        
        REM Remover arquivo ZIP (opcional)
        set /p REMOVE_ZIP="Deseja remover o arquivo BackEnd.zip? (S/n): "
        if /i not "%REMOVE_ZIP%"=="n" (
            del BackEnd.zip
            echo [OK] Arquivo BackEnd.zip removido!
        )
        
        echo.
        echo Proximos passos:
        echo   1. cd BackEnd
        echo   2. copiar .env.example para .env
        echo   3. editar .env
        echo   4. npm install
        echo   5. npm run build
        echo.
    ) else (
        echo [AVISO] Arquivos descompactados, mas pasta BackEnd nao encontrada.
        echo Verifique se os arquivos foram extraidos corretamente.
        echo.
    )
) else (
    echo.
    echo [ERRO] Falha ao descompactar!
    echo Verifique:
    echo   - Se o arquivo ZIP esta corrompido
    echo   - Se ha espaco em disco suficiente
    echo   - Permissoes de escrita na pasta
    echo.
)

pause
