@echo off
rem Desinstalle UNIE-MUSO. Les donnees de Documents\UNIE-MUSO sont conservees.
setlocal
title Desinstallation de UNIE-MUSO
choice /m "Desinstaller UNIE-MUSO ? (vos donnees dans Documents\UNIE-MUSO sont conservees)"
if errorlevel 2 exit /b 0
taskkill /im UNIE-MUSO.exe /f >nul 2>&1
reg delete "HKCU\Software\Classes\.unimiso" /f >nul 2>&1
reg delete "HKCU\Software\Classes\UNIEMUSO.Sauvegarde" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\UNIE-MUSO" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "UNIE-MUSO" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "electron.app.UNIE-MUSO" /f >nul 2>&1
powershell -NoProfile -Command "Remove-Item -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath('Desktop')) 'UNIE-MUSO.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'UNIE-MUSO.lnk')" >nul 2>&1
echo UNIE-MUSO a ete desinstalle. Vos donnees restent dans Documents\UNIE-MUSO.
timeout /t 4 >nul
start "" /b cmd /c "timeout /t 2 >nul & rd /s /q "%LocalAppData%\Programs\UNIE-MUSO""
exit /b 0
