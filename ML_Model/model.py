# ============================================================
# STGNN MODEL ARCHITECTURE
# deployment/model.py
# ============================================================

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================================
# EVENT FEATURE ATTENTION
# ============================================================

class EventFeatureAttention(nn.Module):

    def __init__(self, F_in, Fe):
        super().__init__()
        self.Wx = nn.Linear(F_in, F_in)
        self.We = nn.Linear(Fe, F_in)

    def forward(self, x, e):
        alpha = torch.sigmoid(self.Wx(x) + self.We(e))
        return x * alpha


# ============================================================
# GRAPH FUSION
# ============================================================

class GraphFusion(nn.Module):

    def __init__(self):
        super().__init__()
        self.weights = nn.Parameter(torch.tensor([1.0, 1.0, 1.0]))

    def forward(self, A_road, A_traffic, A_event):
        w = torch.softmax(self.weights, dim=0)
        return w[0] * A_road + w[1] * A_traffic + w[2] * A_event


# ============================================================
# GAT LAYER
# ============================================================

class GATLayer(nn.Module):

    def __init__(self, F_in, F_out):
        super().__init__()
        self.W    = nn.Linear(F_in, F_out)
        self.attn = nn.Linear(2 * F_out + 1, 1)

    def forward(self, x, A):
        B, T, N, _ = x.shape
        h   = self.W(x)
        h_i = h.unsqueeze(3).repeat(1, 1, 1, N, 1)
        h_j = h.unsqueeze(2).repeat(1, 1, N, 1, 1)
        A_exp = A.unsqueeze(1).unsqueeze(-1).repeat(1, T, 1, 1, 1)
        e = F.leaky_relu(self.attn(torch.cat([h_i, h_j, A_exp], dim=-1))).squeeze(-1)
        e = e.masked_fill(A.unsqueeze(1) == 0, -1e9)
        e = torch.clamp(e, min=-10, max=10)
        alpha = torch.softmax(e, dim=-1)
        out = torch.einsum("btij,btjd->btid", alpha, h)
        return out + h


# ============================================================
# MULTIHEAD GAT
# ============================================================

class MultiHeadGAT(nn.Module):

    def __init__(self, F_in, d_h=8, heads=2):
        super().__init__()
        self.heads = nn.ModuleList([GATLayer(F_in, d_h) for _ in range(heads)])

    def forward(self, x, A):
        return torch.cat([head(x, A) for head in self.heads], dim=-1)


# ============================================================
# TEMPORAL GRU WITH ATTENTION
# ============================================================

class TemporalGRU(nn.Module):

    def __init__(self, D_in, D_h):
        super().__init__()
        self.gru = nn.GRU(input_size=D_in, hidden_size=D_h, batch_first=True)
        self.W   = nn.Linear(D_h, D_h)
        self.v   = nn.Parameter(torch.randn(D_h))
        self.last_attention = None

    def forward(self, Z):
        B, T, N, D = Z.shape
        Z = Z.permute(0, 2, 1, 3).reshape(B * N, T, D)
        H, _ = self.gru(Z)
        score = torch.tanh(self.W(H))
        alpha = torch.softmax(torch.matmul(score, self.v), dim=1)
        self.last_attention = alpha.detach().cpu()
        H = torch.sum(alpha.unsqueeze(-1) * H, dim=1)
        return H.reshape(B, N, -1)


# ============================================================
# OUTPUT LAYER
# ============================================================

class OutputLayer(nn.Module):

    def __init__(self, D_h):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(D_h, 64), nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32), nn.ReLU(),
            nn.Linear(32, 3)
        )

    def forward(self, x):
        return self.fc(x)


# ============================================================
# FULL STGNN MODEL
# ============================================================

class STGNN(nn.Module):

    def __init__(self, F_in, Fe, d_h=8, heads=2, D_h=32):
        super().__init__()
        self.feature_attention = EventFeatureAttention(F_in, Fe)
        self.graph_fusion      = GraphFusion()
        self.gat               = MultiHeadGAT(F_in, d_h, heads)
        self.temporal          = TemporalGRU(d_h * heads, D_h)
        self.output            = OutputLayer(D_h)

    def forward(self, X, E, A_road, A_traffic, A_event):
        X      = self.feature_attention(X, E)
        A_fused = self.graph_fusion(A_road, A_traffic, A_event)
        Z      = self.gat(X, A_fused)
        H      = self.temporal(Z)
        return self.output(H)
