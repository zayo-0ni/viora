@echo off
setlocal enabledelayedexpansion
title Viora - phone preview (future)
cd /d "%~dp0.."

chcp 65001 >nul 2>&1

rem ============================================================
rem  Phone emulator launcher. Kept for later.
rem
rem  Viora targets an Android television. The phone layout - the
rem  bottom tab bar, the touch targets, the gesture handling - was
rem  removed from the app, so what installs here today is the TV
rem  build running on a phone-shaped screen. It will start, and it
rem  will be driven by a D-pad it does not have.
rem
rem  This file exists so the day the phone build comes back, the
rem  way to look at it is already here. It is deliberately the same
rem  script as TV\run-tv-emulator.bat pointed at a phone AVD.
rem ============================================================

set "PKG=app.viora"
set "ACTIVITY=app.viora/.MainActivity"
set "AVD=%~1"

cls
echo ============================================================
echo    Viora  -  phone preview
echo ============================================================
echo.
echo  Note: the phone layout is not in the app right now. This
echo  installs the television build, which expects a remote.
echo  See the top of this file, and the "One target" section of
echo  README.md, for what that means.
echo.

rem ---------------------------------------------------------- SDK
set "SDK=%ANDROID_HOME%"
if "%SDK%"=="" set "SDK=%ANDROID_SDK_ROOT%"
if "%SDK%"=="" set "SDK=%LOCALAPPDATA%\Android\Sdk"

set "ADB=%SDK%\platform-tools\adb.exe"
set "EMU=%SDK%\emulator\emulator.exe"

if not exist "%ADB%" (
  echo  [X]  adb not found at:
  echo       %ADB%
  echo.
  echo       Set ANDROID_HOME to your SDK folder.
  echo.
  pause
  exit /b 1
)
if not exist "%EMU%" (
  echo  [X]  The emulator was not found at:
  echo       %EMU%
  echo.
  pause
  exit /b 1
)
echo  [OK] SDK  %SDK%
echo.

rem ---------------------------------------------------------- pick an AVD
rem No phone AVD exists yet - the two that do are both Android TV images.
rem Rather than guess, this lists what is there and explains how to make one.
if "%AVD%"=="" (
  echo  [..] No AVD given. Looking for a phone image...
  set "PHONE="
  for /f "delims=" %%a in ('"%EMU%" -list-avds 2^>nul') do (
    echo %%a | findstr /i "tv" >nul
    if errorlevel 1 if not defined PHONE set "PHONE=%%a"
  )
  if defined PHONE (
    set "AVD=!PHONE!"
    echo  [OK] Using !PHONE!
  ) else (
    echo.
    echo  [X]  There is no phone emulator on this PC yet.
    echo.
    echo       Everything installed is an Android TV image:
    for /f "delims=" %%a in ('"%EMU%" -list-avds 2^>nul') do echo         %%a
    echo.
    echo       To create one, open Android Studio:
    echo           Tools -^> Device Manager -^> Create Device
    echo           pick a phone ^(Pixel 7 is a fine default^)
    echo           choose an x86_64 system image
    echo.
    echo       Then run this file again, or name it directly:
    echo           run-mobile-emulator.bat Pixel_7_API_34
    echo.
    pause
    exit /b 1
  )
  echo.
)

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
  pause
  exit /b 1
)
echo  [OK] AVD  %AVD%
echo.

rem ---------------------------------------------------------- running already?
set "DEVICE="
for /f "skip=1 tokens=1,2" %%d in ('"%ADB%" devices 2^>nul') do (
  if "%%e"=="device" if not defined DEVICE set "DEVICE=%%d"
)

if defined DEVICE (
  echo  [OK] An emulator is already running ^(%DEVICE%^) - using it.
) else (
  echo  [..] Starting %AVD%...
  start "Viora phone emulator" "%EMU%" -avd "%AVD%"
  "%ADB%" wait-for-device
  if errorlevel 1 (
    echo  [X]  The device never appeared.
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
set "ABI="
for /f "delims=" %%a in ('"%ADB%" shell getprop ro.product.cpu.abi 2^>nul') do set "ABI=%%a"
set "ABI=%ABI: =%"

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
  pause
  exit /b 1
)

echo  [OK] APK  %APK%
echo       built %APK_DATE%
echo.

echo  [..] Installing...
"%ADB%" install -r "%APK%"
if not errorlevel 1 goto :installed

rem See TV\run-tv-emulator.bat: the marker avoids "!", which cmd eats as the
rem start of a !variable! reference when delayed expansion is on.
echo.
echo  [**] The install did not go through.
echo.
echo       If the message above mentions signatures, a build signed with a
echo       different key is already installed. Replacing it means removing
echo       it first, which also clears the app's data on this emulator.
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

echo  [..] Launching...
"%ADB%" shell am start -n "%ACTIVITY%" >nul 2>&1
if errorlevel 1 (
  "%ADB%" shell monkey -p %PKG% -c android.intent.category.LAUNCHER 1 >nul 2>&1
)

echo.
echo ------------------------------------------------------------
echo    Viora is running on %AVD%.
echo.
echo    Expect a television layout: a side rail rather than a
echo    bottom tab bar, and focus that moves by D-pad. Use the
echo    arrow keys and Enter.
echo ------------------------------------------------------------
echo.
pause
exit /b 0


rem ============================================================
rem  Newest .apk in %1, if it beats what is already held.
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
    call :stamp "%APK%" OLD
    call :stamp "%~1" NEW
    if "!NEW!" GTR "!OLD!" (
      set "APK=%~1"
      set "APK_DATE=%%~tf"
    )
  )
)
exit /b 0

:stamp
for /f "delims=" %%s in ('powershell -NoProfile -Command "(Get-Item -LiteralPath '%~1').LastWriteTime.ToString('yyyyMMddHHmmss')" 2^>nul') do set "%~2=%%s"
exit /b 0
