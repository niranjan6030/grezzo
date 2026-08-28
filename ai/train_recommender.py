"""
Train the next-item LSTM.

    python train_recommender.py                 # synthetic sessions
    python train_recommender.py --supabase      # real sessions from Postgres

Real sessions are always better, but a new store has none — so this can
bootstrap from the catalogue by simulating how people actually browse
denim: they arrive somewhere, then move along one axis at a time (same
wash, different cut; same cut, different wash) rather than jumping at
random. That prior is enough to give the model something sensible to say
on day one, and you retrain on real data as soon as you have it.

Writes models/recommender.pt and models/vocab.json, which recommender.py
picks up on the next start.
"""

from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

MODEL_DIR = Path(os.environ.get("GREZZO_MODEL_DIR", "models"))
MAX_LEN = 20
PAD, UNK = 0, 1
KINDS = ["view", "search", "favourite", "add_to_cart", "purchase"]


# --------------------------------------------------------------------------
def load_catalogue(path: str) -> list[dict]:
    """The catalogue export the site produces at /api/catalogue."""
    raw = json.loads(Path(path).read_text())
    return raw["products"] if isinstance(raw, dict) else raw


def synthetic_sessions(catalogue: list[dict], count: int = 6000) -> list[list[tuple[str, str]]]:
    """
    Simulate browsing. Each session picks a starting product and an axis it
    cares about — wash or fit — then walks products that share it, with a
    small chance of jumping elsewhere. Longer sessions end in a stronger
    action, which is what the model needs to learn to predict.
    """
    sessions = []
    for _ in range(count):
        current = random.choice(catalogue)
        axis = random.choice(["wash", "fit", "collection"])
        want = current.get(axis)

        length = random.randint(3, 9)
        session: list[tuple[str, str]] = []

        for step in range(length):
            kind = "view"
            if step == length - 1:
                kind = random.choices(
                    ["view", "favourite", "add_to_cart", "purchase"],
                    weights=[5, 3, 2, 1],
                )[0]
            session.append((current["id"], kind))

            neighbours = [p for p in catalogue
                          if p.get(axis) == want and p["id"] != current["id"]]
            if not neighbours or random.random() < 0.18:
                neighbours = [p for p in catalogue if p["id"] != current["id"]]
            current = random.choice(neighbours)

        sessions.append(session)
    return sessions


def supabase_sessions() -> list[list[tuple[str, str]]]:
    """Real sessions from the events table, oldest action first."""
    from supabase import create_client

    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    db = create_client(url, key)

    rows = db.table("events").select("session_id, product_id, kind, created_at") \
             .order("created_at").limit(200_000).execute().data

    grouped: dict[str, list[tuple[str, str]]] = {}
    for r in rows:
        sid = r.get("session_id") or "anon"
        grouped.setdefault(sid, []).append((r["product_id"], r["kind"]))

    # A session of one tells us nothing about what comes next.
    return [s for s in grouped.values() if len(s) >= 3]


# --------------------------------------------------------------------------
def build_examples(sessions, stoi, kind_index):
    """Every prefix of a session is a training example for what follows it."""
    xs_items, xs_kinds, ys = [], [], []
    for session in sessions:
        for cut in range(1, len(session)):
            prefix = session[max(0, cut - MAX_LEN):cut]
            target = session[cut][0]
            if target not in stoi:
                continue
            items = [stoi.get(pid, UNK) for pid, _ in prefix]
            kinds = [kind_index.get(k, 1) for _, k in prefix]
            pad = MAX_LEN - len(items)
            xs_items.append([PAD] * pad + items)
            xs_kinds.append([0] * pad + kinds)
            ys.append(stoi[target])
    return xs_items, xs_kinds, ys


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalogue", default="catalogue.json",
                    help="Export of /api/catalogue")
    ap.add_argument("--supabase", action="store_true",
                    help="Train on real sessions from the events table")
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--lr", type=float, default=2e-3)
    args = ap.parse_args()

    import torch
    import torch.nn as nn
    from recommender import build_model

    catalogue = load_catalogue(args.catalogue)
    itos = ["<pad>", "<unk>"] + [p["id"] for p in catalogue]
    stoi = {p: i for i, p in enumerate(itos)}
    kind_index = {k: i + 1 for i, k in enumerate(KINDS)}

    sessions = supabase_sessions() if args.supabase else synthetic_sessions(catalogue)
    if len(sessions) < 50:
        raise SystemExit(
            f"Only {len(sessions)} usable sessions — not enough to train on. "
            "Collect more traffic, or drop --supabase to bootstrap synthetically."
        )
    print(f"{len(sessions)} sessions, {len(itos)} vocabulary entries")

    xs_items, xs_kinds, ys = build_examples(sessions, stoi, kind_index)
    print(f"{len(ys)} training examples")

    items = torch.tensor(xs_items, dtype=torch.long)
    kinds = torch.tensor(xs_kinds, dtype=torch.long)
    targets = torch.tensor(ys, dtype=torch.long)

    # Hold out the last tenth to see whether it is actually learning.
    split = int(len(targets) * 0.9)
    perm = torch.randperm(len(targets))
    items, kinds, targets = items[perm], kinds[perm], targets[perm]
    tr = slice(0, split)
    va = slice(split, len(targets))

    model = build_model(len(itos))
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss()

    for epoch in range(args.epochs):
        model.train()
        total = 0.0
        for i in range(tr.start, split, args.batch):
            b = slice(i, min(i + args.batch, split))
            opt.zero_grad()
            loss = loss_fn(model(items[b], kinds[b]), targets[b])
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            total += loss.item()

        model.eval()
        with torch.no_grad():
            logits = model(items[va], kinds[va])
            top1 = (logits.argmax(-1) == targets[va]).float().mean().item()
            top5 = (logits.topk(5, dim=-1).indices == targets[va].unsqueeze(1)) \
                   .any(dim=1).float().mean().item()
        print(f"epoch {epoch + 1:2d}  loss {total / max(1, split // args.batch):.4f}  "
              f"top1 {top1:.3f}  top5 {top5:.3f}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), MODEL_DIR / "recommender.pt")
    (MODEL_DIR / "vocab.json").write_text(json.dumps(itos))
    print(f"saved to {MODEL_DIR}/  — restart the service to pick it up")


if __name__ == "__main__":
    main()
