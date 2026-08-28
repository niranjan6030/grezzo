"""
Sequence recommender.

A small LSTM over the sequence of products a shopper has touched, trained to
predict the next one. This is the "what does this person seem to be moving
towards" signal — it picks up on things a similarity score cannot, like a
browse that starts wide and narrows onto one wash.

If no trained checkpoint is present the module still answers, using an
attribute-similarity fallback. The API contract does not change either way,
so the storefront never has to care which one replied.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import numpy as np

MODEL_DIR = Path(os.environ.get("GREZZO_MODEL_DIR", "models"))
CHECKPOINT = MODEL_DIR / "recommender.pt"
VOCAB = MODEL_DIR / "vocab.json"

MAX_LEN = 20
PAD, UNK = 0, 1

# How much each kind of interaction says about intent.
KIND_WEIGHT = {"view": 1.0, "search": 1.2, "favourite": 3.0, "add_to_cart": 4.0, "purchase": 5.0}


# --------------------------------------------------------------------------
# model
# --------------------------------------------------------------------------
def build_model(vocab_size: int, emb: int = 64, hidden: int = 128):
    import torch.nn as nn

    class NextItemLSTM(nn.Module):
        def __init__(self):
            super().__init__()
            self.item_emb = nn.Embedding(vocab_size, emb, padding_idx=PAD)
            self.kind_emb = nn.Embedding(len(KIND_WEIGHT) + 1, 8)
            self.lstm = nn.LSTM(emb + 8, hidden, batch_first=True)
            self.drop = nn.Dropout(0.2)
            self.out = nn.Linear(hidden, vocab_size)

        def forward(self, items, kinds):
            x = self.item_emb(items)
            k = self.kind_emb(kinds)
            import torch
            h, _ = self.lstm(torch.cat([x, k], dim=-1))
            return self.out(self.drop(h[:, -1, :]))   # logits for the next item

    return NextItemLSTM()


class Recommender:
    """Loads the checkpoint once at import and answers from memory."""

    def __init__(self) -> None:
        self.ready = False
        self.itos: list[str] = []
        self.stoi: dict[str, int] = {}
        self.model = None
        self._load()

    def _load(self) -> None:
        if not (CHECKPOINT.exists() and VOCAB.exists()):
            return
        try:
            import torch

            self.itos = json.loads(VOCAB.read_text())
            self.stoi = {p: i for i, p in enumerate(self.itos)}
            self.model = build_model(len(self.itos))
            self.model.load_state_dict(torch.load(CHECKPOINT, map_location="cpu"))
            self.model.eval()
            self.ready = True
        except Exception as exc:                      # noqa: BLE001
            print(f"[recommender] checkpoint unusable, falling back: {exc}")
            self.ready = False

    # ----------------------------------------------------------------------
    def recommend(self, sequence, favourites, cart, catalogue, limit=8):
        seen = {e["item"] for e in sequence} | set(favourites) | set(cart)

        scores = None
        if self.ready:
            scores = self._lstm_scores(sequence, favourites, cart)

        if scores is None:
            return self._fallback(sequence, favourites, cart, catalogue, limit), "content"

        ranked = []
        for item in catalogue:
            pid = item["id"]
            if pid in seen:
                continue
            idx = self.stoi.get(pid)
            if idx is None:
                continue
            ranked.append((pid, float(scores[idx])))

        if not ranked:
            return self._fallback(sequence, favourites, cart, catalogue, limit), "content"

        ranked.sort(key=lambda r: r[1], reverse=True)
        top = ranked[:limit]
        hi = max(s for _, s in top) or 1.0
        last = sequence[-1]["item"] if sequence else None
        names = {c["id"]: c for c in catalogue}

        return [
            {
                "productId": pid,
                "score": round(min(max(s / hi, 0.0), 1.0), 4),
                "reason": _reason(names.get(pid), names.get(last)),
            }
            for pid, s in top
        ], "lstm"

    # ----------------------------------------------------------------------
    def _lstm_scores(self, sequence, favourites, cart):
        import torch

        kinds_index = {k: i + 1 for i, k in enumerate(KIND_WEIGHT)}

        items, kinds = [], []
        for e in sequence[-MAX_LEN:]:
            items.append(self.stoi.get(e["item"], UNK))
            kinds.append(kinds_index.get(e.get("kind", "view"), 1))

        # Favourites and cart contents are strong intent, so append them as
        # if they were the most recent actions.
        for pid in favourites[-3:]:
            items.append(self.stoi.get(pid, UNK)); kinds.append(kinds_index["favourite"])
        for pid in cart[-3:]:
            items.append(self.stoi.get(pid, UNK)); kinds.append(kinds_index["add_to_cart"])

        items, kinds = items[-MAX_LEN:], kinds[-MAX_LEN:]
        if not items:
            return None

        pad = MAX_LEN - len(items)
        items = [PAD] * pad + items
        kinds = [0] * pad + kinds

        with torch.no_grad():
            logits = self.model(
                torch.tensor([items], dtype=torch.long),
                torch.tensor([kinds], dtype=torch.long),
            )
            return torch.softmax(logits, dim=-1)[0].numpy()

    # ----------------------------------------------------------------------
    @staticmethod
    def _fallback(sequence, favourites, cart, catalogue, limit):
        """Recency-weighted cosine over the attribute vectors."""
        weights: dict[str, float] = {}
        now = max((e.get("at", 0) for e in sequence), default=0)

        for e in sequence:
            age_h = (now - e.get("at", now)) / 3_600_000
            weights[e["item"]] = weights.get(e["item"], 0.0) + \
                KIND_WEIGHT.get(e.get("kind", "view"), 1.0) * math.pow(0.5, age_h)
        for pid in favourites:
            weights[pid] = weights.get(pid, 0.0) + 3.0
        for pid in cart:
            weights[pid] = weights.get(pid, 0.0) + 4.0

        by_id = {c["id"]: c for c in catalogue}
        if not weights:
            return [
                {"productId": c["id"], "score": 0.5, "reason": "Archive highlights"}
                for c in catalogue[:limit]
            ]

        total = sum(weights.values())
        out = []
        for cand in catalogue:
            if cand["id"] in weights:
                continue
            score, best = 0.0, None
            for pid, w in weights.items():
                src = by_id.get(pid)
                if not src:
                    continue
                sim = _cosine(src.get("vector", []), cand.get("vector", []))
                tag = _jaccard(src.get("tags", []), cand.get("tags", []))
                part = (0.6 * sim + 0.4 * tag) * (w / total)
                score += part
                if best is None or part > best[1]:
                    best = (src, part)
            out.append((cand, score, best[0] if best else None))

        out.sort(key=lambda r: r[1], reverse=True)
        top = out[:limit]
        hi = max((s for _, s, _ in top), default=1.0) or 1.0
        return [
            {"productId": c["id"], "score": round(s / hi, 4), "reason": _reason(c, src)}
            for c, s, src in top
        ]


def _cosine(a, b) -> float:
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    if a.size == 0 or b.size == 0 or a.size != b.size:
        return 0.0
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(a @ b / (na * nb)) if na and nb else 0.0


def _jaccard(a, b) -> float:
    A, B = set(a or []), set(b or [])
    return len(A & B) / len(A | B) if (A | B) else 0.0


def _reason(cand, src) -> str:
    if not cand:
        return "Recommended"
    if not src:
        return "Fits what you have been looking at"
    if cand.get("fit") and cand.get("fit") == src.get("fit"):
        return f"Same {str(cand['fit']).lower()} cut as {src.get('name', 'your last look')}"
    shared = set(cand.get("tags", [])) & set(src.get("tags", []))
    if shared:
        return f"Shares {', '.join(sorted(shared)[:2])} with {src.get('name', 'your last look')}"
    return f"Often viewed after {src.get('name', 'this')}"


RECOMMENDER = Recommender()
