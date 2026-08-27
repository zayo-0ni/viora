@echo off
setlocal enabledelayedexpansion
title Viora - Android TV preview
cd /d "%~dp0.."

rem Box-drawing and arrows from the tools below show as mojibake without UTF-8,
rem which makes a healthy run look broken.
chcp 65001 >nul 2>&1

rem ============================================================
rem  Starts the Android TV emulator, installs the newest APK that
rem  matches its architecture, and opens the app.
rem
rem  It does NOT build. This is for looking at what is already
rem  built; run `pnpm run build:apk` when you want new code in it.
rem ============================================================

set "PKG=app.viora"
set "ACTIVITY=app.viora/.MainActivity"
set "AVD=%~1"
if "%AVD%"=="" set "AVD=Viora_TV"

cls
echo ============================================================
echo    Viora  -  Android TV preview
echo ============================================================
echo.

rem ---------------------------------------------------------- SDK
rem ANDROID_HOME first, then the place the Studio installer uses. The same
rem order build-apk.mjs searches, so both agree on which SDK is in play.
set "SDK=%ANDROID_HOME%"
if "%SDK%"=="" set "SDK=%ANDROID_SDK_ROOT%"
if "%SDK%"=="" set "SDK=%LOCALAPPDATA%\Android\Sdk"

set "ADB=%SDK%\platform-tools\adb.exe"
set "EMU=%SDK%\emulator\emulator.exe"

if not exist "%ADB%" (
  echo  [X]  adb not found at:
  echo       %ADB%
  echo.
  echo       Set ANDROID_HOME to your SDK folder, or install the
  echo       Android SDK platform-tools through Android Studio.
  echo.
  pause
  exit /b 1
)
if not exist "%EMU%" (
  echo  [X]  The emulator was not found at:
  echo       %EMU%
  echo.
  echo       Install it from Android Studio's SDK Manager
  echo       ^(SDK Tools tab -^> Android Emulator^).
  echo.
  pause
  exit /b 1
)
echo  [OK] SDK  %SDK%

rem ---------------------------------------------------------- AVD exists?
set "AVD_FOUND="
for /f "delims=" %%a in ('"%EMU%" -list-avds 2^>nul') do (
  if /i "%%a"=="%AVD%" set "AVD_FOUND=1"
)
if not defined AVD_FOUND (
  echo  [X]  No emulator named "%AVD%".
  echo.
  echo       Available:
  for /f "delims=" %%a in ('"%EMU%" -list-avds 2^>nul') do echo         %%a
  echo.
  echo       Pass one as an argument:  run-tv-emulator.bat Viora_TV720
  echo.
  pause
  exit /b 1
)
echo  [OK] AVD  %AVD%
echo.

rem ---------------------------------------------------------- running already?
rem Reusing a booted emulator saves about a minute, and starting a second copy
rem of the same AVD fails outright - the image is locked by the first.
set "DEVICE="
for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices 2^>nul') do (
  if "%%e"=="device" if not defined DEVICE set "DEVICE=%%d"
)

if defined DEVICE (
  echo  [OK] An emulator is already running ^(%DEVICE%^) - using it.
) else (
  echo  [..] Starting %AVD%. The window opens right away; Android
  echo       takes a minute or two to finish booting.
  start "Viora TV emulator" "%EMU%" -avd "%AVD%"

  echo  [..] Waiting for the device to appear...
  "%ADB%" wait-for-device
  if errorlevel 1 (
    echo  [X]  The device never appeared. Is the emulator window showing an error?
    echo.
    pause
    exit /b 1
  )

  echo  [..] Waiting for Android to finish booting...
  set "BOOTED="
  for /l %%i in (1,1,180) do (
    if not defined BOOTED (
      for /f "delims=" %%b in ('"%ADB%" shell getprop sys.boot_completed 2^>nul') do (
        if "%%b"=="1" set "BOOTED=1"
      )
      if not defined BOOTED ping -n 3 127.0.0.1 >nul
    )
  )
  if not defined BOOTED (
    echo  [X]  Android did not report a completed boot within three minutes.
    echo.
    pause
    exit /b 1
  )
  echo  [OK] Booted.
)
echo.

rem ---------------------------------------------------------- match the ABI
rem The emulator is asked what it is rather than trusting the AVD name. Both TV
rem images here are x86_64, and installing an arm64 APK on one fails with
rem INSTALL_FAILED_NO_MATCHING_ABIS - the build is per-architecture.
set "ABI="
for /f "delims=" %%a in ('"%ADB%" shell getprop ro.product.cpu.abi 2^>nul') do set "ABI=%%a"
set "ABI=%ABI: =%"

rem adb's names and the Gradle output folders differ.
set "ARCH="
if /i "%ABI%"=="x86_64" set "ARCH=x86_64"
if /i "%ABI%"=="x86" set "ARCH=x86"
if /i "%ABI%"=="arm64-v8a" set "ARCH=arm64"
if /i "%ABI%"=="armeabi-v7a" set "ARCH=arm"

if "%ARCH%"=="" (
  echo  [X]  Unrecognised device ABI: "%ABI%"
  echo.
  pause
  exit /b 1
)
echo  [OK] Device ABI  %ABI%  ^(APK folder: %ARCH%^)

rem ---------------------------------------------------------- newest APK
set "OUT=src-tauri\gen\android\app\build\outputs\apk"
set "APK="
set "APK_DATE="

call :newest "%OUT%\%ARCH%\debug"
call :newest "%OUT%\%ARCH%\release"

if "%APK%"=="" (
  echo.
  echo  [X]  No %ARCH% APK has been built yet.
  echo.
  echo       Build one:
  echo           node scripts\build-apk.mjs --arch %ARCH%
  echo.
  echo       ^(`pnpm run build:apk` alone builds arm64, which is for a
  echo        real television, not this emulator.^)
  echo.
  pause
  exit /b 1
)

echo  [OK] APK  %APK%
echo       built %APK_DATE%
echo.

rem A newer APK for a different architecture means this preview is behind the
rem code. Worth saying out loud - it has cost a round of "the fix did not work"
rem more than once.
rem The marker is [**] and not [!] on purpose: with delayed expansion on, cmd
rem eats an exclamation mark in an echo as the start of a !variable! reference,
rem and the whole line came out as " [".
call :newest_any
if defined OTHER_NEWER (
  echo  [**] A newer APK exists for another architecture:
  echo           %OTHER_NEWER%  ^(%OTHER_DATE%^)
  echo       What installs below is older than that. If you are
  echo       checking a recent change, rebuild for this emulator:
  echo           node scripts\build-apk.mjs --arch %ARCH%
  echo.
)

rem ---------------------------------------------------------- install
echo  [..] Installing ^(this takes a while - the APK is large^)...
"%ADB%" install -r "%APK%"
if not errorlevel 1 goto :installed

rem The usual cause is INSTALL_FAILED_UPDATE_INCOMPATIBLE: a build signed with a
rem different key is already on the emulator, and Android will not replace it.
rem Uninstalling is the fix, but it takes the app's data with it, so it is
rem offered rather than done.
echo.
echo  [**] The install did not go through.
echo.
echo       If the message above mentions signatures, a build signed with a
echo       different key is already installed. Replacing it means removing
echo       it first, which also clears the app's settings and library on
echo       this emulator ^(nothing on a real device is touched^).
echo.
set "WIPE="
set /p "WIPE=      Remove it and try again? [y/N] "
if /i not "%WIPE%"=="y" (
  echo.
  echo       Left alone. To do it by hand later:
  echo           "%ADB%" uninstall %PKG%
  echo.
  pause
  exit /b 1
)

echo.
echo  [..] Removing the existing build...
"%ADB%" uninstall %PKG%
echo  [..] Installing again...
"%ADB%" install -r "%APK%"
if errorlevel 1 (
  echo.
  echo  [X]  Still failing. The reason is in the output above.
  echo.
  pause
  exit /b 1
)

:installed
echo  [OK] Installed.
echo.

rem ---------------------------------------------------------- launch
echo  [..] Launching...
"%ADB%" shell am start -n "%ACTIVITY%" >nul 2>&1
if errorlevel 1 (
  echo  [**] Could not start the activity directly; opening from the launcher.
  "%ADB%" shell monkey -p %PKG% -c android.intent.category.LAUNCHER 1 >nul 2>&1
)

echo.
echo ------------------------------------------------------------
echo    Viora is running on %AVD%.
echo.
echo    Drive it with the arrow keys and Enter, the same way the
echo    remote works on a real television.
echo.
echo    Logs:     "%ADB%" logcat -s RustStdoutStderr
echo    Stop:     close the emulator window
echo ------------------------------------------------------------
echo.
pause
exit /b 0


rem ============================================================
rem  Sets APK/APK_DATE to the newest .apk in %1, if it beats what
rem  is already held. `dir /o-d` sorts newest first, so the first
rem  line is the answer.
rem ============================================================
:newest
if not exist "%~1" exit /b 0
for /f "delims=" %%f in ('dir /b /o-d "%~1\*.apk" 2^>nul') do (
  call :consider "%~1\%%f"
  exit /b 0
)
exit /b 0

:consider
for %%f in ("%~1") do (
  if "%APK%"=="" (
    set "APK=%~1"
    set "APK_DATE=%%~tf"
  ) else (
    rem Compare as sortable timestamps rather than the locale's date string.
    call :stamp "%APK%" OLD
    call :stamp "%~1" NEW
    if "!NEW!" GTR "!OLD!" (
      set "APK=%~1"
      set "APK_DATE=%%~tf"
    )
  )
)
exit /b 0

rem Yields yyyyMMddHHmmss for a file, which compares correctly as text.
:stamp
for /f "delims=" %%s in ('powershell -NoProfile -Command "(Get-Item -LiteralPath '%~1').LastWriteTime.ToString('yyyyMMddHHmmss')" 2^>nul') do set "%~2=%%s"
exit /b 0

rem ============================================================
rem  Finds an APK for a *different* architecture that is newer
rem  than the one selected, so a stale preview can be called out.
rem ============================================================
:newest_any
set "OTHER_NEWER="
set "OTHER_DATE="
call :stamp "%APK%" CHOSEN
for %%a in (arm64 arm x86 x86_64) do (
  if /i not "%%a"=="%ARCH%" (
    for %%p in (debug release) do (
      if exist "%OUT%\%%a\%%p" (
        for /f "delims=" %%f in ('dir /b /o-d "%OUT%\%%a\%%p\*.apk" 2^>nul') do (
          call :stamp "%OUT%\%%a\%%p\%%f" CAND
          if "!CAND!" GTR "!CHOSEN!" (
            for %%t in ("%OUT%\%%a\%%p\%%f") do (
              set "OTHER_NEWER=%OUT%\%%a\%%p\%%f"
              set "OTHER_DATE=%%~tt"
              set "CHOSEN=!CAND!"
            )
          )
        )
      )
    )
  )
)
exit /b 0
