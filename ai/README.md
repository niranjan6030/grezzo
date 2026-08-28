# Grezzo AI service

Two models behind one small FastAPI app:

| Endpoint | Model | What it does |
|---|---|---|
| `POST /recommend` | LSTM over browsing sequences | Predicts the next product from what someone has been looking at |
| `POST /visual-search` | CLIP (ViT-B/32) | Matches a photograph to the closest jean in the range |
| `GET /health` | — | Reports which of the two are actually loaded |

The service is **stateless**. The storefront sends the catalogue with every
request, so this never holds its own copy and never goes stale when a product
is edited in the admin console.

## Running it

```bash
cd ai
python -m venv .venv && source .venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
uvicorn app:app --reload --port 8000
```

Then point the site at it:

```bash
# web/.env.local
AI_SERVICE_URL=http://localhost:8000
```

**The site works without this service.** With `AI_SERVICE_URL` unset, the
storefront falls back to its own hybrid recommender and to on-device colour
matching for the lens, and it tells the shopper which engine answered. Nothing
breaks, it just gets less clever.

## The recommender

`recommender.py` holds a small LSTM: an item embedding and an interaction-kind
embedding are concatenated, run through one recurrent layer, and projected back
over the catalogue to score every product as a possible next step.

Sequence models earn their keep on the thing similarity scoring cannot see —
direction. Someone who opens a raw selvedge, then a rinse, then a stonewash is
moving toward lighter washes, and the next thing to show them is lighter still,
not another raw pair.

### Training

```bash
# Export the live catalogue first
curl http://localhost:3000/api/catalogue > catalogue.json

# Bootstrap from simulated sessions (a brand-new store has no traffic)
python train_recommender.py

# Later, once the events table has real sessions in it
python train_recommender.py --supabase --epochs 20
```

Synthetic sessions are a *prior*, not data. They encode the assumption that
people browse along one axis at a time — same wash, different cut, or the
reverse — which is true enough to give the model something sensible to say on
day one. Retrain on real sessions as soon as you have a few hundred, and take
the top-5 accuracy printed each epoch as your signal that it is working.

Checkpoints land in `models/`, and `recommender.py` picks them up on the next
start. With no checkpoint present it serves an attribute-similarity fallback
and reports `engine: "content"`, so the endpoint never fails.

## The lens

There is no product photography to embed, so `vision.py` does **zero-shot**
CLIP: every product is turned into a caption ("a product photo of mid stone
wash denim jeans, wide leg…") and the uploaded photo is matched against those
captions in CLIP's shared image/text space.

That means it works from the catalogue alone, needs no image set, and keeps
working when the range changes. When real photography exists, embed the shots
with `vision.embed_images`, store the vectors in `products.embedding`, and
compare image-to-image instead — the API shape does not change.

## Deploying free

**Hugging Face Spaces** is the best free option, because it gives you enough
disk for the CLIP weights:

1. Create a Space → **Docker** → blank.
2. Push this folder to it. The `Dockerfile` already listens on 7860.
3. Copy the Space URL into `AI_SERVICE_URL` on Vercel.

**Render** free tier also works but sleeps after inactivity, so the first
request after a nap takes ~30s. The storefront's timeouts (2.5s for
recommendations, 12s for the lens) handle that by falling back rather than
hanging — a sleeping service degrades the site, it does not break it.

Both free tiers are memory-tight. If CLIP will not load, drop
`open-clip-torch` from `requirements.txt` and run recommendations only:
`/health` will report `vision: "unavailable"` and the lens falls back to
on-device matching.
