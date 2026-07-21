@echo off
cd /d "%~dp0"

echo AboWandler wird vorbereitet...

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js wurde nicht gefunden.
  echo Bitte installiere es ^(kostenlos^) von https://nodejs.org ^(LTS-Version^) und starte dieses Programm danach erneut.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installiere Frontend-Komponenten ^(einmalig, kann ein paar Minuten dauern^)...
  call npm install
)

if not exist server\node_modules (
  echo Installiere Backend-Komponenten ^(einmalig^)...
  pushd server
  call npm install
  popd
)

if not exist dist (
  echo Baue die App ^(einmalig^)...
  call npm run build
)

set ABOWANDLER_STATIC_DIR=%cd%\dist
if not defined PORT set PORT=8787
rem HOST is intentionally not forced here — the server defaults to 0.0.0.0
rem (reachable from your phone on the same WiFi) unless you set HOST
rem yourself before running this script, e.g. to point it at a real
rem server/host later or lock it back to 127.0.0.1-only.

echo Starte AboWandler...
pushd server
start "AboWandler-Server" cmd /k "node index.js"
popd

echo Warte, bis der Server bereit ist...
timeout /t 4 /nobreak >nul

start "" http://127.0.0.1:%PORT%

echo.
echo AboWandler laeuft jetzt in deinem Browser.
echo Auf dem Handy ^(im selben WLAN^) siehst du im Fenster "AboWandler-Server" die Netzwerk-Adresse zum Oeffnen.
echo Falls die Seite leer ist, warte kurz und laden sie neu ^(F5^).
echo Zum Beenden: das Fenster "AboWandler-Server" schliessen.
echo.
pause
