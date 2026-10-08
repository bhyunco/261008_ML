import os
import time
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
import numpy as np
import yfinance as yf
from sklearn.tree import DecisionTreeRegressor
from flask import Flask, render_template, jsonify, request, Response, send_file, send_from_directory
import requests
import kosis_collector

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

# 5 Representative Cryptocurrencies
COINS = {
    "BTC": {
        "symbol": "BTC-USD",
        "name_ko": "비트코인",
        "name_en": "Bitcoin",
        "icon": "fa-brands fa-bitcoin",
        "color": "#f7931a",
        "glow": "rgba(247, 147, 26, 0.35)",
        "decimals": 2,
        "tagline": "디지털 금 · 시가총액 1위 가상자산 대장주"
    },
    "ETH": {
        "symbol": "ETH-USD",
        "name_ko": "이더리움",
        "name_en": "Ethereum",
        "icon": "fa-brands fa-ethereum",
        "color": "#627eea",
        "glow": "rgba(98, 126, 234, 0.35)",
        "decimals": 2,
        "tagline": "스마트 컨트랙트 및 디파이 대표 플랫폼"
    },
    "SOL": {
        "symbol": "SOL-USD",
        "name_ko": "솔라나",
        "name_en": "Solana",
        "icon": "fa-solid fa-bolt",
        "color": "#14f195",
        "glow": "rgba(20, 241, 149, 0.35)",
        "decimals": 2,
        "tagline": "초고속 고확장성 고성능 레이어 1 메인넷"
    },
    "XRP": {
        "symbol": "XRP-USD",
        "name_ko": "리플",
        "name_en": "Ripple",
        "icon": "fa-solid fa-water",
        "color": "#00aae4",
        "glow": "rgba(0, 170, 228, 0.35)",
        "decimals": 4,
        "tagline": "국경 간 즉각 정산 및 글로벌 금융 결제 네트워크"
    },
    "DOGE": {
        "symbol": "DOGE-USD",
        "name_ko": "도지코인",
        "name_en": "Dogecoin",
        "icon": "fa-solid fa-paw",
        "color": "#e1b303",
        "glow": "rgba(225, 179, 3, 0.35)",
        "decimals": 4,
        "tagline": "글로벌 대중성을 지닌 대표 커뮤니티 결제 코인"
    }
}

# Cache per coin
cache = {
    code: {
        "data": None,
        "last_fetched": 0,
        "is_fetching": False
    } for code in COINS
}

def calculate_technical_indicators(df):
    """Calculate moving averages (SMA50, SMA200) and RSI (14 days)."""
    df = df.copy()
    df['SMA50'] = df['Close'].rolling(window=50).mean()
    df['SMA200'] = df['Close'].rolling(window=200).mean()

    # RSI (14 days)
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    df['RSI14'] = 100 - (100 / (1 + rs))
    return df

def fetch_crypto_data(coin_code="BTC", force=False):
    """Fetch 10-year data for the specified coin and cache it."""
    coin_code = coin_code.upper()
    if coin_code not in COINS:
        coin_code = "BTC"

    c_meta = COINS[coin_code]
    c_cache = cache[coin_code]

    now = time.time()
    # Cache duration: 2 minutes unless forced
    if not force and c_cache["data"] is not None and (now - c_cache["last_fetched"] < 120):
        return c_cache["data"]

    c_cache["is_fetching"] = True
    try:
        ticker = yf.Ticker(c_meta["symbol"])
        df = ticker.history(period="10y", interval="1d")

        if df.empty:
            if c_cache["data"] is not None:
                return c_cache["data"]
            raise ValueError(f"yfinance에서 {c_meta['name_ko']}({coin_code}) 데이터를 불러오지 못했습니다.")

        df = df.dropna(subset=['Close'])
        df = calculate_technical_indicators(df)

        decimals = c_meta["decimals"]

        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest
        first = df.iloc[0]

        curr_price = float(latest['Close'])
        prev_price = float(prev['Close'])
        change_24h = curr_price - prev_price
        change_24h_pct = (change_24h / prev_price) * 100 if prev_price != 0 else 0

        high_10y = float(df['High'].max())
        high_idx = df['High'].idxmax()
        high_date = high_idx.strftime('%Y-%m-%d') if hasattr(high_idx, 'strftime') else str(high_idx)[:10]

        low_10y = float(df['Low'].min())
        low_idx = df['Low'].idxmin()
        low_date = low_idx.strftime('%Y-%m-%d') if hasattr(low_idx, 'strftime') else str(low_idx)[:10]

        start_price = float(first['Close'])
        start_date = df.index[0].strftime('%Y-%m-%d')
        return_10y_pct = ((curr_price - start_price) / start_price) * 100 if start_price != 0 else 0

        vol_24h = float(latest['Volume'])
        avg_vol_30d = float(df['Volume'].tail(30).mean())
        rsi_val = float(latest['RSI14']) if not np.isnan(latest['RSI14']) else 50.0

        # KST Time (UTC+9)
        kst_tz = timezone(timedelta(hours=9))
        updated_at = datetime.now(kst_tz).strftime('%Y-%m-%d %H:%M:%S KST')

        records = []
        for idx, row in df.iterrows():
            date_str = idx.strftime('%Y-%m-%d') if hasattr(idx, 'strftime') else str(idx)[:10]
            records.append({
                "date": date_str,
                "open": round(float(row['Open']), decimals),
                "high": round(float(row['High']), decimals),
                "low": round(float(row['Low']), decimals),
                "close": round(float(row['Close']), decimals),
                "volume": int(row['Volume']),
                "sma50": round(float(row['SMA50']), decimals) if not np.isnan(row['SMA50']) else None,
                "sma200": round(float(row['SMA200']), decimals) if not np.isnan(row['SMA200']) else None,
            })

        processed_data = {
            "coin": {
                "code": coin_code,
                "name": c_meta["name_ko"],
                "name_en": c_meta["name_en"],
                "symbol": c_meta["symbol"],
                "icon": c_meta["icon"],
                "color": c_meta["color"],
                "glow": c_meta["glow"],
                "decimals": decimals,
                "tagline": c_meta["tagline"]
            },
            "summary": {
                "current_price": round(curr_price, decimals),
                "prev_price": round(prev_price, decimals),
                "change_24h": round(change_24h, decimals),
                "change_24h_pct": round(change_24h_pct, 2),
                "high_10y": round(high_10y, decimals),
                "high_date": high_date,
                "low_10y": round(low_10y, decimals),
                "low_date": low_date,
                "start_price": round(start_price, decimals),
                "start_date": start_date,
                "return_10y_pct": round(return_10y_pct, 2),
                "volume_24h": int(vol_24h),
                "avg_volume_30d": int(avg_vol_30d),
                "rsi_14": round(rsi_val, 1),
                "last_updated": updated_at,
                "total_days": len(df)
            },
            "history": records
        }

        c_cache["data"] = processed_data
        c_cache["last_fetched"] = now
        return processed_data
    finally:
        c_cache["is_fetching"] = False

def train_and_predict_decision_tree(coin_code="BTC"):
    """
    On-demand Machine Learning Price Predictor using DecisionTreeRegressor.
    Preprocesses data relative to today/baseline:
      - Features: D-1, D-2, D-3, D-4, D-5 prices
      - Target: Today's Price
      - Train set: 3 years ago ~ 1 year ago
      - Test set: 1 year ago ~ yesterday
      - Performance Target: MAPE < 5.0%
      - Output: Next-day (tomorrow) price forecast & performance metrics
    """
    coin_code = coin_code.upper()
    if coin_code not in COINS:
        coin_code = "BTC"

    c_meta = COINS[coin_code]
    decimals = c_meta["decimals"]

    # Use fast in-memory cached history or fetch
    data = fetch_crypto_data(coin_code=coin_code, force=False)
    history = data["history"]
    if len(history) < 365 * 3 + 10:
        ticker = yf.Ticker(c_meta["symbol"])
        df_raw = ticker.history(period="5y", interval="1d").dropna(subset=['Close'])
        records = []
        for idx, row in df_raw.iterrows():
            records.append({
                "date": idx.strftime('%Y-%m-%d'),
                "close": float(row['Close']),
                "volume": int(row['Volume'])
            })
        df = pd.DataFrame(records)
    else:
        df = pd.DataFrame(history)

    df['date_dt'] = pd.to_datetime(df['date'])
    df = df.sort_values('date_dt').reset_index(drop=True)
    df['Close'] = df['close'].astype(float)

    # Feature Engineering: D-1, D-2, D-3, D-4, D-5
    # Target: Today's Price (Close)
    df['feat_d1'] = df['Close'].shift(1)
    df['feat_d2'] = df['Close'].shift(2)
    df['feat_d3'] = df['Close'].shift(3)
    df['feat_d4'] = df['Close'].shift(4)
    df['feat_d5'] = df['Close'].shift(5)
    df['target'] = df['Close']
    df_clean = df.dropna().reset_index(drop=True)

    # Date Splitting based on Today (Latest date)
    end_date = df_clean['date_dt'].iloc[-1]
    one_year_ago = end_date - pd.Timedelta(days=365)
    three_years_ago = end_date - pd.Timedelta(days=365 * 3)
    yesterday = end_date - pd.Timedelta(days=1)

    # Train: 3년 전 ~ 1년 전
    train_mask = (df_clean['date_dt'] >= three_years_ago) & (df_clean['date_dt'] < one_year_ago)
    # Test: 1년 전 ~ 어제
    test_mask = (df_clean['date_dt'] >= one_year_ago) & (df_clean['date_dt'] <= yesterday)

    train_df = df_clean[train_mask].copy()
    test_df = df_clean[test_mask].copy()

    if len(train_df) < 30 or len(test_df) < 30:
        split_idx = int(len(df_clean) * 0.7)
        train_df = df_clean.iloc[:split_idx].copy()
        test_df = df_clean.iloc[split_idx:].copy()

    # Preprocessing: Normalize relative to baseline (D-1) for robust convergence and MAPE < 5%
    X_train = pd.DataFrame({
        'd1': train_df['feat_d1'] / train_df['feat_d1'],
        'd2': train_df['feat_d2'] / train_df['feat_d1'],
        'd3': train_df['feat_d3'] / train_df['feat_d1'],
        'd4': train_df['feat_d4'] / train_df['feat_d1'],
        'd5': train_df['feat_d5'] / train_df['feat_d1'],
    })
    y_train = train_df['target'] / train_df['feat_d1']

    X_test = pd.DataFrame({
        'd1': test_df['feat_d1'] / test_df['feat_d1'],
        'd2': test_df['feat_d2'] / test_df['feat_d1'],
        'd3': test_df['feat_d3'] / test_df['feat_d1'],
        'd4': test_df['feat_d4'] / test_df['feat_d1'],
        'd5': test_df['feat_d5'] / test_df['feat_d1'],
    })

    # Train DecisionTreeRegressor
    model = DecisionTreeRegressor(
        max_depth=6,
        min_samples_leaf=5,
        min_samples_split=10,
        criterion='squared_error',
        random_state=42
    )
    model.fit(X_train, y_train)

    # Evaluate on Test set (1년 전 ~ 어제)
    pred_ratios = model.predict(X_test)
    test_preds = pred_ratios * test_df['feat_d1'].values
    test_actuals = test_df['target'].values

    # Evaluation metrics
    mape = float(np.mean(np.abs((test_actuals - test_preds) / test_actuals)) * 100)
    mae = float(np.mean(np.abs(test_actuals - test_preds)))
    rmse = float(np.sqrt(np.mean((test_actuals - test_preds) ** 2)))

    # Directional Accuracy (% match of Up/Down vs D-1)
    actual_dir = np.sign(test_actuals - test_df['feat_d1'].values)
    pred_dir = np.sign(test_preds - test_df['feat_d1'].values)
    dir_accuracy = float(np.mean(actual_dir == pred_dir) * 100)

    # Tomorrow's Forecast Prediction
    recent_closes = df_clean['Close'].tail(5).values
    today_close = recent_closes[-1]
    today_date_str = df_clean['date'].iloc[-1]

    # Future input (Tomorrow): D-1 is Today, D-2 is Yesterday, ..., D-5 is 4 days ago
    X_future = pd.DataFrame([{
        'd1': today_close / today_close,
        'd2': recent_closes[-2] / today_close,
        'd3': recent_closes[-3] / today_close,
        'd4': recent_closes[-4] / today_close,
        'd5': recent_closes[-5] / today_close,
    }])
    future_ratio = float(model.predict(X_future)[0])
    tomorrow_pred_price = round(future_ratio * today_close, decimals)
    price_diff = round(tomorrow_pred_price - today_close, decimals)
    price_diff_pct = round((price_diff / today_close) * 100, 2)

    tomorrow_dt = end_date + pd.Timedelta(days=1)
    tomorrow_date_str = tomorrow_dt.strftime('%Y-%m-%d')

    # Feature Importance (D-1 ~ D-5)
    feat_names = ["D-1 (1일 전)", "D-2 (2일 전)", "D-3 (3일 전)", "D-4 (4일 전)", "D-5 (5일 전)"]
    importances = []
    for name, imp in zip(feat_names, model.feature_importances_):
        importances.append({
            "feature": name,
            "importance": round(float(imp) * 100, 1)
        })

    # Prepare 1-Year Actual vs Predicted Chart Series
    test_dates = [d.strftime('%Y-%m-%d') for d in test_df['date_dt']]
    chart_actual = [round(float(a), decimals) for a in test_actuals]
    chart_pred = [round(float(p), decimals) for p in test_preds]

    # Append Today
    test_dates.append(today_date_str)
    chart_actual.append(round(float(today_close), decimals))

    today_input = pd.DataFrame([{
        'd1': df_clean['feat_d1'].iloc[-1] / df_clean['feat_d1'].iloc[-1],
        'd2': df_clean['feat_d2'].iloc[-1] / df_clean['feat_d1'].iloc[-1],
        'd3': df_clean['feat_d3'].iloc[-1] / df_clean['feat_d1'].iloc[-1],
        'd4': df_clean['feat_d4'].iloc[-1] / df_clean['feat_d1'].iloc[-1],
        'd5': df_clean['feat_d5'].iloc[-1] / df_clean['feat_d1'].iloc[-1],
    }])
    today_pred_ratio = float(model.predict(today_input)[0])
    chart_pred.append(round(today_pred_ratio * df_clean['feat_d1'].iloc[-1], decimals))

    # Append Tomorrow (Forecast Point)
    test_dates.append(f"{tomorrow_date_str} (내일 예측)")
    chart_actual.append(None)
    chart_pred.append(tomorrow_pred_price)

    return {
        "success": True,
        "coin": {
            "code": coin_code,
            "name": c_meta["name_ko"],
            "name_en": c_meta["name_en"],
            "color": c_meta["color"],
            "glow": c_meta["glow"],
            "decimals": decimals
        },
        "model_info": {
            "algorithm": "DecisionTreeRegressor",
            "criterion": "squared_error",
            "max_depth": int(model.get_depth()),
            "n_leaves": int(model.get_n_leaves()),
            "train_count": len(train_df),
            "test_count": len(test_df),
            "train_period": f"{train_df['date'].iloc[0]} ~ {train_df['date'].iloc[-1]} (3년전~1년전)",
            "test_period": f"{test_df['date'].iloc[0]} ~ {test_df['date'].iloc[-1]} (1년전~어제)",
            "features": ["D-1", "D-2", "D-3", "D-4", "D-5 가격"],
            "target": "오늘(D-Day)의 가격"
        },
        "metrics": {
            "mape": round(mape, 2),
            "mape_target": 5.0,
            "target_achieved": bool(mape < 5.0),
            "mae": round(mae, decimals),
            "rmse": round(rmse, decimals),
            "dir_accuracy": round(dir_accuracy, 1)
        },
        "forecast": {
            "today_price": round(float(today_close), decimals),
            "today_date": today_date_str,
            "tomorrow_price": tomorrow_pred_price,
            "tomorrow_date": tomorrow_date_str,
            "diff": price_diff,
            "diff_pct": price_diff_pct,
            "direction": "up" if price_diff >= 0 else "down",
            "tomorrow_krw": int(round(tomorrow_pred_price * 1350))
        },
        "feature_importances": importances,
        "chart": {
            "dates": test_dates,
            "actual": chart_actual,
            "predicted": chart_pred,
            "forecast_index": len(test_dates) - 1
        }
    }

@app.route("/")
@app.route("/api/index")
@app.route("/api/index.py")
def index():
    return render_template("index.html")

@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory(os.path.join(BASE_DIR, "static"), filename)

@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith("/static/"):
        rel_path = request.path.replace("/static/", "", 1)
        return send_from_directory(os.path.join(BASE_DIR, "static"), rel_path)
    if request.path.startswith("/api/") and request.path not in ["/api/index", "/api/index.py"]:
        return jsonify({"success": False, "error": f"API endpoint not found: {request.path}"}), 404
    return render_template("index.html"), 200

@app.route("/api/coins")
def get_coins_overview():
    """Return overview metadata & quick price summary for all 5 coins."""
    overview = []
    for code, info in COINS.items():
        try:
            data = fetch_crypto_data(code, force=False)
            s = data["summary"]
            overview.append({
                "code": code,
                "name": info["name_ko"],
                "name_en": info["name_en"],
                "symbol": info["symbol"],
                "icon": info["icon"],
                "color": info["color"],
                "glow": info["glow"],
                "decimals": info["decimals"],
                "current_price": s["current_price"],
                "change_24h": s["change_24h"],
                "change_24h_pct": s["change_24h_pct"],
                "volume_24h": s["volume_24h"]
            })
        except Exception as e:
            overview.append({
                "code": code,
                "name": info["name_ko"],
                "name_en": info["name_en"],
                "symbol": info["symbol"],
                "icon": info["icon"],
                "color": info["color"],
                "glow": info["glow"],
                "decimals": info["decimals"],
                "current_price": 0,
                "change_24h": 0,
                "change_24h_pct": 0,
                "volume_24h": 0,
                "error": str(e)
            })
    return jsonify({"success": True, "coins": overview})

@app.route("/api/data")
def get_data():
    coin = request.args.get("coin", "BTC").upper()
    force = request.args.get("refresh", "false").lower() == "true"
    try:
        data = fetch_crypto_data(coin_code=coin, force=force)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/refresh", methods=["POST", "GET"])
def refresh_data():
    coin = request.args.get("coin", "BTC").upper()
    try:
        if coin == "ALL":
            with ThreadPoolExecutor(max_workers=5) as executor:
                list(executor.map(lambda c: fetch_crypto_data(c, force=True), COINS.keys()))
            data = fetch_crypto_data("BTC", force=False)
            msg = "대표 5대 암호화폐 데이터가 모두 성공적으로 갱신되었습니다."
        else:
            data = fetch_crypto_data(coin_code=coin, force=True)
            msg = f"{COINS.get(coin, {}).get('name_ko', coin)} 최신 데이터가 성공적으로 갱신되었습니다."
            
        return jsonify({
            "success": True, 
            "message": msg,
            "data": data
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/compare")
def compare_coins():
    """Return normalized return percentage series for all 5 coins."""
    period = request.args.get("range", "1y").lower()
    days_map = {
        '1m': 30,
        '6m': 180,
        '1y': 365,
        '3y': 365 * 3,
        '5y': 365 * 5,
        'all': 365 * 10
    }
    days = days_map.get(period, 365)

    all_dates = set()
    coin_series = {}

    for code in COINS:
        try:
            data = fetch_crypto_data(code, force=False)
            history = data["history"]
            sliced = history[-days:] if len(history) > days else history
            if sliced:
                base_val = sliced[0]["close"]
                pts = {}
                for h in sliced:
                    all_dates.add(h["date"])
                    pct = ((h["close"] - base_val) / base_val) * 100 if base_val != 0 else 0
                    pts[h["date"]] = round(pct, 2)
                coin_series[code] = {
                    "points": pts,
                    "final_return": pts[sliced[-1]["date"]] if sliced else 0
                }
        except Exception:
            continue

    sorted_dates = sorted(list(all_dates))
    datasets = []
    leaderboard = []

    for code, info in COINS.items():
        if code in coin_series:
            pts = coin_series[code]["points"]
            series = []
            last_known = 0
            for d in sorted_dates:
                if d in pts:
                    last_known = pts[d]
                series.append(last_known)

            datasets.append({
                "code": code,
                "label": f"{info['name_ko']} ({code})",
                "borderColor": info["color"],
                "backgroundColor": info["color"],
                "data": series
            })

            leaderboard.append({
                "code": code,
                "name": info["name_ko"],
                "color": info["color"],
                "return_pct": coin_series[code]["final_return"]
            })

    # Sort leaderboard descending
    leaderboard.sort(key=lambda x: x["return_pct"], reverse=True)

    return jsonify({
        "success": True,
        "period": period,
        "labels": sorted_dates,
        "datasets": datasets,
        "leaderboard": leaderboard
    })

@app.route("/api/predict")
def api_predict():
    """
    On-demand AI Price Prediction endpoint using DecisionTreeRegressor.
    Does NOT run automatically; executed only when user clicks.
    """
    coin = request.args.get("coin", "BTC").upper()
    try:
        result = train_and_predict_decision_tree(coin_code=coin)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/download/csv")
def download_csv():
    coin = request.args.get("coin", "BTC").upper()
    try:
        data = fetch_crypto_data(coin_code=coin, force=False)
        history = data["history"]
        df = pd.DataFrame(history)
        csv_data = df.to_csv(index=False, encoding='utf-8-sig')
        filename = f"{coin.lower()}_10y_data.csv"
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==============================================================================
# KOSIS (한국은행 대출금리 비중) API 엔드포인트
# ==============================================================================
kosis_cache = {
    "data": None,
    "last_fetched": 0
}

@app.route("/api/kosis")
def api_kosis():
    """KOSIS 한국은행 예금은행 대출금리 비중 통계 데이터 조회 API"""
    force = request.args.get("refresh", "false").lower() == "true"
    now = time.time()
    try:
        if force or kosis_cache["data"] is None or (now - kosis_cache["last_fetched"] > 300):
            data = kosis_collector.get_processed_kosis_data()
            kosis_cache["data"] = data
            kosis_cache["last_fetched"] = now
        return jsonify(kosis_cache["data"])
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/kosis/download")
def api_kosis_download():
    """kosis.xlsx 엑셀 파일 다운로드 엔드포인트"""
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kosis.xlsx")
    if not os.path.exists(file_path):
        kosis_collector.fetch_and_save_kosis_data(target_filename="kosis.xlsx")
    return send_file(
        file_path,
        as_attachment=True,
        download_name="kosis.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@app.route("/api/kosis/refresh", methods=["GET", "POST"])
def api_kosis_refresh():
    """KOSIS API 재호출, kosis.xlsx 갱신 및 캐시 업데이트"""
    try:
        df, file_path = kosis_collector.fetch_and_save_kosis_data(target_filename="kosis.xlsx")
        data = kosis_collector.get_processed_kosis_data()
        kosis_cache["data"] = data
        kosis_cache["last_fetched"] = time.time()
        return jsonify({
            "success": True,
            "message": "KOSIS 한국은행 금리 통계 데이터 및 kosis.xlsx 저장이 완료되었습니다.",
            "data": data
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

def prewarm_cache():
    """Pre-warm in-memory cache for all 5 coins and KOSIS macro data on launch."""
    print("[INFO] 대표 5대 코인(BTC, ETH, SOL, XRP, DOGE) 데이터를 불러오는 중입니다...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_crypto_data, code, True): code for code in COINS}
        for f in futures:
            code = futures[f]
            try:
                f.result()
                print(f"[INFO] {code} 데이터 준비 완료!")
            except Exception as ex:
                print(f"[WARN] {code} 데이터 로드 중 오류: {ex}")

    print("[INFO] KOSIS 한국은행 금리 통계 데이터를 확인/수집 중입니다...")
    try:
        k_data = kosis_collector.get_processed_kosis_data()
        kosis_cache["data"] = k_data
        kosis_cache["last_fetched"] = time.time()
        print("[INFO] KOSIS 통계 데이터 및 kosis.xlsx 준비 완료!")
    except Exception as ex:
        print(f"[WARN] KOSIS 데이터 로드 중 오류: {ex}")

if __name__ == "__main__":
    prewarm_cache()
    app.run(host="127.0.0.1", port=5000, debug=False)

