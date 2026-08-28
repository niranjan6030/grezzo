"""
Grezzo Lens — find the closest jean in the range from a photograph.

There is no product photography to embed, so this does zero-shot CLIP:
each product is turned into a sentence describing the garment, and the
uploaded photo is matched against those sentences in CLIP's shared
image/text space. It works from the catalogue alone, and it keeps
working when the range changes, with no re-training and no image set.

Once real photography exists, embed the photos instead and compare
image-to-image — `embed_images` is here for exactly that, and the API
shape does not change.
"""

from __future__ import annotations

import base64
import io
import os
import threading
from functools import lru_cache

import numpy as np
from PIL import Image

MODEL_NAME = os.environ.get("GREZZO_CLIP_MODEL", "ViT-B-32")
PRETRAINED = os.environ.get("GREZZO_CLIP_WEIGHTS", "laion2b_s34b_b79k")

_lock = threading.Lock()
_state: dict = {}


def _load():
    """CLIP is a few hundred MB, so load it once, lazily, on first use."""
    if _state:
        return _state
    with _lock:
        if _state:
            return _state
        import open_clip
        import torch

        model, _, preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained=PRETRAINED
        )
        model.eval()
        _state.update(
            model=model,
            preprocess=preprocess,
            tokenizer=open_clip.get_tokenizer(MODEL_NAME),
            torch=torch,
        )
    return _state


def available() -> bool:
    try:
        import open_clip  # noqa: F401
        import torch      # noqa: F401
        return True
    except Exception:      # noqa: BLE001
        return False


# --------------------------------------------------------------------------
# describing a product to CLIP
# --------------------------------------------------------------------------
def describe(item: dict) -> str:
    """
    One sentence per product, written the way CLIP's training captions are.
    Wash first, because it is the strongest visual signal in a photograph;
    then the cut, which is the second thing you can actually see.
    """
    wash = str(item.get("wash", "indigo")).lower()
    fit = str(item.get("fit", "straight")).lower()
    rise = str(item.get("rise", "mid")).lower()
    tags = ", ".join(str(t) for t in (item.get("tags") or [])[:3])
    return (
        f"a product photo of {wash} wash denim jeans, "
        f"{fit} leg, {rise} rise men's trousers, {tags}"
    )


@lru_cache(maxsize=32)
def _encode_prompts(prompts: tuple[str, ...]) -> tuple:
    """Text embeddings only change when the catalogue does, so they are
    cached against the prompt tuple rather than recomputed per request."""
    s = _load()
    torch = s["torch"]
    with torch.no_grad():
        tokens = s["tokenizer"](list(prompts))
        feats = s["model"].encode_text(tokens)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    return tuple(map(tuple, feats.cpu().numpy()))


def encode_catalogue(items: list[dict]) -> np.ndarray:
    return np.asarray(_encode_prompts(tuple(describe(i) for i in items)), dtype=np.float32)


def encode_image(data_url: str) -> np.ndarray:
    s = _load()
    torch = s["torch"]

    header, _, payload = data_url.partition(",")
    if "base64" not in header:
        raise ValueError("Expected a base64 data URL.")
    raw = base64.b64decode(payload)

    image = Image.open(io.BytesIO(raw)).convert("RGB")
    tensor = s["preprocess"](image).unsqueeze(0)
    with torch.no_grad():
        feats = s["model"].encode_image(tensor)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    return feats.cpu().numpy()[0]


def embed_images(paths: list[str]) -> np.ndarray:
    """For when real product photography exists: embed the shots and store
    the vectors in Postgres (products.embedding) for image-to-image search."""
    s = _load()
    torch = s["torch"]
    batch = torch.stack([s["preprocess"](Image.open(p).convert("RGB")) for p in paths])
    with torch.no_grad():
        feats = s["model"].encode_image(batch)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    return feats.cpu().numpy()


# --------------------------------------------------------------------------
def search(data_url: str, catalogue: list[dict], limit: int = 6) -> list[dict]:
    image = encode_image(data_url)
    text = encode_catalogue(catalogue)

    # Both sides are L2-normalised, so a dot product is the cosine similarity.
    sims = text @ image

    # CLIP similarities bunch up in a narrow band; softmax over a temperature
    # spreads them into something a shopper can read as a percentage.
    scaled = np.exp((sims - sims.max()) / 0.03)
    probs = scaled / scaled.sum()

    order = np.argsort(-sims)[:limit]
    out = []
    for rank, idx in enumerate(order):
        item = catalogue[int(idx)]
        out.append({
            "productId": item["id"],
            "score": float(probs[int(idx)]),
            "why": _why(item, rank),
        })
    return out


def _why(item: dict, rank: int) -> str:
    if rank == 0:
        return f"closest match · {str(item.get('wash', '')).lower()}"
    return f"{str(item.get('wash', 'similar')).lower()} · {str(item.get('fit', '')).lower()}"


# --------------------------------------------------------------------------
# reading a garment off a photograph
# --------------------------------------------------------------------------
"""
Why classify rather than generate.

A technical flat has to be *exact*: consistent line weight, the right leg
opening, seams where seams actually are. An image model asked to draw one
invents plausible-looking detail, which is the one thing a spec drawing
must never do.

So CLIP reads the attributes it can genuinely see — cut, rise, wash — and
the storefront draws the flat deterministically from them. The drawing is
then correct by construction, and the seller can correct any attribute the
model got wrong rather than redrawing a picture.
"""

FITS = ["Skinny", "Slim", "Tapered", "Straight", "Regular",
        "Bootcut", "Relaxed", "Wide Leg", "Baggy"]
RISES = ["Low", "Mid", "High"]
WASHES = ["Raw Indigo", "Rinse", "Dark Stone", "Mid Stone",
          "Light Stone", "Bleach", "Ecru", "Black Overdye"]

# Several phrasings per label, averaged. One prompt is noisy; a handful is
# markedly steadier, and costs nothing at this catalogue size.
FIT_PROMPTS = [
    "a product photo of {} fit denim jeans laid flat",
    "{} cut jeans, full length product shot",
    "men's {} leg denim trousers on a white background",
]
RISE_PROMPTS = [
    "denim jeans with a {} rise waistband",
    "{}-waisted jeans, product photo",
]
WASH_PROMPTS = [
    "a product photo of {} wash denim jeans",
    "jeans in a {} indigo finish",
]


def _classify(image_vec, labels: list[str], templates: list[str]) -> list[tuple[str, float]]:
    """Average each label over its templates, then softmax across labels."""
    prompts, spans = [], []
    for label in labels:
        start = len(prompts)
        prompts.extend(t.format(label.lower()) for t in templates)
        spans.append((start, len(prompts)))

    text = np.asarray(_encode_prompts(tuple(prompts)), dtype=np.float32)
    sims = text @ image_vec

    scores = np.array([sims[a:b].mean() for a, b in spans])
    exp = np.exp((scores - scores.max()) / 0.02)
    probs = exp / exp.sum()

    ranked = sorted(zip(labels, probs.tolist()), key=lambda r: -r[1])
    return [(label, float(p)) for label, p in ranked]


def analyse_garment(data_url: str) -> dict:
    image_vec = encode_image(data_url)

    fit = _classify(image_vec, FITS, FIT_PROMPTS)
    rise = _classify(image_vec, RISES, RISE_PROMPTS)
    wash = _classify(image_vec, WASHES, WASH_PROMPTS)

    return {
        "engine": "clip",
        "fit": {"value": fit[0][0], "confidence": round(fit[0][1], 3),
                "alternatives": [{"value": v, "confidence": round(c, 3)} for v, c in fit[1:4]]},
        "rise": {"value": rise[0][0], "confidence": round(rise[0][1], 3),
                 "alternatives": [{"value": v, "confidence": round(c, 3)} for v, c in rise[1:3]]},
        "wash": {"value": wash[0][0], "confidence": round(wash[0][1], 3),
                 "alternatives": [{"value": v, "confidence": round(c, 3)} for v, c in wash[1:4]]},
        # Deliberately absent: fabric weight and stretch cannot be read from a
        # photograph. Claiming them would be guessing with a confident face.
        "notReadable": ["weightOz", "stretchPct", "fabric"],
    }
