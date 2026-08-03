from __future__ import annotations

import hashlib
import re
from typing import Any

import numpy as np

VECTOR_DIMENSION = 128


def embed_text(text: str) -> list[float]:
    raw = str(text or "").strip().lower()
    tokens = re.findall(r"\w+", raw)
    vector = np.zeros(VECTOR_DIMENSION, dtype=float)

    for token in tokens:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(digest[:2], "big") % VECTOR_DIMENSION
        vector[idx] += 1.0

    norm = np.linalg.norm(vector)
    if norm > 0:
        vector /= norm

    return vector.astype(float).tolist()
