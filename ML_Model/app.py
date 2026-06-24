# ============================================================
# STGNN DEPLOYMENT API
# deployment/app.py
# ============================================================

import os
import sys
import pickle
import urllib.request
import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List

try:
    from google.cloud import storage
    GCS_CLIENT_AVAILABLE = True
except ImportError:
    GCS_CLIENT_AVAILABLE = False


# Ensure the module directory is in the import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from model import STGNN
from recommendation import (
    compute_management_results,
    compute_linkwise_management,
)

# ============================================================
# CONFIG
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def get_path(env_var, default_name):
    val = os.getenv(env_var)
    if val:
        return val
    return os.path.join(SCRIPT_DIR, default_name)

MODEL_PATH        = get_path("MODEL_PATH",        "stgnn_traffic_model.pth")
X_SCALER_PATH     = get_path("X_SCALER_PATH",     "x_scaler.pkl")
EVENT_SCALER_PATH = get_path("EVENT_SCALER_PATH", "event_scaler.pkl")
Y_SCALER_PATH     = get_path("Y_SCALER_PATH",     "y_scaler.pkl")
A_ROAD_PATH       = get_path("A_ROAD_PATH",       "A_road.npy")
A_TRAFFIC_PATH    = get_path("A_TRAFFIC_PATH",    "A_traffic.npy")
A_EVENT_PATH      = get_path("A_EVENT_PATH",      "A_event.npy")

FEATURE_COLS = [
    "travel_time", "speed", "volume", "queue_delay",
    "veh_delay", "stops", "occupancy", "queue_length",
    "tt_missing_flag", "speed_missing_flag", "volume_missing_flag"
]
EVENT_COLS = [
    "event_active", "event_exposure", "event_intensity",
    "lanes_blocked", "event_duration", "event_link_id"
]

# ============================================================
# LOAD MODEL
# ============================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = STGNN(F_in=len(FEATURE_COLS), Fe=len(EVENT_COLS)).to(device)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.eval()

# ============================================================
# LOAD SCALERS
# ============================================================

with open(X_SCALER_PATH,     "rb") as f: x_scaler     = pickle.load(f)
with open(EVENT_SCALER_PATH, "rb") as f: event_scaler = pickle.load(f)
with open(Y_SCALER_PATH,     "rb") as f: y_scaler     = pickle.load(f)

A_road    = np.load(A_ROAD_PATH)
A_traffic = np.load(A_TRAFFIC_PATH)
A_event   = np.load(A_EVENT_PATH)

A_road_t    = torch.FloatTensor(A_road).unsqueeze(0).to(device)
A_traffic_t = torch.FloatTensor(A_traffic).unsqueeze(0).to(device)
A_event_t   = torch.FloatTensor(A_event).unsqueeze(0).to(device)

# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(title="STGNN Traffic Prediction API")


class PredictRequest(BaseModel):
    X: List[List[List[float]]]   # (SEQ_LEN, N_nodes, n_features)
    E: List[List[List[float]]]   # (SEQ_LEN, N_nodes, n_event_cols)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(req: PredictRequest):
    try:
        X_np = np.array(req.X, dtype=np.float32)   # (T, N, F)
        E_np = np.array(req.E, dtype=np.float32)   # (T, N, Fe)

        X_t = torch.FloatTensor(X_np).unsqueeze(0).to(device)  # (1,T,N,F)
        E_t = torch.FloatTensor(E_np).unsqueeze(0).to(device)  # (1,T,N,Fe)

        with torch.no_grad():
            pred = model(
                X_t, E_t,
                A_road_t.repeat(1, 1, 1),
                A_traffic_t.repeat(1, 1, 1),
                A_event_t.repeat(1, 1, 1),
            )

        preds_np  = pred.cpu().numpy().reshape(-1, 3)
        preds_inv = y_scaler.inverse_transform(preds_np)
        preds_inv[:, 2] = np.expm1(preds_inv[:, 2])

        E_test_np = E_np[np.newaxis, ...]
        mgmt_df   = compute_management_results(preds_inv, E_test_np)
        mgmt_df   = compute_linkwise_management(mgmt_df)

        return mgmt_df.to_dict(orient="records")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# GCS CLOUD LOOP ACTIONS
# ============================================================

LINKS = ["L19", "L13", "L6", "L17", "L18", "L1", "L16", "L3"]
LINK_TO_IDX = {l: i for i, l in enumerate(LINKS)}
N = len(LINKS)

GCS_INPUT_BUCKET = os.getenv("GCS_INPUT_BUCKET", "input_parameters")
GCS_OUTPUT_BUCKET = os.getenv("GCS_OUTPUT_BUCKET", "output_measures")
INPUT_FILE_NAME = "Kerala_Traffic_Dataset_With_Coordinates.csv"
OUTPUT_FILE_NAME = "traffic_management_results.csv"


def upload_to_gcs(bucket_name, local_file, target_blob):
    if not GCS_CLIENT_AVAILABLE:
        print("GCS client not available, skipping upload.")
        return False
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(target_blob)
        blob.upload_from_filename(local_file)
        print(f"Successfully uploaded {local_file} to gs://{bucket_name}/{target_blob}")
        return True
    except Exception as e:
        print(f"Failed to upload to GCS: {e}")
        return False


def download_inputs_from_gcs():
    local_path = os.path.join(SCRIPT_DIR, INPUT_FILE_NAME)
    url = f"https://storage.googleapis.com/{GCS_INPUT_BUCKET}/{INPUT_FILE_NAME}"
    print(f"Downloading inputs from {url} to {local_path}...")
    try:
        if GCS_CLIENT_AVAILABLE:
            try:
                client = storage.Client()
                bucket = client.bucket(GCS_INPUT_BUCKET)
                blob = bucket.blob(INPUT_FILE_NAME)
                blob.download_to_filename(local_path)
                print("Downloaded inputs via GCS client.")
                return local_path
            except Exception as client_err:
                print(f"GCS client download failed: {client_err}. Trying HTTP fallback...")
        
        # HTTP fallback
        urllib.request.urlretrieve(url, local_path)
        print("Downloaded inputs via HTTP.")
        return local_path
    except Exception as e:
        print(f"Failed to download inputs: {e}")
        if os.path.exists(local_path):
            print("Using cached local input file.")
            return local_path
        
        # Search fallbacks
        fallback_paths = [
            os.path.join(SCRIPT_DIR, "..", INPUT_FILE_NAME),
            os.path.join(SCRIPT_DIR, "..", "public", INPUT_FILE_NAME)
        ]
        for path in fallback_paths:
            if os.path.exists(path):
                print(f"Using fallback file at {path}")
                import shutil
                shutil.copy(path, local_path)
                return local_path
        raise FileNotFoundError(f"Input file not found and download failed: {e}")


def run_inference_on_latest():
    input_path = download_inputs_from_gcs()
    df = pd.read_csv(input_path)
    
    # Fill missing values
    for col in df.select_dtypes(include=[np.number]).columns:
        df[col] = df[col].fillna(df[col].median())
        
    df["link_id_str"] = df["link_id"].apply(lambda x: f"L{x}" if not str(x).startswith("L") else str(x))
    df = df[df["link_id_str"].isin(LINKS)].copy()
    df = df.sort_values(["timestamp", "link_id_str"]).reset_index(drop=True)
    
    unique_timestamps = sorted(df["timestamp"].unique())
    if len(unique_timestamps) < 172:
        print(f"Warning: Only {len(unique_timestamps)} timestamps available. Using all of them.")
        target_timestamps = unique_timestamps
    else:
        target_timestamps = unique_timestamps[-172:]
        
    print(f"Processing prediction sequence over {len(target_timestamps)} timestamps...")
    
    SEQ_LEN = 4
    results = []
    
    grouped = {t: tdf.set_index("link_id_str") for t, tdf in df[df["timestamp"].isin(target_timestamps)].groupby("timestamp")}
    
    for i in range(SEQ_LEN, len(target_timestamps)):
        X_seq = np.zeros((SEQ_LEN, N, 11), dtype=np.float32)
        E_seq = np.zeros((SEQ_LEN, N, 6), dtype=np.float32)
        
        queue_true_vals = np.zeros(N, dtype=np.float32)
        delay_true_vals = np.zeros(N, dtype=np.float32)
        
        for seq_idx in range(SEQ_LEN):
            t_step = target_timestamps[i - SEQ_LEN + 1 + seq_idx]
            tdf = grouped.get(t_step)
            
            for n_idx, link in enumerate(LINKS):
                if tdf is not None and link in tdf.index:
                    row = tdf.loc[link]
                    X_seq[seq_idx, n_idx, 0] = row["travel_time"]
                    X_seq[seq_idx, n_idx, 1] = row["speed"]
                    X_seq[seq_idx, n_idx, 2] = row["volume"]
                    X_seq[seq_idx, n_idx, 3] = row["queue_delay"]
                    X_seq[seq_idx, n_idx, 4] = row["veh_delay"]
                    X_seq[seq_idx, n_idx, 5] = row["stops"]
                    X_seq[seq_idx, n_idx, 6] = row["occupancy"]
                    X_seq[seq_idx, n_idx, 7] = row["queue_length"]
                    
                    if seq_idx == SEQ_LEN - 1:
                        queue_true_vals[n_idx] = row["queue_length"]
                        delay_true_vals[n_idx] = row["veh_delay"]
                else:
                    X_seq[seq_idx, n_idx, 8] = 1.0
                    X_seq[seq_idx, n_idx, 9] = 1.0
                    X_seq[seq_idx, n_idx, 10] = 1.0
                    
        # Normalization
        X_cont = X_seq[:, :, :8].reshape(-1, 8)
        X_cont_scaled = x_scaler.transform(X_cont)
        X_seq_scaled = X_seq.copy()
        X_seq_scaled[:, :, :8] = X_cont_scaled.reshape(SEQ_LEN, N, 8)
        
        E_cont = E_seq[:, :, :5].reshape(-1, 5)
        E_cont_scaled = event_scaler.transform(E_cont)
        E_seq_scaled = E_seq.copy()
        E_seq_scaled[:, :, :5] = E_cont_scaled.reshape(SEQ_LEN, N, 5)
        
        X_t = torch.FloatTensor(X_seq_scaled).unsqueeze(0).to(device)
        E_t = torch.FloatTensor(E_seq_scaled).unsqueeze(0).to(device)
        
        with torch.no_grad():
            pred = model(
                X_t, E_t,
                A_road_t.repeat(1, 1, 1),
                A_traffic_t.repeat(1, 1, 1),
                A_event_t.repeat(1, 1, 1)
            )
            
        preds_np = pred.cpu().numpy().reshape(-1, 3)
        preds_inv = y_scaler.inverse_transform(preds_np)
        preds_inv[:, 2] = np.expm1(preds_inv[:, 2])
        
        horizon_sec = (i - SEQ_LEN) * 5
        for n_idx, link in enumerate(LINKS):
            results.append({
                "prediction_horizon_sec": horizon_sec,
                "link": link,
                "queue_true": float(queue_true_vals[n_idx]),
                "queue_pred": float(preds_inv[n_idx, 0]),
                "delay_true": float(delay_true_vals[n_idx]),
                "delay_pred": float(preds_inv[n_idx, 1]),
            })
            
    results_df = pd.DataFrame(results)
    results_df["prediction_horizon_min"] = results_df["prediction_horizon_sec"] / 60.0
    results_df = compute_linkwise_management(results_df)
    
    output_path = os.path.join(SCRIPT_DIR, OUTPUT_FILE_NAME)
    results_df.to_csv(output_path, index=False)
    print(f"Local predictions file written to {output_path}")
    
    public_dir = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "public"))
    if os.path.exists(public_dir):
        dest_public = os.path.join(public_dir, OUTPUT_FILE_NAME)
        results_df.to_csv(dest_public, index=False)
        print(f"Copied predictions to frontend public directory at {dest_public}")
        
    upload_to_gcs(GCS_OUTPUT_BUCKET, output_path, OUTPUT_FILE_NAME)
    return results_df.to_dict(orient="records")


@app.post("/trigger-prediction")
def trigger_prediction(background_tasks: BackgroundTasks):
    try:
        background_tasks.add_task(run_inference_on_latest)
        return {
            "status": "triggered",
            "message": "Inference loop triggered on latest GCS telemetry. Output measures will refresh shortly."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
