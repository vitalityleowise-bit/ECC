@echo off
rem Installe UNIE-MUSO pour l'utilisateur courant (aucun droit administrateur necessaire).
setlocal
title Installation de UNIE-MUSO
set "SRC=%~dp0UNIE-MUSO"
set "DEST=%LocalAppData%\Programs\UNIE-MUSO"
if not exist "%SRC%\UNIE-MUSO.exe" (
  echo Le dossier "UNIE-MUSO" doit se trouver a cote de ce fichier. Decompressez tout le ZIP avant d'installer.
  pause & exit /b 1
)
echo Installation de UNIE-MUSO dans %DEST% ...
taskkill /im UNIE-MUSO.exe /f >nul 2>&1
robocopy "%SRC%" "%DEST%" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 ( echo La copie a echoue. & pause & exit /b 1 )

rem Fichiers .unimiso : double-clic = ouverture et import dans UNIE-MUSO
reg add "HKCU\Software\Classes\.unimiso" /ve /d "UNIEMUSO.Sauvegarde" /f >nul
reg add "HKCU\Software\Classes\UNIEMUSO.Sauvegarde" /ve /d "Sauvegarde UNIE-MUSO" /f >nul
reg add "HKCU\Software\Classes\UNIEMUSO.Sauvegarde\DefaultIcon" /ve /d "\"%DEST%\UNIE-MUSO.exe\",0" /f >nul
reg add "HKCU\Software\Classes\UNIEMUSO.Sauvegarde\shell\open\command" /ve /d "\"%DEST%\UNIE-MUSO.exe\" \"%%1\"" /f >nul

rem Raccourcis Bureau et menu Demarrer
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$w=New-Object -ComObject WScript.Shell;" ^
  "foreach($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))){" ^
  " $s=$w.CreateShortcut((Join-Path $d 'UNIE-MUSO.lnk')); $s.TargetPath='%DEST%\UNIE-MUSO.exe'; $s.WorkingDirectory='%DEST%';" ^
  " $s.IconLocation='%DEST%\UNIE-MUSO.exe,0'; $s.Description='Gestion de la mutuelle UNIE-MUSO'; $s.Save() }" >nul 2>&1

rem Ligne « Desinstaller » dans Parametres > Applications
set "UK=HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\UNIE-MUSO"
reg add "%UK%" /v DisplayName /d "UNIE-MUSO" /f >nul
reg add "%UK%" /v DisplayVersion /d "3.7.1" /f >nul
reg add "%UK%" /v Publisher /d "UNIE-MUSO" /f >nul
reg add "%UK%" /v DisplayIcon /d "%DEST%\UNIE-MUSO.exe" /f >nul
reg add "%UK%" /v UninstallString /d "\"%DEST%\DESINSTALLER.bat\"" /f >nul
reg add "%UK%" /v NoModify /t REG_DWORD /d 1 /f >nul

rem Previent l'Explorateur que l'association de fichiers a change
powershell -NoProfile -Command "Add-Type -Namespace W -Name S -MemberDefinition '[DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int e,int f,System.IntPtr a,System.IntPtr b);'; [W.S]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)" >nul 2>&1

echo.
echo UNIE-MUSO est installe. Un raccourci a ete cree sur le Bureau.
echo Les donnees seront enregistrees dans Documents\UNIE-MUSO
echo.
start "" "%DEST%\UNIE-MUSO.exe"
timeout /t 6 >nul
exit /b 0
