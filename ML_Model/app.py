# ============================================================
# STGNN DEPLOYMENT API
# deployment/app.py
# ============================================================

import os
import pickle
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from model import STGNN
from recommendation import (
    compute_management_results,
    compute_linkwise_management,
)

# ============================================================
# CONFIG
# ============================================================

MODEL_PATH        = os.getenv("MODEL_PATH",        "stgnn_traffic_model.pth")
X_SCALER_PATH     = os.getenv("X_SCALER_PATH",     "x_scaler.pkl")
EVENT_SCALER_PATH = os.getenv("EVENT_SCALER_PATH", "event_scaler.pkl")
Y_SCALER_PATH     = os.getenv("Y_SCALER_PATH",     "y_scaler.pkl")
A_ROAD_PATH       = os.getenv("A_ROAD_PATH",       "A_road.npy")
A_TRAFFIC_PATH    = os.getenv("A_TRAFFIC_PATH",    "A_traffic.npy")
A_EVENT_PATH      = os.getenv("A_EVENT_PATH",      "A_event.npy")

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
