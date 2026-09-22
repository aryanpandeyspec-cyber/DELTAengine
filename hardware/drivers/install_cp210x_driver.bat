@echo off
echo ========================================================
echo Installing Silicon Labs CP210x USB to UART Driver...
echo ========================================================
powershell -Command "Start-Process pnputil -ArgumentList '/add-driver \"%~dp0CP210x_Windows_Driver\silabser.inf\" /install' -Verb RunAs -Wait"
echo Done! If prompted by Windows UAC, please click 'Yes' to authorize.
pause
