@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0" || exit /b 1
set "MYSPACE_NODE="
for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined MYSPACE_NODE set "MYSPACE_NODE=%%N"
set "MYSPACE_PORTABLE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined MYSPACE_NODE set "MYSPACE_NODE=%MYSPACE_PORTABLE_NODE%"
call :check_node
if errorlevel 1 (
  set "MYSPACE_NODE=%MYSPACE_PORTABLE_NODE%"
  call :check_node
  if errorlevel 1 (
    echo Erro: Node.js 22+ com --use-system-ca nao foi encontrado.
    goto failed
  )
)
if not exist "%~dp0server\node_modules\ws\package.json" (
  echo Erro: a dependencia local server\node_modules\ws nao foi encontrada.
  goto failed
)
call :find_party_listener
if defined MYSPACE_PARTY_OWNER goto party_in_use
:start_servers
"%MYSPACE_NODE%" --use-system-ca "%~dp0launcher.cjs"
set "MYSPACE_EXIT=%errorlevel%"
if "%MYSPACE_EXIT%"=="0" exit /b 0
if "%MYSPACE_EXIT%"=="130" exit /b 130
if "%MYSPACE_EXIT%"=="-1073741510" exit /b %MYSPACE_EXIT%
goto failed
:party_in_use
echo A porta 8787 esta ocupada pelo processo PID %MYSPACE_PARTY_OWNER%:
tasklist /FI "PID eq %MYSPACE_PARTY_OWNER%" 2>nul
echo.
choice /C SN /N /M "Encerrar esse processo e continuar? [S/N] "
if errorlevel 2 exit /b 0
if errorlevel 1 goto stop_existing_party
goto failed
:stop_existing_party
set "MYSPACE_SELECTED_PID=%MYSPACE_PARTY_OWNER%"
call :find_party_listener
if not "%MYSPACE_PARTY_OWNER%"=="%MYSPACE_SELECTED_PID%" (
  echo O processo da porta 8787 mudou. Verificando novamente...
  if defined MYSPACE_PARTY_OWNER goto party_in_use
  goto start_servers
)
taskkill /PID %MYSPACE_SELECTED_PID% /F
if errorlevel 1 (
  echo Erro: nao foi possivel encerrar o processo da porta 8787.
  goto failed
)
timeout /t 1 /nobreak >nul
call :find_party_listener
if defined MYSPACE_PARTY_OWNER (
  echo Erro: a porta 8787 continua ocupada.
  goto failed
)
goto start_servers
:check_node
if not exist "%MYSPACE_NODE%" exit /b 1
"%MYSPACE_NODE%" --use-system-ca -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)" >nul 2>nul
exit /b %errorlevel%
:find_party_listener
set "MYSPACE_PARTY_OWNER="
for /f "tokens=1,2,3,4,5" %%A in ('netstat -ano -p tcp') do if /i "%%D"=="LISTENING" call :consider_listener "%%B" "%%E"
exit /b 0
:consider_listener
set "MYSPACE_LOCAL=%~1"
if "%MYSPACE_LOCAL:~-5%"==":8787" if not defined MYSPACE_PARTY_OWNER set "MYSPACE_PARTY_OWNER=%~2"
exit /b 0
:failed
echo.
echo O launcher nao iniciou. Pressione qualquer tecla para fechar esta janela.
pause >nul
exit /b 1
