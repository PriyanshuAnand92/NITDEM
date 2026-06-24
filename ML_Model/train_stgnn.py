# ============================================================
# STGNN TRAINING PIPELINE
# training/train_stgnn.py
#
# Run from the training/ folder:
#   python train_stgnn.py
#
# Outputs written to deployment/:
#   stgnn_traffic_model.pth
#   x_scaler.pkl  |  event_scaler.pkl  |  y_scaler.pkl
#   A_road.npy    |  A_traffic.npy     |  A_event.npy
#
# Outputs written to datasets/:
#   traffic_with_dissipation.csv
#   linkwise_predictions.csv
#   traffic_management_results.csv
# ============================================================

import sys
import os
import random
import pickle

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# ---- path so we can import model.py and recommendation.py ----
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from model import STGNN
from recommendation import (
    compute_management_results,
    compute_linkwise_management,
    print_recommendations,
)

# Use current ML_Model directory for model files and scalers
DEPLOY_DIR  = os.path.dirname(os.path.abspath(__file__))
# Check if datasets/ folder exists, else fallback to root directory where link1.xlsx is located
DATASET_DIR = os.path.join(ROOT, "datasets")
if not os.path.exists(DATASET_DIR):
    DATASET_DIR = ROOT

# ============================================================
# REPRODUCIBILITY
# ============================================================

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

# ============================================================
# LOAD DATA
# ============================================================

DATA_PATH = os.path.join(DATASET_DIR, "link1.xlsx")
df = pd.read_excel(DATA_PATH)

# ============================================================
# HANDLE MISSING VALUES
# ============================================================

print("\nMISSING VALUES BEFORE CLEANING")
print(df.isna().sum())

for col in df.select_dtypes(include=[np.number]).columns:
    df[col] = df[col].fillna(df[col].median())

for col in df.select_dtypes(exclude=[np.number]).columns:
    df[col] = df[col].fillna(df[col].mode()[0])

print("\nMISSING VALUES AFTER CLEANING")
print(df.isna().sum())

# ============================================================
# SORT & LINK ORDER
# ============================================================

df = df.sort_values(["scenario_code", "link_id", "time_s"]).reset_index(drop=True)

links       = ["L19", "L13", "L6", "L17", "L18", "L1", "L16", "L3"]
link_to_idx = {l: i for i, l in enumerate(links)}
idx_to_link = {i: l for l, i in link_to_idx.items()}
N           = len(links)

# ============================================================
# ENCODE EVENT LINK
# ============================================================

df["event_link_id"] = df["event_link"].map(link_to_idx)

# ============================================================
# EVENT DURATION
# ============================================================

def add_event_duration(df):
    df["event_duration"] = 0
    for scen in df["scenario_code"].unique():
        mask     = df["scenario_code"] == scen
        scen_df  = df[mask]
        active   = scen_df[scen_df["event_active"] == 1]["time_s"].nunique()
        df.loc[mask, "event_duration"] = active * 5
    return df

df = add_event_duration(df)

# ============================================================
# DISSIPATION TIME
# ============================================================

print("\nCALCULATING DISSIPATION TIME")
df["dissipation_time"] = 0.0
TIME_INTERVAL = 5

for scenario in df["scenario_code"].unique():
    sdf = df[df["scenario_code"] == scenario]
    for link in links:
        ldf = sdf[sdf["link_id"] == link].sort_values("time_s")
        q   = ldf["queue_length"].values
        if len(q) == 0:
            continue
        QUEUE_THRESHOLD = max(5, 0.05 * np.max(q))
        dissipation = np.zeros(len(q))
        for i in range(len(q)):
            if q[i] <= QUEUE_THRESHOLD:
                dissipation[i] = 0
            else:
                future    = q[i:]
                recovered = np.where(future <= QUEUE_THRESHOLD)[0]
                dissipation[i] = (recovered[0] if len(recovered) > 0 else len(future)) * TIME_INTERVAL
        df.loc[ldf.index, "dissipation_time"] = dissipation

df["dissipation_time"] = np.log1p(df["dissipation_time"])
print("DISSIPATION TIME ADDED + LOG TRANSFORMED")

df.to_csv(os.path.join(DATASET_DIR, "traffic_with_dissipation.csv"), index=False)
print("UPDATED CSV SAVED")
print(df[["queue_length", "dissipation_time"]].head(30))

# ============================================================
# FEATURE / EVENT / TARGET COLUMNS
# ============================================================

feature_cols = [
    "travel_time", "speed", "volume", "queue_delay",
    "veh_delay", "stops", "occupancy", "queue_length",
    "tt_missing_flag", "speed_missing_flag", "volume_missing_flag"
]
event_cols = [
    "event_active", "event_exposure", "event_intensity",
    "lanes_blocked", "event_duration", "event_link_id"
]
target_cols = ["queue_length", "veh_delay", "dissipation_time"]

# ============================================================
# NORMALIZATION
# ============================================================

continuous_feature_cols = [
    "travel_time", "speed", "volume", "queue_delay",
    "veh_delay", "stops", "occupancy", "queue_length"
]
continuous_event_cols = [
    "event_active", "event_exposure", "event_intensity",
    "lanes_blocked", "event_duration"
]

x_scaler     = StandardScaler()
event_scaler = StandardScaler()
y_scaler     = MinMaxScaler()

df[continuous_feature_cols] = x_scaler.fit_transform(df[continuous_feature_cols])
df[continuous_event_cols]   = event_scaler.fit_transform(df[continuous_event_cols])
df[target_cols]             = y_scaler.fit_transform(df[target_cols])

df.replace([np.inf, -np.inf], 0, inplace=True)
df.fillna(0, inplace=True)

# ============================================================
# ADJACENCY MATRICES
# ============================================================

def build_road_adjacency():
    A = np.zeros((N, N))
    connections = [
        ("L19","L18"), ("L19","L1"),
        ("L16","L18"), ("L16","L1"),
        ("L13","L6"),  ("L13","L17"),
        ("L3","L6"),   ("L3","L17"),
        ("L6","L19"),  ("L6","L13"),
        ("L17","L16"), ("L17","L3"),
        ("L18","L19"), ("L18","L13"),
        ("L1","L16"),  ("L1","L3"),
    ]
    for src, dst in connections:
        A[link_to_idx[src], link_to_idx[dst]] = 1
    return A + np.eye(N)

def build_traffic_adjacency(df):
    pivot = df.pivot_table(
        index=["scenario_code", "time_s"],
        columns="link_id", values="volume"
    )
    corr = np.abs(pivot.corr().fillna(0).clip(-1, 1).values)
    return corr + np.eye(N)

def build_event_adjacency():
    A = np.array([[np.exp(-abs(i - j)) for j in range(N)] for i in range(N)])
    return A + np.eye(N)

A_road    = build_road_adjacency()
A_traffic = build_traffic_adjacency(df)
A_event   = build_event_adjacency()

# ============================================================
# SEQUENCE BUILDER
# ============================================================

SEQ_LEN = 4

def build_sequences(scenario_list):
    X_list, E_list, Y_list = [], [], []
    for scen in scenario_list:
        scen_df = df[df["scenario_code"] == scen]
        times   = sorted(scen_df["time_s"].unique())
        X_seq, E_seq, Y_seq = [], [], []
        for t in times:
            tdf = scen_df[scen_df["time_s"] == t]
            X_t = np.zeros((N, len(feature_cols)))
            E_t = np.zeros((N, len(event_cols)))
            Y_t = np.zeros((N, len(target_cols)))
            for _, row in tdf.iterrows():
                idx = link_to_idx[row["link_id"]]
                X_t[idx] = row[feature_cols].values
                ev = row[event_cols].copy()
                ev["event_link_id"] /= 7.0
                E_t[idx] = ev.values
                Y_t[idx] = row[target_cols].values
            X_seq.append(X_t); E_seq.append(E_t); Y_seq.append(Y_t)
        X_seq = np.array(X_seq)
        E_seq = np.array(E_seq)
        Y_seq = np.array(Y_seq)
        for i in range(len(times) - SEQ_LEN):
            X_list.append(X_seq[i:i + SEQ_LEN])
            E_list.append(E_seq[i:i + SEQ_LEN])
            Y_list.append(Y_seq[i + SEQ_LEN])
    return np.array(X_list), np.array(E_list), np.array(Y_list)

scenarios       = df["scenario_code"].unique()
train_scenarios = scenarios[:80]
test_scenarios  = scenarios[80:]

X_train, E_train, Y_train = build_sequences(train_scenarios)
X_test,  E_test,  Y_test  = build_sequences(test_scenarios)

print("\nDATA SHAPES")
print("X_train:", X_train.shape, "| E_train:", E_train.shape, "| Y_train:", Y_train.shape)
print("X_test :", X_test.shape,  "| E_test :", E_test.shape,  "| Y_test :", Y_test.shape)

# ============================================================
# DATASET & DATALOADER
# ============================================================

class TrafficDataset(Dataset):
    def __init__(self, X, E, Y):
        self.X, self.E, self.Y = X, E, Y
    def __len__(self):
        return len(self.X)
    def __getitem__(self, idx):
        return {
            "X": torch.FloatTensor(self.X[idx]),
            "E": torch.FloatTensor(self.E[idx]),
            "Y": torch.FloatTensor(self.Y[idx]),
        }

train_loader = DataLoader(TrafficDataset(X_train, E_train, Y_train), batch_size=16, shuffle=True)
test_loader  = DataLoader(TrafficDataset(X_test,  E_test,  Y_test),  batch_size=16, shuffle=False)

# ============================================================
# MODEL SETUP
# ============================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("\nUsing device:", device)

model = STGNN(F_in=len(feature_cols), Fe=len(event_cols)).to(device)

A_road_t    = torch.FloatTensor(A_road).unsqueeze(0).to(device)
A_traffic_t = torch.FloatTensor(A_traffic).unsqueeze(0).to(device)
A_event_t   = torch.FloatTensor(A_event).unsqueeze(0).to(device)

criterion = nn.HuberLoss(delta=1.0)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer, mode="min", factor=0.5, patience=10
)

# ============================================================
# TRAINING LOOP
# ============================================================

EPOCHS    = 150
best_loss = 1e9

for epoch in range(EPOCHS):
    model.train()
    total_loss = 0
    for batch in train_loader:
        X = batch["X"].to(device)
        E = batch["E"].to(device)
        Y = batch["Y"].to(device)
        B = X.shape[0]
        optimizer.zero_grad()
        pred = model(
            X, E,
            A_road_t.repeat(B, 1, 1),
            A_traffic_t.repeat(B, 1, 1),
            A_event_t.repeat(B, 1, 1),
        )
        loss = criterion(pred, Y)
        if torch.isnan(loss):
            print("NaN LOSS — skipping batch")
            continue
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        total_loss += loss.item()

    avg_loss = total_loss / len(train_loader)
    scheduler.step(avg_loss)
    print(f"Epoch {epoch+1}/{EPOCHS}  Loss: {avg_loss:.6f}")

    if avg_loss < best_loss:
        best_loss = avg_loss
        torch.save(model.state_dict(), os.path.join(DEPLOY_DIR, "stgnn_traffic_model.pth"))
        print("  >> Best model saved")

# Graph fusion weights
w = torch.softmax(model.graph_fusion.weights, dim=0)
print("\nGraph Fusion Weights")
print(f"  Road:    {w[0].item():.4f}")
print(f"  Traffic: {w[1].item():.4f}")
print(f"  Event:   {w[2].item():.4f}")

# ============================================================
# SAVE SCALERS & ADJACENCY MATRICES (separate files)
# ============================================================

with open(os.path.join(DEPLOY_DIR, "x_scaler.pkl"),     "wb") as f: pickle.dump(x_scaler, f)
with open(os.path.join(DEPLOY_DIR, "event_scaler.pkl"), "wb") as f: pickle.dump(event_scaler, f)
with open(os.path.join(DEPLOY_DIR, "y_scaler.pkl"),     "wb") as f: pickle.dump(y_scaler, f)

np.save(os.path.join(DEPLOY_DIR, "A_road.npy"),    A_road)
np.save(os.path.join(DEPLOY_DIR, "A_traffic.npy"), A_traffic)
np.save(os.path.join(DEPLOY_DIR, "A_event.npy"),   A_event)

print("\nSaved to deployment/:")
print("  x_scaler.pkl | event_scaler.pkl | y_scaler.pkl")
print("  A_road.npy   | A_traffic.npy    | A_event.npy")
print("  stgnn_traffic_model.pth")

# ============================================================
# EVALUATION
# ============================================================

model.eval()
preds, trues = [], []

with torch.no_grad():
    for batch in test_loader:
        X = batch["X"].to(device)
        E = batch["E"].to(device)
        Y = batch["Y"].to(device)
        B = X.shape[0]
        pred = model(
            X, E,
            A_road_t.repeat(B, 1, 1),
            A_traffic_t.repeat(B, 1, 1),
            A_event_t.repeat(B, 1, 1),
        )
        preds.append(pred.cpu().numpy())
        trues.append(Y.cpu().numpy())

preds = np.concatenate(preds)
trues = np.concatenate(trues)

# Helper to safely save and show plots without blocking headless runs
def save_and_show_plot(filename):
    plot_dir = os.path.join(DEPLOY_DIR, "plots")
    os.makedirs(plot_dir, exist_ok=True)
    filepath = os.path.join(plot_dir, filename)
    plt.savefig(filepath)
    print(f"Saved plot to {filepath}")
    try:
        import sys
        if hasattr(sys, 'ps1') or os.environ.get("DISPLAY") or (os.name == "nt" and sys.stdout.isatty()):
            plt.show()
    except Exception as e:
        pass
    plt.close()

# Temporal attention plot
attn = model.temporal.last_attention.mean(dim=0).numpy()
plt.figure()
plt.bar(range(len(attn)), attn)
plt.title("Temporal Attention Importance")
plt.xlabel("Timestep"); plt.ylabel("Attention Weight")
plt.grid(True); plt.tight_layout()
save_and_show_plot("temporal_attention.png")

# ============================================================
# LINK-WISE PREDICTIONS CSV
# ============================================================

results = []
idx_c = 0
for batch in test_loader:
    B = batch["Y"].shape[0]
    for b in range(B):
        for n in range(N):
            results.append({
                "prediction_horizon_sec": idx_c,
                "link":       idx_to_link[n],
                "queue_true": trues[idx_c, n, 0],
                "queue_pred": preds[idx_c, n, 0],
                "delay_true": trues[idx_c, n, 1],
                "delay_pred": preds[idx_c, n, 1],
            })
        idx_c += 1

results_df = pd.DataFrame(results)
results_df["prediction_horizon_sec"] = results_df["prediction_horizon_sec"] * 5
results_df["prediction_horizon_min"] = results_df["prediction_horizon_sec"] / 60
results_df.to_csv(os.path.join(DATASET_DIR, "linkwise_predictions.csv"), index=False)
print("\nLinkwise predictions saved")

# ============================================================
# OVERALL METRICS
# ============================================================

p_flat = preds.reshape(-1, 3)
t_flat = trues.reshape(-1, 3)

print("\n===================")
print("TEST RESULTS")
print("===================")
print("MAE :", mean_absolute_error(t_flat, p_flat))
print("RMSE:", np.sqrt(mean_squared_error(t_flat, p_flat)))
print("R2  :", r2_score(t_flat, p_flat))

# ============================================================
# LINK-WISE PERFORMANCE
# ============================================================

print("\n===================")
print("LINK-WISE PERFORMANCE")
print("===================")
for link in links:
    ldf = results_df[results_df["link"] == link]
    q_rmse = np.sqrt(mean_squared_error(ldf["queue_true"], ldf["queue_pred"]))
    d_rmse = np.sqrt(mean_squared_error(ldf["delay_true"], ldf["delay_pred"]))
    print(f"\n{link}  Queue RMSE: {q_rmse:.4f}  Delay RMSE: {d_rmse:.4f}")

# ============================================================
# INVERSE TRANSFORM & PLOTS
# ============================================================

preds_inv = y_scaler.inverse_transform(p_flat)
trues_inv = y_scaler.inverse_transform(t_flat)
preds_inv[:, 2] = np.expm1(preds_inv[:, 2])
trues_inv[:, 2] = np.expm1(trues_inv[:, 2])

queue_true, delay_true, diss_true = trues_inv[:, 0], trues_inv[:, 1], trues_inv[:, 2]
queue_pred, delay_pred, diss_pred = preds_inv[:, 0], preds_inv[:, 1], preds_inv[:, 2]

print("\nDissipation RMSE:", np.sqrt(mean_squared_error(diss_true, diss_pred)))

plt.rcParams["figure.figsize"] = (10, 5)

for true, pred, title, ylabel in [
    (queue_true, queue_pred, "Actual vs Predicted Queue Length", "Queue Length"),
    (delay_true, delay_pred, "Actual vs Predicted Vehicle Delay", "Delay"),
]:
    plt.figure()
    plt.plot(true[:200], label="Actual")
    plt.plot(pred[:200], label="Predicted")
    plt.title(title); plt.xlabel("Sample"); plt.ylabel(ylabel)
    plt.legend(); plt.grid(True); plt.tight_layout()
    save_and_show_plot(f"{title.lower().replace(' ', '_')}.png")

for true, pred, title, xlabel, ylabel in [
    (queue_true, queue_pred, "Queue Length Scatter", "Actual Queue",  "Predicted Queue"),
    (delay_true, delay_pred, "Vehicle Delay Scatter", "Actual Delay", "Predicted Delay"),
]:
    plt.figure()
    plt.scatter(true, pred, alpha=0.5)
    plt.xlabel(xlabel); plt.ylabel(ylabel); plt.title(title)
    plt.grid(True); plt.tight_layout()
    save_and_show_plot(f"{title.lower().replace(' ', '_')}.png")

# ============================================================
# MANAGEMENT RECOMMENDATIONS
# ============================================================

management_df = compute_management_results(preds_inv, E_test)
management_df.to_csv(os.path.join(DATASET_DIR, "traffic_management_results.csv"), index=False)
print_recommendations(management_df)

results_df = compute_linkwise_management(results_df)
results_df.to_csv(os.path.join(DATASET_DIR, "traffic_management_results.csv"), index=False)

# Also write to public/ folder if it exists, so the web app gets updated immediately
public_dir = os.path.join(ROOT, "public")
if os.path.exists(public_dir):
    results_df.to_csv(os.path.join(public_dir, "traffic_management_results.csv"), index=False)
    print(f"Also saved to {os.path.join(public_dir, 'traffic_management_results.csv')}")

print("\n" + "=" * 70)
print("LINK-WISE TRAFFIC MANAGEMENT RECOMMENDATIONS")
print("=" * 70)
for _, row in results_df.iterrows():
    print(
        f"Link={row['link']} | Severity={row['severity_level']} "
        f"({row['severity_index']:.1f}) | Strategy={row['recommended_strategy']}"
    )
print("\nAll done.")
