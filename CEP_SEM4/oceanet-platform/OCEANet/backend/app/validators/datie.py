from __future__ import annotations

import json
import math
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.dataset_validator import DatasetValidator


DATASET_STORAGE_DIR = Path(settings.data_root) / "datasets"
REPORT_STORAGE_DIR = Path(settings.data_root) / "reports"

RESEARCH_METHODOLOGY = {
    "name": "Dataset Authenticity & Trust Intelligence Engine (DATIE)",
    "description": (
        "A transparent, additive scoring layer that fuses source trust, content quality, "
        "duplicate likelihood, freshness, metadata reliability, and explainability into a single authenticity score."
    ),
    "metrics": [
        "AUROC for authenticity-vs-rejection decisions",
        "Precision@k for suspicious dataset ranking",
        "Brier score for calibrated authenticity confidence",
        "Spearman rank correlation between DATIE score and expert review",
        "Mean absolute error for trust calibration against human labels",
    ],
    "ablation_studies": [
        "Remove freshness to measure sensitivity to stale-but-valid datasets.",
        "Remove duplicate probability to quantify overlap detection impact.",
        "Remove metadata reliability to test dependence on catalog completeness.",
        "Remove explainability score to evaluate whether score transparency changes operator trust.",
    ],
}


MODEL_REGISTRY = [
    {
        "model_id": "rf",
        "name": "Random Forest Classifier",
        "version": "1.1.0-shadow",
        "status": "legacy-compatible",
        "implementation": "Heuristic shadow scorer over live biodiversity analytics with versioned output contracts.",
        "evaluation": {
            "confidence_score": "Derived from regional evidence density and species support",
            "recommended_metrics": ["precision", "recall", "f1", "calibration_error"],
        },
        "explainability": ["species support count", "regional observation density", "dataset lineage coverage"],
    },
    {
        "model_id": "km",
        "name": "K-Means Clustering",
        "version": "1.1.0-shadow",
        "status": "legacy-compatible",
        "implementation": "Heuristic clustering narrative that remains wire-compatible with future KMeans replacement.",
        "evaluation": {
            "confidence_score": "Derived from hotspot concentration and cluster separation cues",
            "recommended_metrics": ["silhouette_score", "davies_bouldin_index", "cluster_stability"],
        },
        "explainability": ["hotspot density", "stress concentration", "region rank ordering"],
    },
    {
        "model_id": "ts",
        "name": "Time-Series Forecasting",
        "version": "1.2.0-shadow",
        "status": "legacy-compatible",
        "implementation": "Deterministic linear-trend forecaster for SST projection with explicit regression math.",
        "evaluation": {
            "confidence_score": "Derived from observed horizon length and trend stability",
            "recommended_metrics": ["mae", "rmse", "mape", "prediction_interval_coverage"],
        },
        "explainability": ["trend slope", "window length", "residual variability"],
    },
]


@dataclass(frozen=True)
class DatieResult:
    entity_type: str
    entity_id: int
    title: str
    region: str
    created_at: str
    source: str
    source_trust_score: int
    content_quality_score: int
    duplicate_probability_score: int
    freshness_score: int
    metadata_reliability_score: int
    explainability_score: int
    final_authenticity_score: int
    score_band: str
    feature_importance: dict[str, list[dict[str, Any]]]
    explanations: list[str]
    formulas: dict[str, str]
    evidence: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "title": self.title,
            "region": self.region,
            "created_at": self.created_at,
            "source": self.source,
            "source_trust_score": self.source_trust_score,
            "content_quality_score": self.content_quality_score,
            "duplicate_probability_score": self.duplicate_probability_score,
            "freshness_score": self.freshness_score,
            "metadata_reliability_score": self.metadata_reliability_score,
            "explainability_score": self.explainability_score,
            "final_authenticity_score": self.final_authenticity_score,
            "score_band": self.score_band,
            "feature_importance": self.feature_importance,
            "explanations": self.explanations,
            "formulas": self.formulas,
            "evidence": self.evidence,
            "research": {
                "methodology": RESEARCH_METHODOLOGY,
                "architecture_markdown": build_architecture_markdown(),
                "evaluation_metrics": RESEARCH_METHODOLOGY["metrics"],
                "ablation_studies": RESEARCH_METHODOLOGY["ablation_studies"],
            },
        }


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _clamp(value: float, lower: int = 0, upper: int = 100) -> int:
    return int(max(lower, min(upper, round(value))))


def _safe_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _dataset_storage_path(row: dict[str, Any]) -> Path:
    return DATASET_STORAGE_DIR / _normalize_text(row.get("stored_name"))


def _report_storage_path(row: dict[str, Any]) -> Path:
    name = _normalize_text(row.get("report_file_name"))
    return REPORT_STORAGE_DIR / name if name else REPORT_STORAGE_DIR


def _open_sqlite_connection() -> sqlite3.Connection:
    from app import main as legacy_main

    return legacy_main._create_connection()  # type: ignore[attr-defined]


def _fetch_all(sql: str, params: Iterable[Any] | None = None) -> list[dict[str, Any]]:
    params = tuple(params or ())
    if settings.db_type.lower() != "postgres":
        with _open_sqlite_connection() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [dict(row) for row in rows]

    with engine.connect() as connection:
        result = connection.exec_driver_sql(sql, params)
        return [dict(row._mapping) for row in result.fetchall()]


def _fetch_one(sql: str, params: Iterable[Any]) -> dict[str, Any] | None:
    rows = _fetch_all(sql, params)
    return rows[0] if rows else None


def _list_datasets(limit: int = 250) -> list[dict[str, Any]]:
    return _fetch_all(
        "SELECT * FROM datasets ORDER BY datetime(created_at) DESC, id DESC LIMIT ?",
        (limit,),
    )


def _list_reports(limit: int = 250) -> list[dict[str, Any]]:
    return _fetch_all(
        "SELECT * FROM reports ORDER BY datetime(created_at) DESC, id DESC LIMIT ?",
        (limit,),
    )


def _content_metrics_from_file(file_path: Path, original_name: str, source: str) -> dict[str, Any]:
    extension = file_path.suffix.lower()
    is_valid, reason, details = DatasetValidator.validate_dataset_file(
        str(file_path),
        original_name,
        source,
        extension,
    )
    details = dict(details or {})
    details["is_valid"] = bool(is_valid)
    details["validation_reason"] = reason
    return details


def _source_trust(row: dict[str, Any], file_type: str) -> tuple[int, list[dict[str, Any]], str]:
    source = _normalize_text(row.get("source")).lower()
    original_name = _normalize_text(row.get("original_name"))
    trusted_sources = DatasetValidator.VERIFIED_SOURCES
    contributions: list[dict[str, Any]] = []

    score = 34.0
    score += 28.0 if source in trusted_sources else 6.0 if source == "manual" else -8.0
    contributions.append({"feature": "verified_source_allowlist", "weight": 0.42, "value": int(source in trusted_sources), "delta": 28 if source in trusted_sources else 6 if source == "manual" else -8})

    source_matches_filename = any(token in original_name.lower() for token in [source, "noaa", "nasa", "gbif", "obis", "inaturalist", "open-meteo"] if token)
    score += 12.0 if source_matches_filename else 0.0
    contributions.append({"feature": "source_filename_alignment", "weight": 0.18, "value": int(source_matches_filename), "delta": 12 if source_matches_filename else 0})

    score += 8.0 if file_type in DatasetValidator.TEXT_BASED_EXTENSIONS or file_type in DatasetValidator.BINARY_CONTAINER_EXTENSIONS else 0.0
    contributions.append({"feature": "supported_artifact_type", "weight": 0.12, "value": int(file_type in DatasetValidator.TEXT_BASED_EXTENSIONS or file_type in DatasetValidator.BINARY_CONTAINER_EXTENSIONS), "delta": 8 if file_type in DatasetValidator.TEXT_BASED_EXTENSIONS or file_type in DatasetValidator.BINARY_CONTAINER_EXTENSIONS else 0})

    validation_status = _normalize_text(row.get("validation_status")).upper()
    score += 14.0 if validation_status in {"APPROVED", "VALID", "PASS"} else 4.0 if validation_status else 0.0
    contributions.append({"feature": "validation_status", "weight": 0.16, "value": validation_status or "unknown", "delta": 14 if validation_status in {"APPROVED", "VALID", "PASS"} else 4 if validation_status else 0})

    return _clamp(score), contributions, "Source trust combines allowlisted provenance, filename alignment, file-type support, and validation status."


def _content_quality(row: dict[str, Any], details: dict[str, Any]) -> tuple[int, list[dict[str, Any]], str]:
    contributions: list[dict[str, Any]] = []
    rows = int(details.get("rows") or 0)
    columns = int(details.get("columns") or 0)
    null_ratio = float(details.get("null_ratio") or 0.0)
    numeric_precision = float(details.get("numeric_precision") or 0.0)
    is_valid = bool(details.get("is_valid"))

    score = 18.0
    if rows >= 1000:
        score += 24.0
        row_delta = 24
    elif rows >= DatasetValidator.MIN_ROWS_FOR_VALID_CSV:
        score += 16.0
        row_delta = 16
    else:
        row_delta = 0
    contributions.append({"feature": "row_coverage", "weight": 0.28, "value": rows, "delta": row_delta})

    if columns >= DatasetValidator.MIN_COLUMNS_FOR_VALID_CSV:
        score += 16.0
        col_delta = 16
    else:
        col_delta = 0
    contributions.append({"feature": "column_coverage", "weight": 0.16, "value": columns, "delta": col_delta})

    if null_ratio <= 0.15:
        score += 18.0
        null_delta = 18
    elif null_ratio <= DatasetValidator.MAX_NULL_RATIO:
        score += 9.0
        null_delta = 9
    else:
        score -= 8.0
        null_delta = -8
    contributions.append({"feature": "missingness_control", "weight": 0.22, "value": round(null_ratio, 4), "delta": null_delta})

    if numeric_precision >= DatasetValidator.MIN_NUMERIC_PRECISION:
        score += 10.0
        prec_delta = 10
    else:
        prec_delta = 0
    contributions.append({"feature": "numeric_precision", "weight": 0.10, "value": numeric_precision, "delta": prec_delta})

    if is_valid:
        score += 14.0
        valid_delta = 14
    else:
        valid_delta = -10
        score -= 10.0
    contributions.append({"feature": "structural_validation", "weight": 0.24, "value": int(is_valid), "delta": valid_delta})

    return _clamp(score), contributions, "Content quality rewards structure, completeness, row/column density, and successful structural validation."


def _duplicate_probability(row: dict[str, Any], related_rows: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]], str]:
    content_hash = _normalize_text(row.get("content_hash"))
    semantic_hash = _normalize_text(row.get("semantic_hash"))
    original_name = _normalize_text(row.get("original_name")).lower()
    source = _normalize_text(row.get("source")).lower()
    created_at = _safe_datetime(row.get("created_at"))

    same_content = 0
    same_semantic = 0
    name_similarity = 0.0
    source_overlap = 0
    close_uploads = 0

    for candidate in related_rows:
        if int(candidate.get("id") or 0) == int(row.get("id") or 0):
            continue
        if content_hash and _normalize_text(candidate.get("content_hash")) == content_hash:
            same_content += 1
        if semantic_hash and _normalize_text(candidate.get("semantic_hash")) == semantic_hash:
            same_semantic += 1
        candidate_name = _normalize_text(candidate.get("original_name")).lower()
        candidate_source = _normalize_text(candidate.get("source")).lower()
        name_similarity = max(name_similarity, SequenceMatcher(None, original_name, candidate_name).ratio())
        if candidate_source == source and source:
            source_overlap += 1
        candidate_created = _safe_datetime(candidate.get("created_at"))
        if created_at and candidate_created:
            if abs((created_at - candidate_created).total_seconds()) < 86400:
                close_uploads += 1

    score = 6.0
    score += 60.0 if same_content else 0.0
    score += 40.0 if same_semantic else 0.0
    score += 12.0 if source_overlap else 0.0
    score += min(18.0, name_similarity * 18.0)
    score += min(10.0, close_uploads * 2.5)

    if same_content:
        score = 98.0
    elif same_semantic and source_overlap:
        score = max(score, 88.0)

    contributions = [
        {"feature": "exact_content_hash", "weight": 0.45, "value": same_content, "delta": 60 if same_content else 0},
        {"feature": "semantic_hash_overlap", "weight": 0.30, "value": same_semantic, "delta": 40 if same_semantic else 0},
        {"feature": "source_overlap", "weight": 0.10, "value": source_overlap, "delta": 12 if source_overlap else 0},
        {"feature": "filename_similarity", "weight": 0.10, "value": round(name_similarity, 4), "delta": round(min(18.0, name_similarity * 18.0), 2)},
        {"feature": "upload_time_proximity", "weight": 0.05, "value": close_uploads, "delta": min(10.0, close_uploads * 2.5)},
    ]
    return _clamp(score), contributions, "Duplicate probability rises when hashes, source, filename, and upload timing align with nearby records."


def _freshness_score(row: dict[str, Any]) -> tuple[int, list[dict[str, Any]], str]:
    created_at = _safe_datetime(row.get("created_at"))
    source = _normalize_text(row.get("source")).lower()
    now = datetime.now(timezone.utc)
    if not created_at:
        return 50, [{"feature": "missing_timestamp", "weight": 1.0, "value": None, "delta": 0}], "Freshness defaults to a neutral score when the timestamp is unavailable."

    age_days = max((now - created_at).total_seconds() / 86400.0, 0.0)
    decay = 42.0 if source in DatasetValidator.VERIFIED_SOURCES else 60.0
    base = 100.0 * math.exp(-age_days / decay)
    source_bonus = 8.0 if source in DatasetValidator.VERIFIED_SOURCES and age_days <= 14 else 0.0
    score = _clamp(base + source_bonus)
    return score, [
        {"feature": "age_days", "weight": 0.78, "value": round(age_days, 2), "delta": round(base - 100.0, 2)},
        {"feature": "verified_source_bonus", "weight": 0.22, "value": int(source in DatasetValidator.VERIFIED_SOURCES), "delta": source_bonus},
    ], "Freshness follows an exponential decay with a verified-source bonus for recent live feeds."


def _metadata_reliability(row: dict[str, Any]) -> tuple[int, list[dict[str, Any]], str]:
    fields = [
        ("source", 12),
        ("dataset_type", 12),
        ("original_name", 10),
        ("stored_name", 10),
        ("created_at", 12),
        ("size_bytes", 10),
        ("content_hash", 18),
        ("semantic_hash", 16),
        ("validation_status", 10),
    ]
    score = 18.0
    contributions: list[dict[str, Any]] = []
    total_weight = sum(weight for _, weight in fields)
    weighted_sum = 0.0

    for field, weight in fields:
      value = row.get(field)
      present = value is not None and str(value).strip() != ""
      weighted_sum += weight if present else 0.0
      contributions.append({"feature": field, "weight": round(weight / total_weight, 3), "value": int(present), "delta": weight if present else 0})

    score += (weighted_sum / total_weight) * 82.0
    if _normalize_text(row.get("validation_reason")):
        score += 6.0
    return _clamp(score), contributions, "Metadata reliability rewards complete lineage fields and penalizes missing provenance signals."


def _explainability_score(evidence: dict[str, Any]) -> tuple[int, list[dict[str, Any]], str]:
    direct_fields = 0
    if evidence.get("content_validation"):
        direct_fields += 1
    if evidence.get("duplicate_analysis"):
        direct_fields += 1
    if evidence.get("freshness_analysis"):
        direct_fields += 1
    if evidence.get("metadata_analysis"):
        direct_fields += 1
    if evidence.get("source_analysis"):
        direct_fields += 1

    coverage = direct_fields / 5.0
    score = 52.0 + coverage * 38.0
    score += 10.0 if evidence.get("human_readable_reasoning") else 0.0
    contributions = [
        {"feature": "evidence_coverage", "weight": 0.7, "value": direct_fields, "delta": round(coverage * 38.0, 2)},
        {"feature": "human_readable_reasoning", "weight": 0.3, "value": int(bool(evidence.get("human_readable_reasoning"))), "delta": 10 if evidence.get("human_readable_reasoning") else 0},
    ]
    return _clamp(score), contributions, "Explainability increases with the number of directly auditable signals and the presence of a clear reasoning trace."


def _final_authenticity(scores: dict[str, int]) -> tuple[int, list[dict[str, Any]], str]:
    source = scores["source_trust"]
    content = scores["content_quality"]
    duplicate = scores["duplicate_probability"]
    freshness = scores["freshness"]
    metadata = scores["metadata_reliability"]
    explainability = scores["explainability"]

    final = (
        0.24 * source
        + 0.22 * content
        + 0.10 * (100 - duplicate)
        + 0.16 * freshness
        + 0.14 * metadata
        + 0.14 * explainability
    )
    contributions = [
        {"feature": "source_trust", "weight": 0.24, "value": source, "delta": round(0.24 * source, 2)},
        {"feature": "content_quality", "weight": 0.22, "value": content, "delta": round(0.22 * content, 2)},
        {"feature": "duplicate_penalty", "weight": 0.10, "value": duplicate, "delta": round(0.10 * (100 - duplicate), 2)},
        {"feature": "freshness", "weight": 0.16, "value": freshness, "delta": round(0.16 * freshness, 2)},
        {"feature": "metadata_reliability", "weight": 0.14, "value": metadata, "delta": round(0.14 * metadata, 2)},
        {"feature": "explainability", "weight": 0.14, "value": explainability, "delta": round(0.14 * explainability, 2)},
    ]
    return _clamp(final), contributions, "The final score is a weighted consensus that privileges provenance and content quality while subtracting duplicate risk."


def build_architecture_markdown() -> str:
    return """```mermaid
flowchart LR
  A[Dataset Upload / Report Load] --> B[Existing Validator]
  B --> C[DATIE Feature Extraction]
  C --> D[Source Trust Score]
  C --> E[Content Quality Score]
  C --> F[Duplicate Probability Score]
  C --> G[Freshness Score]
  C --> H[Metadata Reliability Score]
  C --> I[Explainability Score]
  D --> J[Final Authenticity Score]
  E --> J
  F --> J
  G --> J
  H --> J
  I --> J
  J --> K[API / Frontend / Export]
```
"""


def build_research_brief_markdown() -> str:
    method = RESEARCH_METHODOLOGY
    return "\n".join(
        [
            f"# {method['name']}",
            "",
            method["description"],
            "",
            "## Core Formula",
            "",
            "$$",
            "S_{final} = 0.24S_{source} + 0.22S_{content} + 0.10(100 - P_{dup}) + 0.16S_{fresh} + 0.14S_{meta} + 0.14S_{expl}",
            "$$",
            "",
            "## Evaluation Metrics",
            "",
            *[f"- {metric}" for metric in method["metrics"]],
            "",
            "## Ablation Studies",
            "",
            *[f"- {item}" for item in method["ablation_studies"]],
            "",
            "## Architecture",
            "",
            build_architecture_markdown(),
        ]
    )


def build_model_registry() -> list[dict[str, Any]]:
    return [dict(item) for item in MODEL_REGISTRY]


def get_model_registry() -> list[dict[str, Any]]:
    return build_model_registry()


def evaluate_dataset(dataset_id: int) -> DatieResult:
    row = _fetch_one("SELECT * FROM datasets WHERE id = ?", (dataset_id,))
    if not row:
        raise ValueError("Dataset not found")
    return evaluate_row("dataset", row)


def evaluate_report(report_id: int) -> DatieResult:
    row = _fetch_one("SELECT * FROM reports WHERE id = ?", (report_id,))
    if not row:
        raise ValueError("Report not found")
    return evaluate_row("report", row)


def evaluate_row(entity_type: str, row: dict[str, Any]) -> DatieResult:
    title = _normalize_text(row.get("title") or row.get("original_name") or row.get("custom_title") or row.get("report_type") or row.get("stored_name") or f"{entity_type.title()} {row.get('id')}")
    region = _normalize_text(row.get("region") or row.get("dataset_type") or "Global")
    source = _normalize_text(row.get("source") or "unknown")
    created_at = _normalize_text(row.get("created_at") or datetime.now(timezone.utc).isoformat())
    entity_id = int(row.get("id") or 0)

    if entity_type == "dataset":
        file_path = _dataset_storage_path(row)
        extension = file_path.suffix.lower()
        details = {}
        if file_path.exists():
            details = _content_metrics_from_file(file_path, _normalize_text(row.get("original_name") or title), source)
        else:
            details = {
                "is_valid": bool(row.get("validation_status")),
                "validation_reason": _normalize_text(row.get("validation_reason")),
                "rows": 0,
                "columns": 0,
                "null_ratio": 0.0,
                "numeric_precision": 0.0,
                "content_hash": _normalize_text(row.get("content_hash")),
                "semantic_hash": _normalize_text(row.get("semantic_hash")),
                "size_bytes": int(row.get("size_bytes") or 0),
            }
    else:
        content = _normalize_text(row.get("content"))
        details = {
            "is_valid": bool(content.strip()),
            "validation_reason": "Report content present" if content.strip() else "Report content missing",
            "rows": max(1, content.count("\n")),
            "columns": max(1, content.count("|") + content.count(",")),
            "null_ratio": 0.0,
            "numeric_precision": 100.0 if any(ch.isdigit() for ch in content) else 10.0,
            "content_hash": DatasetValidator.compute_content_hash(content.encode("utf-8")) if content else "",
            "semantic_hash": DatasetValidator.compute_semantic_hash(content.encode("utf-8"), ".txt") if content else "",
            "size_bytes": len(content.encode("utf-8")),
        }

    related_rows = _list_datasets(limit=400) if entity_type == "dataset" else _list_reports(limit=400)
    source_score, source_imp, source_formula = _source_trust(row, extension if entity_type == "dataset" else ".txt")
    content_score, content_imp, content_formula = _content_quality(row, details)
    duplicate_score, duplicate_imp, duplicate_formula = _duplicate_probability(row, related_rows)
    freshness_score, freshness_imp, freshness_formula = _freshness_score(row)
    metadata_score, metadata_imp, metadata_formula = _metadata_reliability(row)
    evidence = {
        "content_validation": details,
        "duplicate_analysis": duplicate_imp,
        "freshness_analysis": freshness_imp,
        "metadata_analysis": metadata_imp,
        "source_analysis": source_imp,
        "human_readable_reasoning": True,
    }
    explainability_score, explainability_imp, explainability_formula = _explainability_score(evidence)

    final_score, final_imp, final_formula = _final_authenticity(
        {
            "source_trust": source_score,
            "content_quality": content_score,
            "duplicate_probability": duplicate_score,
            "freshness": freshness_score,
            "metadata_reliability": metadata_score,
            "explainability": explainability_score,
        }
    )

    band = "High Authenticity" if final_score >= 80 else "Moderate Authenticity" if final_score >= 60 else "Low Authenticity"
    explanations = [
        f"Source trust leans on {source_formula.lower()}",
        f"Content quality reflects {content_formula.lower()}",
        f"Duplicate probability reflects {duplicate_formula.lower()}",
        f"Freshness reflects {freshness_formula.lower()}",
        f"Metadata reliability reflects {metadata_formula.lower()}",
        f"Explainability reflects {explainability_formula.lower()}",
        f"Final authenticity reflects {final_formula.lower()}",
    ]

    return DatieResult(
        entity_type=entity_type,
        entity_id=entity_id,
        title=title,
        region=region,
        created_at=created_at,
        source=source,
        source_trust_score=source_score,
        content_quality_score=content_score,
        duplicate_probability_score=duplicate_score,
        freshness_score=freshness_score,
        metadata_reliability_score=metadata_score,
        explainability_score=explainability_score,
        final_authenticity_score=final_score,
        score_band=band,
        feature_importance={
            "source_trust": source_imp,
            "content_quality": content_imp,
            "duplicate_probability": duplicate_imp,
            "freshness": freshness_imp,
            "metadata_reliability": metadata_imp,
            "explainability": explainability_imp,
            "final_authenticity": final_imp,
        },
        explanations=explanations,
        formulas={
            "source_trust": "S_source = weighted provenance allowlist + source/filename alignment + artifact support + validation status",
            "content_quality": "S_content = row coverage + column coverage + missingness penalty + numeric precision + structural validation",
            "duplicate_probability": "P_dup = hash overlap + semantic overlap + source overlap + filename similarity + upload timing proximity",
            "freshness": "S_fresh = 100 * exp(-age_days / decay) + verified-source bonus",
            "metadata_reliability": "S_meta = weighted completeness of provenance and lineage fields",
            "explainability": "S_expl = evidence coverage + human-readable reasoning",
            "final_authenticity": "S_final = weighted consensus over trust, quality, duplicate risk, freshness, metadata, and explainability",
        },
        evidence={
            "content_validation": details,
            "related_entity_count": len(related_rows),
            "entity_type": entity_type,
            "file_path": str(_dataset_storage_path(row) if entity_type == "dataset" else _report_storage_path(row)),
        },
    )


def summarize() -> dict[str, Any]:
    datasets = _list_datasets(limit=500)
    results = [evaluate_row("dataset", row).to_dict() for row in datasets[:100]]
    if not results:
        return {
            "total_datasets": 0,
            "average_authenticity_score": 0,
            "band_counts": {"high": 0, "moderate": 0, "low": 0},
            "top_concerns": [],
            "latest_dataset": None,
        }

    average_score = round(sum(item["final_authenticity_score"] for item in results) / len(results), 1)
    band_counts = {
        "high": sum(1 for item in results if item["final_authenticity_score"] >= 80),
        "moderate": sum(1 for item in results if 60 <= item["final_authenticity_score"] < 80),
        "low": sum(1 for item in results if item["final_authenticity_score"] < 60),
    }
    top_concerns = sorted(
        (
            {
                "dataset_id": item["entity_id"],
                "title": item["title"],
                "score": item["final_authenticity_score"],
                "duplicate_probability_score": item["duplicate_probability_score"],
                "freshness_score": item["freshness_score"],
            }
            for item in results
        ),
        key=lambda item: (item["duplicate_probability_score"], item["freshness_score"], item["score"]),
        reverse=True,
    )[:5]

    latest_dataset = results[0]
    return {
        "total_datasets": len(results),
        "average_authenticity_score": average_score,
        "band_counts": band_counts,
        "top_concerns": top_concerns,
        "latest_dataset": latest_dataset,
        "model_registry": build_model_registry(),
        "research": {
            "methodology": RESEARCH_METHODOLOGY,
            "architecture_markdown": build_architecture_markdown(),
        },
    }


def export_markdown(entity_type: str, entity_id: int) -> str:
    result = evaluate_dataset(entity_id) if entity_type == "dataset" else evaluate_report(entity_id)
    payload = result.to_dict()
    lines = [
        f"# DATIE {payload['entity_type'].title()} Authenticity Report",
        "",
        f"- ID: {payload['entity_id']}",
        f"- Title: {payload['title']}",
        f"- Authenticity Score: {payload['final_authenticity_score']} / 100",
        f"- Band: {payload['score_band']}",
        "",
        "## Scores",
        f"- Source Trust: {payload['source_trust_score']}",
        f"- Content Quality: {payload['content_quality_score']}",
        f"- Duplicate Probability: {payload['duplicate_probability_score']}",
        f"- Freshness: {payload['freshness_score']}",
        f"- Metadata Reliability: {payload['metadata_reliability_score']}",
        f"- Explainability: {payload['explainability_score']}",
        "",
        "## Explanation",
        *[f"- {item}" for item in payload["explanations"]],
        "",
        "## Research Brief",
        build_research_brief_markdown(),
    ]
    return "\n".join(lines)
