import os
import requests
import pandas as pd

# KOSIS API 주소
url = "https://kosis.kr/openapi/Param/statisticsParameterData.do?method=getList&apiKey=MDUxZTY2ZTk5ZWE0ZTM3YzdhY2FiMzU4YWU1ZWY1MDg=&itmId=13103134554999+&objL1=ALL&objL2=&objL3=&objL4=&objL5=&objL6=&objL7=&objL8=&format=json&jsonVD=Y&prdSe=M&newEstPrdCnt=3&orgId=301&tblId=DT_121Y010"

# 항목 레이블 매핑 (C1 코드 기준 표준 명칭)
C1_LABEL_MAP = {
    '13102134554ACC_ITEM.LC10000': '기업-고정금리대출',
    '13102134554ACC_ITEM.LC20000': '기업-변동금리대출',
    '13102134554ACC_ITEM.LC20100': '기업-기타금리연동 등',
    '13102134554ACC_ITEM.LC20200': '기업-시장금리연동',
    '13102134554ACC_ITEM.LC20300': '기업-수신금리연동',
    '13102134554ACC_ITEM.LC99999': '기업-합계',
    '13102134554ACC_ITEM.LH10000': '가계-고정금리대출',
    '13102134554ACC_ITEM.LH20000': '가계-변동금리대출',
    '13102134554ACC_ITEM.LH20100': '가계-기타금리연동 등',
    '13102134554ACC_ITEM.LH20200': '가계-시장금리연동',
    '13102134554ACC_ITEM.LH20300': '가계-수신금리연동',
    '13102134554ACC_ITEM.LH99999': '가계-합계',
    '13102134554ACC_ITEM.LN10000': '주택담보대출-고정금리대출',
    '13102134554ACC_ITEM.LN20000': '주택담보대출-변동금리대출',
    '13102134554ACC_ITEM.LN20100': '주택담보대출-기타금리연동 등',
    '13102134554ACC_ITEM.LN20200': '주택담보대출-시장금리연동',
    '13102134554ACC_ITEM.LN20300': '주택담보대출-수신금리연동',
    '13102134554ACC_ITEM.LN99999': '주택담보대출-합계',
}

def fetch_and_save_kosis_data(target_dir=None, target_filename="kosis.xlsx"):
    """
    KOSIS API로부터 데이터를 수집하여 엑셀 파일로 저장하고 결과를 출력 및 반환합니다.
    원본 기능 및 출력 형식을 100% 유지합니다.
    """
    # 1. URL에 접속해서 데이터를 가져오기
    response = requests.get(url, timeout=15)
    response.raise_for_status()

    # 2. JSON 데이터를 파이썬 데이터로 변환
    data = response.json()

    # 3. 리스트 안에 있는 딕셔너리를 DataFrame으로 변환
    df = pd.DataFrame(data)

    # 4. 현재 폴더에 저장할 파일 경로 만들기
    if target_dir is None:
        target_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
    file_path = os.path.join(target_dir, target_filename)

    # 5. 엑셀 파일로 저장
    df.to_excel(file_path, index=False)

    # 6. 결과 확인
    print("엑셀 파일 저장 완료!")
    print("저장 위치:", file_path)
    print()
    print(df)

    return df, file_path

def get_processed_kosis_data(target_dir=None):
    """
    Flask API 및 웹 대시보드 시각화용 가공 데이터를 생성하여 반환합니다.
    """
    if target_dir is None:
        target_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
    file_path = os.path.join(target_dir, "kosis.xlsx")

    # 엑셀 파일이 이미 존재하면 로드, 없으면 새로 수집
    if os.path.exists(file_path):
        try:
            df = pd.read_excel(file_path)
        except Exception:
            df, file_path = fetch_and_save_kosis_data(target_dir=target_dir)
    else:
        df, file_path = fetch_and_save_kosis_data(target_dir=target_dir)

    # 수치형 변환
    df['DT_NUM'] = pd.to_numeric(df['DT'], errors='coerce')
    df['C1_CLEAN_NM'] = df['C1'].map(C1_LABEL_MAP).fillna(df['C1_NM'])

    # 조사 기간 (월별 정렬)
    raw_periods = sorted(list(df['PRD_DE'].astype(str).unique()))
    formatted_periods = [f"{p[:4]}-{p[4:]}" for p in raw_periods]
    latest_prd = raw_periods[-1] if raw_periods else ""
    latest_prd_fmt = f"{latest_prd[:4]}년 {latest_prd[4:]}월" if len(latest_prd) == 6 else latest_prd

    # 최신 월 요약 데이터 산출
    latest_df = df[df['PRD_DE'].astype(str) == latest_prd]

    def get_val(c1_code):
        row = latest_df[latest_df['C1'] == c1_code]
        if not row.empty:
            return round(float(row['DT_NUM'].iloc[0]), 2)
        return 0.0

    summary = {
        "latest_period": latest_prd_fmt,
        "latest_period_raw": latest_prd,
        "household": {
            "name": "가계대출",
            "fixed": get_val('13102134554ACC_ITEM.LH10000'),
            "floating": get_val('13102134554ACC_ITEM.LH20000'),
            "market": get_val('13102134554ACC_ITEM.LH20200'),
            "deposit": get_val('13102134554ACC_ITEM.LH20300'),
        },
        "mortgage": {
            "name": "주택담보대출",
            "fixed": get_val('13102134554ACC_ITEM.LN10000'),
            "floating": get_val('13102134554ACC_ITEM.LN20000'),
            "market": get_val('13102134554ACC_ITEM.LN20200'),
            "deposit": get_val('13102134554ACC_ITEM.LN20300'),
        },
        "corporate": {
            "name": "기업대출",
            "fixed": get_val('13102134554ACC_ITEM.LC10000'),
            "floating": get_val('13102134554ACC_ITEM.LC20000'),
            "market": get_val('13102134554ACC_ITEM.LC20200'),
            "deposit": get_val('13102134554ACC_ITEM.LC20300'),
        }
    }

    # 차트용 월별 시계열 데이터셋
    chart_series = {
        "periods": formatted_periods,
        "datasets": [
            {
                "label": "가계대출 변동금리 (%)",
                "borderColor": "#ef4444",
                "backgroundColor": "rgba(239, 68, 68, 0.15)",
                "data": [float(df[(df['C1'] == '13102134554ACC_ITEM.LH20000') & (df['PRD_DE'].astype(str) == p)]['DT_NUM'].iloc[0]) if not df[(df['C1'] == '13102134554ACC_ITEM.LH20000') & (df['PRD_DE'].astype(str) == p)].empty else 0 for p in raw_periods]
            },
            {
                "label": "가계대출 고정금리 (%)",
                "borderColor": "#10b981",
                "backgroundColor": "rgba(16, 185, 129, 0.15)",
                "data": [float(df[(df['C1'] == '13102134554ACC_ITEM.LH10000') & (df['PRD_DE'].astype(str) == p)]['DT_NUM'].iloc[0]) if not df[(df['C1'] == '13102134554ACC_ITEM.LH10000') & (df['PRD_DE'].astype(str) == p)].empty else 0 for p in raw_periods]
            },
            {
                "label": "주택담보대출 변동금리 (%)",
                "borderColor": "#f59e0b",
                "backgroundColor": "rgba(245, 158, 11, 0.15)",
                "data": [float(df[(df['C1'] == '13102134554ACC_ITEM.LN20000') & (df['PRD_DE'].astype(str) == p)]['DT_NUM'].iloc[0]) if not df[(df['C1'] == '13102134554ACC_ITEM.LN20000') & (df['PRD_DE'].astype(str) == p)].empty else 0 for p in raw_periods]
            },
            {
                "label": "주택담보대출 고정금리 (%)",
                "borderColor": "#3b82f6",
                "backgroundColor": "rgba(59, 130, 246, 0.15)",
                "data": [float(df[(df['C1'] == '13102134554ACC_ITEM.LN10000') & (df['PRD_DE'].astype(str) == p)]['DT_NUM'].iloc[0]) if not df[(df['C1'] == '13102134554ACC_ITEM.LN10000') & (df['PRD_DE'].astype(str) == p)].empty else 0 for p in raw_periods]
            },
            {
                "label": "기업대출 변동금리 (%)",
                "borderColor": "#8b5cf6",
                "backgroundColor": "rgba(139, 92, 246, 0.15)",
                "data": [float(df[(df['C1'] == '13102134554ACC_ITEM.LC20000') & (df['PRD_DE'].astype(str) == p)]['DT_NUM'].iloc[0]) if not df[(df['C1'] == '13102134554ACC_ITEM.LC20000') & (df['PRD_DE'].astype(str) == p)].empty else 0 for p in raw_periods]
            },
            {
                "label": "기업대출 고정금리 (%)",
                "borderColor": "#06b6d4",
                "backgroundColor": "rgba(6, 182, 212, 0.15)",
                "data": [float(df[(df['C1'] == '13102134554ACC_ITEM.LC10000') & (df['PRD_DE'].astype(str) == p)]['DT_NUM'].iloc[0]) if not df[(df['C1'] == '13102134554ACC_ITEM.LC10000') & (df['PRD_DE'].astype(str) == p)].empty else 0 for p in raw_periods]
            }
        ]
    }

    # 전체 데이터 레코드 (테이블 뷰용)
    records = []
    for _, row in df.iterrows():
        c1_clean = row['C1_CLEAN_NM']
        category = "기타"
        if "가계" in str(c1_clean) or "Hous" in str(row.get('C1_NM_ENG', '')):
            category = "가계대출"
        elif "주택담보" in str(c1_clean) or "Mortgages" in str(row.get('C1_NM_ENG', '')):
            category = "주택담보대출"
        elif "기업" in str(c1_clean) or "Corp" in str(row.get('C1_NM_ENG', '')):
            category = "기업대출"

        prd_str = str(row['PRD_DE'])
        prd_fmt = f"{prd_str[:4]}-{prd_str[4:]}" if len(prd_str) == 6 else prd_str

        records.append({
            "category": category,
            "c1_code": str(row['C1']),
            "item_name": str(c1_clean),
            "item_name_eng": str(row.get('C1_NM_ENG', '')),
            "period": prd_fmt,
            "period_raw": prd_str,
            "value": float(row['DT_NUM']) if pd.notna(row['DT_NUM']) else None,
            "unit": str(row.get('UNIT_NM', '%')),
            "updated_at": str(row.get('LST_CHN_DE', ''))
        })

    # 파일 메타 정보
    stat_info = os.stat(file_path) if os.path.exists(file_path) else None
    file_size_kb = round(stat_info.st_size / 1024, 1) if stat_info else 0
    file_mtime = pd.to_datetime(stat_info.st_mtime, unit='s').strftime('%Y-%m-%d %H:%M:%S') if stat_info else ""

    return {
        "success": True,
        "title": "예금은행 고정 및 변동금리대출 비중(신규취급액 기준)",
        "source": "KOSIS 국가통계포털 · 한국은행 (표 ID: DT_121Y010, 기관 ID: 301)",
        "summary": summary,
        "chart_data": chart_series,
        "records": records,
        "total_records": len(records),
        "file_info": {
            "filename": os.path.basename(file_path),
            "filepath": file_path,
            "size_kb": file_size_kb,
            "last_saved": file_mtime
        }
    }

if __name__ == "__main__":
    # 원본 코드 실행
    # 1. URL에 접속해서 데이터를 가져오기
    response = requests.get(url)

    # 2. JSON 데이터를 파이썬 데이터로 변환
    data = response.json()

    # 3. 리스트 안에 있는 딕셔너리를 DataFrame으로 변환
    df = pd.DataFrame(data)

    # 4. 현재 폴더에 저장할 파일 경로 만들기
    file_path = os.path.join(os.getcwd(), "kosis.xlsx")

    # 5. 엑셀 파일로 저장
    df.to_excel(file_path, index=False)

    # 6. 결과 확인
    print("엑셀 파일 저장 완료!")
    print("저장 위치:", file_path)
    print()
    print(df)
