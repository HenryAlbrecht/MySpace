@echo off
call "%~dp0launcher.bat" %*
exit /b %errorlevel%


versão antiga:

@echo off
cd /d "%~dp0"
set "MYSPACE_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "MYSPACE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
"%MYSPACE_NODE%" server.cjs --open
if errorlevel 1 (
  echo Nao foi possivel iniciar. Este site precisa de Node.js 22 ou mais recente.
  pause
)