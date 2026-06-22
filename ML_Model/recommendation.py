# ============================================================
# TRAFFIC MANAGEMENT DECISION SUPPORT
# deployment/recommendation.py
# ============================================================

import numpy as np
import pandas as pd


def normalize_score(x):
    x = np.asarray(x, dtype=float)
    x = np.clip(x, 0, None)
    if np.max(x) == np.min(x):
        return np.zeros_like(x)
    return (x - np.min(x)) / (np.max(x) - np.min(x))


def classify_severity(score):
    if score < 25:
        return "LOW"
    elif score < 50:
        return "MODERATE"
    elif score < 75:
        return "HIGH"
    return "CRITICAL"


def recommend_strategy(score):
    if score < 25:
        return [
            "Monitor traffic conditions",
            "Dashboard monitoring",
            "No intervention required"
        ]
    elif score < 50:
        return [
            "Activate Variable Message Signs",
            "Issue traveler information",
            "Dispatch patrol vehicle"
        ]
    elif score < 75:
        return [
            "Implement diversion route",
            "Adaptive signal timing",
            "Deploy incident response team",
            "Reduce approach speed"
        ]
    return [
        "Full detour operation",
        "Emergency traffic management",
        "Temporary lane closure control",
        "Dynamic route guidance",
        "Coordinate with emergency services"
    ]


def strategy_from_severity(score):
    if score < 25:
        return "Monitor Traffic Conditions"
    elif score < 50:
        return "Activate VMS + Traveler Information"
    elif score < 75:
        return "Diversion Route + Signal Retiming"
    return "Full Detour + Emergency Response"


def compute_management_results(preds_inv, E_test):
    """
    preds_inv : np.ndarray (N_samples, 3)  [queue, delay, dissipation]
    E_test    : np.ndarray (N_samples, SEQ_LEN, N_nodes, n_event_cols)
    """
    queue_score = normalize_score(preds_inv[:, 0])
    delay_score = normalize_score(preds_inv[:, 1])
    diss_score  = normalize_score(preds_inv[:, 2])

    latest_event    = E_test[:, -1, :, :]
    event_intensity = normalize_score(latest_event[:, :, 2].reshape(-1))
    lanes_blocked   = normalize_score(latest_event[:, :, 3].reshape(-1))
    event_duration  = normalize_score(latest_event[:, :, 4].reshape(-1))

    event_impact   = 0.6 * event_intensity + 0.2 * lanes_blocked + 0.2 * event_duration
    severity_index = (0.35 * queue_score + 0.30 * delay_score +
                      0.20 * diss_score  + 0.15 * event_impact) * 100

    rows = []
    for i in range(len(severity_index)):
        rows.append({
            "queue_pred":           preds_inv[i, 0],
            "delay_pred":           preds_inv[i, 1],
            "dissipation_pred":     preds_inv[i, 2],
            "severity_index":       round(float(severity_index[i]), 2),
            "severity_level":       classify_severity(severity_index[i]),
            "recommended_strategy": "; ".join(recommend_strategy(severity_index[i]))
        })
    return pd.DataFrame(rows)


def compute_linkwise_management(results_df):
    df = results_df.copy()
    qs = (df["queue_pred"] - df["queue_pred"].min()) / (
        max(df["queue_pred"].max() - df["queue_pred"].min(), 1e-9))
    ds = (df["delay_pred"] - df["delay_pred"].min()) / (
        max(df["delay_pred"].max() - df["delay_pred"].min(), 1e-9))
    df["severity_index"]       = (0.55 * qs + 0.45 * ds) * 100
    df["severity_level"]       = df["severity_index"].apply(classify_severity)
    df["recommended_strategy"] = df["severity_index"].apply(strategy_from_severity)
    return df


def print_recommendations(management_df):
    print("\n" + "=" * 60)
    print("TRAFFIC MANAGEMENT STRATEGY RECOMMENDATIONS")
    print("=" * 60)
    for idx, row in management_df.iterrows():
        print(f"\nLocation #{idx + 1}")
        print(f"Queue Length     : {row['queue_pred']:.2f}")
        print(f"Vehicle Delay    : {row['delay_pred']:.2f}")
        print(f"Dissipation Time : {row['dissipation_pred']:.2f}")
        print(f"Severity Index   : {row['severity_index']:.2f}")
        print(f"Severity Level   : {row['severity_level']}")
        print("Recommended Strategy:")
        for s in row["recommended_strategy"].split(";"):
            print(f"  ✓ {s.strip()}")

    sev = management_df["severity_index"].values
    net_sev = np.mean(sev)
    print("\n" + "=" * 20)
    print("NETWORK ASSESSMENT")
    print("=" * 20)
    print("Network Severity:", round(net_sev, 2))
    print("Network Status  :", classify_severity(net_sev))
    print("\nNETWORK STRATEGY")
    for action in recommend_strategy(net_sev):
        print(" -", action)
    critical = management_df[management_df["severity_level"] == "CRITICAL"]
    print("\nCRITICAL LOCATIONS")
    print(critical[["severity_level", "severity_index"]].head())
