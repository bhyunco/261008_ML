@echo off
chcp 65001 > nul
title 비트코인 10년 시세 분석기 (Flask)
echo ======================================================================
echo    비트코인(BTC) 10년 거래데이터 분석 & 실시간 웹앱 실행기
echo ======================================================================
echo.
echo 웹 서버를 시작합니다. 잠시만 기다려주세요...
echo 브라우저에서 아래 주소로 접속하실 수 있습니다:
echo -> http://127.0.0.1:5000
echo.
"C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe" app.py
pause
