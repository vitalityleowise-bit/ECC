@echo off
rem UNIE-MUSO : ouvre l'application dans Edge ou Chrome en mode application (sans barre d'adresse).
rem Les donnees restent dans %LocalAppData%\UNIE-MUSO (profil dedie, independant du navigateur habituel).
setlocal
set "APP=%~dp0UNIE-MUSO.html"
set "PROFILE=%LocalAppData%\UNIE-MUSO"
set "URL=file:///%APP:\=/%"
if not exist "%PROFILE%" mkdir "%PROFILE%"

set "BROWSER="
for %%P in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if not defined BROWSER if exist %%P set "BROWSER=%%~P"

if not defined BROWSER (
  echo Microsoft Edge ou Google Chrome est introuvable. Ouverture avec le navigateur par defaut...
  start "" "%APP%"
  exit /b 0
)
start "" "%BROWSER%" --app="%URL%" --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --window-size=1320,860
exit /b 0
