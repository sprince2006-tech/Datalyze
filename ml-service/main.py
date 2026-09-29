from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
import re
import os
import warnings
import traceback

warnings.filterwarnings("ignore")

app = FastAPI(title="DataLyze ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5000").split(","),
    allow_methods=["*"], allow_headers=["*"],
)

_datasets: dict = {}
MAX_ROWS_IN = 200_000
MAX_STORED = 200


class DataPayload(BaseModel):
    dataset_id: str
    rows: list
    columns: Optional[list] = None


def _store(dataset_id: str, df: pd.DataFrame):
    if dataset_id not in _datasets and len(_datasets) >= MAX_STORED:
        _datasets.pop(next(iter(_datasets)))
    _datasets[dataset_id] = df


def _get_df(dataset_id: str) -> pd.DataFrame:
    if dataset_id not in _datasets:
        raise HTTPException(404, f"Dataset {dataset_id} not loaded. Call /analyse-data first.")
    return _datasets[dataset_id]


# ── Column role detection ───────────────────────────────────────────
ID_RE = re.compile(r"(_id$|^id$|order.?id|order.?no|invoice|serial|uuid|sku|code)", re.IGNORECASE)


def _try_date(v):
    try:
        pd.to_datetime(v, errors="raise")
        return True
    except Exception:
        return False


def detect_role(series: pd.Series, name: str) -> str:
    s = series.dropna()
    if s.empty:
        return "empty"
    if ID_RE.search(str(name)) and series.nunique() / max(len(series), 1) > 0.9:
        return "id"
    if s.dtype == object:
        sample = s.head(20).astype(str)
        if sum(1 for v in sample if _try_date(v)) / max(len(sample), 1) > 0.7:
            return "date"
    if pd.api.types.is_numeric_dtype(s):
        if s.nunique() <= 10 and s.nunique() / max(len(s), 1) < 0.1:
            return "category"
        return "numeric"
    if s.nunique() <= 20:
        return "category"
    return "text"


def analyse_df(df: pd.DataFrame) -> dict:
    columns = []
    for col in df.columns:
        s = df[col]
        role = detect_role(s, col)
        entry = {
            "name": col, "role": role, "dtype": str(s.dtype),
            "null_count": int(s.isna().sum()),
            "null_pct": round(float(s.isna().mean() * 100), 2),
            "unique": int(s.nunique()),
        }
        if role == "numeric":
            c = s.dropna()
            entry.update({
                "min": round(float(c.min()), 4) if len(c) else None,
                "max": round(float(c.max()), 4) if len(c) else None,
                "mean": round(float(c.mean()), 4) if len(c) else None,
                "median": round(float(c.median()), 4) if len(c) else None,
                "std": round(float(c.std()), 4) if len(c) else None,
                "skew": round(float(c.skew()), 4) if len(c) > 2 else None,
            })
        elif role == "category":
            vc = s.value_counts()
            entry["top_values"] = {str(k): int(v) for k, v in vc.head(10).items()}
        elif role == "date":
            parsed = pd.to_datetime(s, errors="coerce").dropna()
            if not parsed.empty:
                entry.update({
                    "min_date": str(parsed.min().date()),
                    "max_date": str(parsed.max().date()),
                    "date_range_days": int((parsed.max() - parsed.min()).days),
                })
        columns.append(entry)

    numeric_cols = [c["name"] for c in columns if c["role"] == "numeric"]
    correlations = []
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr(method="pearson")
        for i, a in enumerate(numeric_cols):
            for j, b in enumerate(numeric_cols):
                if i < j:
                    v = corr.loc[a, b]
                    if not np.isnan(v):
                        correlations.append({
                            "col_a": a, "col_b": b,
                            "correlation": round(float(v), 4),
                            "strength": _corr_str(v),
                        })
        correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)

    return {
        "row_count": len(df),
        "col_count": len(df.columns),
        "columns": columns,
        "correlations": correlations,
        "recommendations": recommend(columns),
        "kpis": build_kpis(columns, df),
        "insights": insights(columns, correlations),
    }


def _corr_str(v):
    a = abs(v)
    if a >= 0.8: return "very strong"
    if a >= 0.6: return "strong"
    if a >= 0.4: return "moderate"
    if a >= 0.2: return "weak"
    return "very weak"


PREFERRED = ["total", "amount", "revenue", "sales", "profit", "price", "cost", "income", "value", "sum"]
AVOID = ["percent", "pct", "rate", "ratio", "score", "age", "year", "month", "day", "discount", "tax"]


def _best_num(numeric):
    def score(c):
        name = c["name"].lower()
        s = (c.get("std") or 0) / max(abs(c.get("mean") or 1), 1)
        if any(p in name for p in PREFERRED): s += 100
        if any(a in name for a in AVOID): s -= 50
        return s
    return max(numeric, key=score)


def recommend(columns) -> list:
    recs = []
    numeric = [c for c in columns if c["role"] == "numeric"]
    category = [c for c in columns if c["role"] == "category"]
    dates = [c for c in columns if c["role"] == "date"]

    # ── Line: best numeric over the date column ───────────────────────
    if dates and numeric:
        best = _best_num(numeric)
        recs.append({
            "id": "rec_line", "chartType": "line", "icon": "📈",
            "title": f"{best['name']} over Time",
            "reason": f"'{dates[0]['name']}' is a date — line chart shows {best['name']} trend.",
            "xCol": dates[0]["name"], "yCol": best["name"], "confidence": 97,
        })

    # ── Bar: best numeric by the smallest category column ─────────────
    if category and numeric:
        bcat = min(category, key=lambda c: c["unique"])
        if bcat["unique"] >= 2:
            best = _best_num(numeric)
            recs.append({
                "id": "rec_bar", "chartType": "bar", "icon": "📊",
                "title": f"{best['name']} by {bcat['name']}",
                "reason": f"'{bcat['name']}' has {bcat['unique']} categories — bar chart compares {best['name']} across groups.",
                "xCol": bcat["name"], "yCol": best["name"], "confidence": 93,
            })

    # ── Donut: distribution of the smallest category column ───────────
    good_cat = [c for c in category if 2 <= c["unique"] <= 8]
    if good_cat:
        recs.append({
            "id": "rec_donut", "chartType": "donut", "icon": "🍩",
            "title": f"Distribution by {good_cat[0]['name']}",
            "reason": f"'{good_cat[0]['name']}' has {good_cat[0]['unique']} categories — donut shows proportions.",
            "xCol": good_cat[0]["name"], "yCol": numeric[0]["name"] if numeric else None, "confidence": 90,
        })

    # ── Scatter: two real numeric columns ─────────────────────────────
    real = [c for c in numeric if (c.get("std") or 0) > 0]
    if len(real) >= 2:
        recs.append({
            "id": "rec_scatter", "chartType": "scatter", "icon": "🔵",
            "title": f"{real[0]['name']} vs {real[1]['name']}",
            "reason": "Two real numeric columns — reveals correlation and distribution.",
            "xCol": real[0]["name"], "yCol": real[1]["name"], "confidence": 85,
        })

    # ── Area: second-best numeric over the date column ────────────────
    if dates and len(numeric) >= 2:
        area_col = numeric[1] if numeric[0]["name"] == _best_num(numeric)["name"] else numeric[0]
        recs.append({
            "id": "rec_area", "chartType": "area", "icon": "📉",
            "title": f"{area_col['name']} over Time",
            "reason": f"Cumulative {area_col['name']} over {dates[0]['name']}.",
            "xCol": dates[0]["name"], "yCol": area_col["name"], "confidence": 78,
        })

    # ── De-duplicate by (type, xCol, yCol) ────────────────────────────
    seen = set()
    unique = []
    for r in recs:
        k = f"{r['chartType']}|{r.get('xCol', '')}|{r.get('yCol', '')}"
        if k not in seen:
            seen.add(k)
            unique.append(r)
    return sorted(unique, key=lambda x: x["confidence"], reverse=True)[:6]


def build_kpis(columns, df):
    kpis = []
    for col in [c for c in columns if c["role"] == "numeric"][:4]:
        vals = pd.to_numeric(df[col["name"]], errors="coerce").dropna()
        if vals.empty:
            continue
        kpis.append({
            "column": col["name"],
            "label": col["name"].replace("_", " ").title(),
            "sum": round(float(vals.sum()), 2),
            "avg": round(float(vals.mean()), 2),
            "min": col.get("min"), "max": col.get("max"), "std": col.get("std"),
        })
    return kpis


def insights(columns, correlations):
    out = []
    for col in columns:
        if col["null_pct"] > 5:
            out.append({"type": "warning", "message": f"'{col['name']}' has {col['null_pct']}% missing values."})
    for c in correlations[:3]:
        if abs(c["correlation"]) >= 0.6:
            dir_ = "positively" if c["correlation"] > 0 else "negatively"
            out.append({"type": "info", "message": f"'{c['col_a']}' and '{c['col_b']}' are {c['strength']} correlated ({dir_}, r={c['correlation']})."})
    ids = [c for c in columns if c["role"] == "id"]
    if ids:
        out.append({"type": "success", "message": f"ID columns detected: {', '.join(c['name'] for c in ids)}."})
    if not out:
        out.append({"type": "success", "message": "Dataset looks clean."})
    return out


# ── Chart data helpers ──────────────────────────────────────────────
def _is_date_col(series: pd.Series) -> bool:
    if pd.api.types.is_datetime64_any_dtype(series):
        return True
    if pd.api.types.is_numeric_dtype(series):
        return False
    if series.dtype == object:
        sample = series.dropna().head(10).astype(str)
        if len(sample) == 0:
            return False
        return sum(1 for v in sample if _try_date(v)) / len(sample) > 0.7
    return False


def _period_freq(parsed: pd.Series) -> str:
    """Frequency alias valid for DataFrame.to_period()."""
    parsed = parsed.dropna().sort_values()
    if len(parsed) < 2:
        return "D"
    span_days = (parsed.iloc[-1] - parsed.iloc[0]).days
    if span_days <= 90:      return "D"
    if span_days <= 365 * 2: return "W"
    if span_days <= 365 * 5: return "M"
    return "Y"


def _resample_freq(parsed: pd.Series) -> str:
    """Frequency alias valid for Series.resample() in pandas 2.2+."""
    parsed = parsed.dropna().sort_values()
    if len(parsed) < 2:
        return "D"
    span_days = (parsed.iloc[-1] - parsed.iloc[0]).days
    if span_days <= 90:      return "D"
    if span_days <= 365 * 2: return "W"
    if span_days <= 365 * 5: return "ME"
    return "YE"


def _convert_x_values(df: pd.DataFrame, x_col: str) -> pd.DataFrame:
    series = df[x_col]
    df2 = df.copy()

    if pd.api.types.is_datetime64_any_dtype(series):
        freq = _period_freq(series)
        df2[x_col] = series.dt.to_period(freq).astype(str)
        print(f"[chart-data] x='{x_col}' already datetime, freq='{freq}'")
        return df2

    if pd.api.types.is_numeric_dtype(series):
        df2[x_col] = series.astype(str)
        return df2

    try:
        parsed = pd.to_datetime(series, errors="coerce")
    except Exception as e:
        print(f"[chart-data] date parse error for '{x_col}': {e}")
        df2[x_col] = series.astype(str)
        return df2

    valid_ratio = parsed.notna().sum() / max(len(parsed), 1)
    print(f"[chart-data] x='{x_col}' dtype={series.dtype} date-valid-ratio={valid_ratio:.2f}")

    if valid_ratio > 0.5:
        freq = _period_freq(parsed)
        print(f"[chart-data] using to_period freq='{freq}' for '{x_col}'")
        df2[x_col] = parsed.dt.to_period(freq).astype(str)
        df2 = df2[df2[x_col] != "NaT"]
        return df2

    df2[x_col] = series.astype(str)
    return df2


def build_chart_data(df, x_col, y_col=None, chart_type="bar", max_cat=30):
    try:
        if x_col not in df.columns:
            print(f"[chart-data] x_col '{x_col}' not in columns: {list(df.columns)}")
            return []

        df2 = _convert_x_values(df, x_col)

        if len(df2) == 0:
            print(f"[chart-data] no rows left after x conversion for '{x_col}'")
            return []

        if chart_type in ("pie", "donut") or not y_col:
            df2 = df2.dropna(subset=[x_col])
            counts = df2[x_col].value_counts().head(max_cat)
            result = [{"name": str(k), "value": int(v)} for k, v in counts.items()]
            print(f"[chart-data] {chart_type} '{x_col}' → {len(result)} points")
            return result

        if y_col not in df2.columns:
            print(f"[chart-data] y_col '{y_col}' not in columns: {list(df2.columns)}")
            return []

        df2[y_col] = pd.to_numeric(df2[y_col], errors="coerce")
        df2 = df2.dropna(subset=[x_col, y_col])

        if len(df2) == 0:
            print(f"[chart-data] no valid rows for x='{x_col}', y='{y_col}'")
            return []

        grouped = df2.groupby(x_col)[y_col].sum()

        if chart_type in ("line", "area"):
            grouped = grouped.sort_index()
        else:
            grouped = grouped.sort_values(ascending=False)

        grouped = grouped.head(max_cat)

        result = [{"name": str(k), "value": round(float(v), 4)} for k, v in grouped.items()]
        print(f"[chart-data] {chart_type} x='{x_col}' y='{y_col}' → {len(result)} points")
        return result

    except Exception as e:
        print(f"[chart-data] EXCEPTION x='{x_col}', y='{y_col}': {e}")
        traceback.print_exc()
        return []


def build_scatter(df, x_col, y_col, max_pts=500):
    try:
        t = df[[x_col, y_col]].copy()
        t[x_col] = pd.to_numeric(t[x_col], errors="coerce")
        t[y_col] = pd.to_numeric(t[y_col], errors="coerce")
        t = t.dropna()
        if len(t) > max_pts:
            t = t.sample(max_pts, random_state=42)
        print(f"[chart-data] scatter x='{x_col}' y='{y_col}' → {len(t)} points")
        return [{"x": round(float(r[x_col]), 4), "y": round(float(r[y_col]), 4)} for _, r in t.iterrows()]
    except Exception as e:
        print(f"[chart-data] scatter EXCEPTION x='{x_col}' y='{y_col}': {e}")
        return []


def corr_heatmap(df):
    try:
        ndf = df.select_dtypes(include=[np.number])
        cols = [c for c in ndf.columns if ndf[c].nunique() / max(len(ndf), 1) < 0.95]
        if len(cols) < 2:
            return {"error": "Need 2+ non-ID numeric columns"}
        corr = ndf[cols].corr(method="pearson")
        cells = [{"x": a, "y": b, "value": round(float(corr.loc[a, b]), 3)} for a in cols for b in cols]
        return {"columns": cols, "cells": cells}
    except Exception as e:
        return {"error": str(e)}


# ── Routes ──────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "DataLyze ML", "version": "1.0.0"}


@app.post("/analyse-data")
def analyse_data(payload: DataPayload):
    if not payload.rows:
        raise HTTPException(400, "Empty rows")
    if len(payload.rows) > MAX_ROWS_IN:
        raise HTTPException(413, f"Too many rows (max {MAX_ROWS_IN})")
    df = pd.DataFrame(payload.rows)
    _store(payload.dataset_id, df)
    result = analyse_df(df)
    result["dataset_id"] = payload.dataset_id
    return {"success": True, "data": result}


@app.post("/auto-dashboard")
def auto_dashboard(payload: DataPayload):
    if not payload.rows:
        raise HTTPException(400, "Empty rows")
    if len(payload.rows) > MAX_ROWS_IN:
        raise HTTPException(413, f"Too many rows (max {MAX_ROWS_IN})")
    df = pd.DataFrame(payload.rows)
    _store(payload.dataset_id, df)
    result = analyse_df(df)
    charts = []
    for rec in result["recommendations"]:
        if rec["chartType"] == "scatter" and rec.get("yCol"):
            d = build_scatter(df, rec["xCol"], rec["yCol"])
        elif rec.get("xCol"):
            d = build_chart_data(df, rec["xCol"], rec.get("yCol"), rec["chartType"])
        else:
            d = []
        charts.append({**rec, "data": d})
    return {"success": True, "data": {
        "kpis": result["kpis"],
        "charts": charts,
        "columns": result["columns"],
        "insights": result["insights"],
        "correlations": result["correlations"][:5],
        "row_count": result["row_count"],
        "col_count": result["col_count"],
        "engine": "python",
    }}


@app.get("/chart-data/{dataset_id}")
def get_chart_data(dataset_id: str, x_col: str, y_col: Optional[str] = None, chart_type: str = "bar"):
    df = _get_df(dataset_id)
    if chart_type == "scatter" and y_col:
        return {"success": True, "data": build_scatter(df, x_col, y_col)}
    return {"success": True, "data": build_chart_data(df, x_col, y_col, chart_type)}


@app.get("/correlation/{dataset_id}")
def get_correlation(dataset_id: str):
    df = _get_df(dataset_id)
    result = corr_heatmap(df)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return {"success": True, "data": result}


@app.get("/forecast/{dataset_id}")
def get_forecast(dataset_id: str, date_col: str, value_col: str, periods: int = 30):
    df = _get_df(dataset_id)
    if periods < 1 or periods > 365:
        raise HTTPException(400, "periods must be 1–365")
    d = df[[date_col, value_col]].copy()
    d[date_col] = pd.to_datetime(d[date_col], errors="coerce")
    d[value_col] = pd.to_numeric(d[value_col], errors="coerce")
    d = d.dropna().sort_values(date_col)
    if len(d) < 4:
        raise HTTPException(400, "Need at least 4 rows")
    s = d.groupby(date_col)[value_col].sum()
    freq = _resample_freq(pd.Series(s.index))
    s = s.resample(freq).sum().fillna(0)
    historical = [{"date": str(i.date()), "value": round(float(v), 2)} for i, v in s.items()]

    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        if len(s) >= 8:
            fit = ExponentialSmoothing(s, trend="add", seasonal=None).fit(optimized=True)
            fcast = fit.forecast(periods)
        else:
            raise ValueError("short")
    except Exception:
        from scipy.stats import linregress
        x = np.arange(len(s))
        slope, intercept, *_ = linregress(x, s.values)
        fcast_idx = pd.date_range(s.index[-1], periods=periods + 1, freq=freq)[1:]
        fcast = pd.Series(
            [max(intercept + slope * xi, 0) for xi in np.arange(len(s), len(s) + periods)],
            index=fcast_idx,
        )

    future_idx = pd.date_range(s.index[-1], periods=periods + 1, freq=freq)[1:]
    predicted = [
        {"date": str(d_.date()), "value": round(max(float(v), 0), 2), "forecast": True}
        for d_, v in zip(future_idx, fcast)
    ]
    return {"success": True, "data": {
        "historical": historical, "predicted": predicted,
        "date_col": date_col, "value_col": value_col,
        "periods": periods, "frequency": freq,
    }}


@app.get("/anomaly/{dataset_id}")
def get_anomaly(dataset_id: str, column: str, method: str = "iqr"):
    df = _get_df(dataset_id)
    if column not in df.columns:
        raise HTTPException(400, "Column not found")
    from scipy import stats as sp_stats
    s = pd.to_numeric(df[column], errors="coerce").dropna()
    if len(s) < 4:
        raise HTTPException(400, "Need 4+ numeric values")
    if method == "zscore":
        scores = np.abs(sp_stats.zscore(s))
        mask = scores > 3
    else:
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        mask = (s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)
        scores = np.abs(s - s.median()) / (iqr + 1e-9)
    score_map = dict(zip(s.index, scores))
    anomalies = set(s[mask].index)
    chart_data = [
        {"index": int(i), "value": round(float(v), 4),
         "anomaly": i in anomalies, "score": round(float(score_map[i]), 4)}
        for i, v in s.items()
    ]
    return {"success": True, "data": {
        "column": column, "method": method,
        "total_points": len(s), "anomaly_count": int(mask.sum()),
        "anomaly_pct": round(float(mask.mean() * 100), 2),
        "chart_data": chart_data,
    }}


@app.get("/cluster/{dataset_id}")
def get_cluster(dataset_id: str, n_clusters: Optional[int] = None):
    df = _get_df(dataset_id)
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    from sklearn.metrics import silhouette_score

    ndf = df.select_dtypes(include=[np.number]).dropna(axis=1)
    if ndf.shape[1] < 2:
        raise HTTPException(400, "Need 2+ numeric columns")
    if len(ndf) < 4:
        raise HTTPException(400, "Need 4+ rows")
    scaled = StandardScaler().fit_transform(ndf)

    if n_clusters is None:
        best_k, best_s = 2, -1
        for k in range(2, min(9, len(ndf))):
            try:
                labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(scaled)
                s = silhouette_score(scaled, labels)
                if s > best_s:
                    best_s, best_k = s, k
            except Exception:
                pass
        n_clusters = best_k

    if n_clusters < 2 or n_clusters >= len(ndf):
        raise HTTPException(400, "Invalid cluster count")

    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = km.fit_predict(scaled)
    sil = float(silhouette_score(scaled, labels))
    coords = PCA(n_components=2).fit_transform(scaled)
    chart_data = [
        {"x": round(float(coords[i, 0]), 4), "y": round(float(coords[i, 1]), 4),
         "cluster": int(labels[i]), "label": f"Cluster {labels[i] + 1}"}
        for i in range(len(ndf))
    ]
    ndf2 = ndf.assign(_cluster=labels)
    summaries = []
    for k in range(n_clusters):
        g = ndf2[ndf2["_cluster"] == k]
        summaries.append({
            "cluster": k + 1, "size": len(g),
            "pct": round(len(g) / len(ndf2) * 100, 1),
            "profile": {c: round(float(g[c].mean()), 3) for c in g.columns if c != "_cluster"},
        })
    return {"success": True, "data": {
        "n_clusters": n_clusters, "silhouette_score": round(sil, 4),
        "chart_data": chart_data, "summaries": summaries,
    }}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))