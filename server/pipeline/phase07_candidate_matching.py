"""
Phase 07: Candidate Generation & Semantic Matching Pipeline Stage
Executes cross-CPSE blocking, embedding generation, null-aware attribute comparison,
engineering conflict classification, explainable scoring, and candidate ranking.
Strictly preserves upstream artifact immutability and Phase 6 boundaries.
"""

import hashlib
import json
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd

try:
    from services.embedding_service import embedding_service
    from services.matching_service import matching_service
    from pipeline.phase06_embedding import run_embedding
except ImportError:
    from server.services.embedding_service import embedding_service
    from server.services.matching_service import matching_service
    from server.pipeline.phase06_embedding import run_embedding

logger = logging.getLogger(__name__)

VALID_RAW_HASHES = {
    "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1",
    "054163772d5ae37b8f032adb35986f3330a53b8119c1963b43606ec916febb18",
}
EXPECTED_RAW_HASH = "054163772d5ae37b8f032adb35986f3330a53b8119c1963b43606ec916febb18"
RAW_DATASET_PATH = Path("data/raw/CPSE_Material_Master_cleaned.csv")
STANDARDIZED_CSV = Path("data/processed/standardized_materials.csv")
CANDIDATES_CSV = Path("data/processed/match_candidates.csv")
REPORT_JSON = Path("data/processed/matching_report.json")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


async def run_matching(config: dict = None) -> dict:
    """
    Execute Phase 5: Candidate Generation & Semantic Matching.
    """
    t_start = time.time()
    config = config or {}

    # ── Step 1: Pre-execution Immutability Check ────────────────────────
    raw_path = Path(config.get("raw_dataset", str(RAW_DATASET_PATH)))
    if not raw_path.exists():
        return {
            "status": "failed",
            "stage": "pre_hash_check",
            "message": f"Raw dataset not found: {raw_path}",
        }
    hash_before = _sha256(raw_path)
    if hash_before not in VALID_RAW_HASHES:
        return {
            "status": "failed",
            "stage": "pre_hash_check",
            "message": (
                f"CRITICAL: Raw dataset hash mismatch before Phase 5.\n"
                f"Expected one of: {list(VALID_RAW_HASHES)}\n"
                f"Actual:   {hash_before}"
            ),
        }

    # ── Step 2: Load Standardized Dataset ──────────────────────────────
    std_path = Path(config.get("standardized_csv", str(STANDARDIZED_CSV)))
    if not std_path.exists():
        return {
            "status": "failed",
            "stage": "input_file_check",
            "message": (
                f"Phase 4 output not found: {std_path}. "
                "Run Phase 4 (standardization) before Phase 5 (matching)."
            ),
        }

    df_std = pd.read_csv(std_path, dtype=str)
    input_rows = len(df_std)
    unique_codes = df_std["Material_Code"].nunique()

    if input_rows <= 0 or unique_codes != input_rows:
        return {
            "status": "failed",
            "stage": "input_integrity_check",
            "message": f"All materials must be unique, found {input_rows} rows and {unique_codes} unique codes.",
        }

    input_sha256 = _sha256(std_path)

    # ── Step 3: Generate Embeddings ────────────────────────────────────
    t_emb_start = time.time()
    embeddings, emb_meta = await run_embedding({"standardized_csv": str(std_path)})
    t_emb = time.time() - t_emb_start

    # ── Step 4: Candidate Blocking ─────────────────────────────────────
    t_block_start = time.time()
    pair_blocks = matching_service.generate_candidate_pairs(df_std)
    t_block = time.time() - t_block_start
    raw_candidate_pairs_count = len(pair_blocks)

    # Naive all-pairs count
    naive_all_pairs = (input_rows * (input_rows - 1)) // 2
    reduction_ratio = round((1.0 - (raw_candidate_pairs_count / naive_all_pairs)) * 100.0, 2)

    # ── Step 5: Candidate Scoring & Explainability ─────────────────────
    t_score_start = time.time()
    records = df_std.to_dict("records")
    code_to_idx = {r["Material_Code"]: i for i, r in enumerate(records)}

    # Group candidate pairs by source record
    source_candidates: Dict[int, List[Dict[str, Any]]] = defaultdict(list)

    for (idx1, idx2), blocks in pair_blocks.items():
        if idx1 == idx2:
            continue
        rec1 = records[idx1]
        rec2 = records[idx2]
        emb1 = embeddings[idx1]
        emb2 = embeddings[idx2]

        match_data_12 = matching_service.calculate_match(rec1, rec2, emb1, emb2, blocks)
        source_candidates[idx1].append(match_data_12)

        # Also register reverse candidate for idx2 (so each source material has its ranked candidates)
        match_data_21 = matching_service.calculate_match(rec2, rec1, emb2, emb1, blocks)
        source_candidates[idx2].append(match_data_21)

    # ── Step 6: Candidate Ranking & Selection ──────────────────────────
    max_per_source = config.get("max_candidates_per_source", 30)
    final_candidates: List[Dict[str, Any]] = []
    candidate_counter = 1

    high_conf_count = 0
    med_conf_count = 0
    low_conf_count = 0
    cross_cpse_count = 0
    same_cpse_count = 0
    exact_canonical_key_count = 0
    engineering_incompatibilities_count = 0
    cpse_distribution: Dict[str, int] = defaultdict(int)

    for src_idx in range(input_rows):
        cands = source_candidates.get(src_idx, [])
        if not cands:
            continue

        src_code = records[src_idx]["Material_Code"]
        seen_cand_codes = set()
        deduped_cands = []
        for cand in cands:
            c_code = cand["candidate_material_code"]
            if c_code == src_code or c_code in seen_cand_codes:
                continue
            seen_cand_codes.add(c_code)
            deduped_cands.append(cand)

        # Sort: final_match_score DESC, then cross-CPSE, then exact key
        deduped_cands.sort(key=lambda x: (
            x["final_match_score"],
            1 if x["source_cpse"] != x["candidate_cpse"] else 0,
            x["canonical_key_exact"],
        ), reverse=True)

        # Retain top N per source
        top_cands = deduped_cands[:max_per_source]

        for rank, cand in enumerate(top_cands, 1):
            cand_id = f"CAN-{candidate_counter:06d}"
            candidate_counter += 1
            cand["candidate_id"] = cand_id
            cand["candidate_rank"] = rank

            # Stats
            conf = cand["confidence_level"]
            if conf == "HIGH":
                high_conf_count += 1
            elif conf == "MEDIUM":
                med_conf_count += 1
            else:
                low_conf_count += 1

            if cand["source_cpse"] != cand["candidate_cpse"]:
                cross_cpse_count += 1
            else:
                same_cpse_count += 1

            if cand["canonical_key_exact"]:
                exact_canonical_key_count += 1

            if cand["engineering_incompatibility"]:
                engineering_incompatibilities_count += 1

            pair_cpse_key = f"{cand['source_cpse']} -> {cand['candidate_cpse']}"
            cpse_distribution[pair_cpse_key] += 1

            final_candidates.append(cand)

    t_score = time.time() - t_score_start
    total_candidates_count = len(final_candidates)

    # ── Step 7: Write Output CSV ───────────────────────────────────────
    out_df = pd.DataFrame(final_candidates)
    CANDIDATES_CSV.parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(CANDIDATES_CSV, index=False, encoding="utf-8")
    output_sha256 = _sha256(CANDIDATES_CSV)

    # ── Step 8: Build Matching Report ──────────────────────────────────
    t_total = time.time() - t_start

    # Select representative benchmark examples for report
    benchmark_examples = []
    # 1. Exact canonical representation across two CPSEs
    exact_samples = [c for c in final_candidates if c["canonical_key_exact"] and c["source_cpse"] != c["candidate_cpse"]]
    if exact_samples:
        s = exact_samples[0]
        benchmark_examples.append({
            "category": "exact_canonical_representation_across_cpse",
            "source_material_code": s["source_material_code"],
            "source_cpse": s["source_cpse"],
            "candidate_material_code": s["candidate_material_code"],
            "candidate_cpse": s["candidate_cpse"],
            "final_match_score": s["final_match_score"],
            "confidence_level": s["confidence_level"],
            "evidence_summary": s["evidence_summary"],
        })

    # 2. Strong candidate
    high_samples = [c for c in final_candidates if c["confidence_level"] == "HIGH"]
    if high_samples:
        s = high_samples[0]
        benchmark_examples.append({
            "category": "strong_high_confidence_candidate",
            "source_material_code": s["source_material_code"],
            "source_cpse": s["source_cpse"],
            "candidate_material_code": s["candidate_material_code"],
            "candidate_cpse": s["candidate_cpse"],
            "final_match_score": s["final_match_score"],
            "confidence_level": s["confidence_level"],
            "evidence_summary": s["evidence_summary"],
        })

    # 3. Medium candidate
    med_samples = [c for c in final_candidates if c["confidence_level"] == "MEDIUM"]
    if med_samples:
        s = med_samples[0]
        benchmark_examples.append({
            "category": "medium_confidence_candidate",
            "source_material_code": s["source_material_code"],
            "source_cpse": s["source_cpse"],
            "candidate_material_code": s["candidate_material_code"],
            "candidate_cpse": s["candidate_cpse"],
            "final_match_score": s["final_match_score"],
            "confidence_level": s["confidence_level"],
            "evidence_summary": s["evidence_summary"],
        })

    # 4. Weak candidate
    low_samples = [c for c in final_candidates if c["confidence_level"] == "LOW" and not c["engineering_incompatibility"]]
    if low_samples:
        s = low_samples[0]
        benchmark_examples.append({
            "category": "weak_candidate",
            "source_material_code": s["source_material_code"],
            "source_cpse": s["source_cpse"],
            "candidate_material_code": s["candidate_material_code"],
            "candidate_cpse": s["candidate_cpse"],
            "final_match_score": s["final_match_score"],
            "confidence_level": s["confidence_level"],
            "evidence_summary": s["evidence_summary"],
        })

    # 5. Engineering-incompatible candidate
    incomp_samples = [c for c in final_candidates if c["engineering_incompatibility"]]
    if incomp_samples:
        s = incomp_samples[0]
        benchmark_examples.append({
            "category": "engineering_incompatible_candidate",
            "source_material_code": s["source_material_code"],
            "source_cpse": s["source_cpse"],
            "candidate_material_code": s["candidate_material_code"],
            "candidate_cpse": s["candidate_cpse"],
            "final_match_score": s["final_match_score"],
            "confidence_level": s["confidence_level"],
            "evidence_summary": s["evidence_summary"],
        })

    report = {
        "phase": "Phase 05: Candidate Generation & Semantic Matching",
        "dataset": {
            "input_rows": input_rows,
            "unique_material_codes": unique_codes,
            "input_sha256": input_sha256,
            "output_sha256": output_sha256,
        },
        "performance": {
            "naive_all_pairs": naive_all_pairs,
            "blocked_candidate_pairs": raw_candidate_pairs_count,
            "blocking_reduction_ratio_percent": reduction_ratio,
            "retained_candidate_pairs": total_candidates_count,
            "average_candidates_per_material": round(total_candidates_count / input_rows, 2),
            "embedding_time_seconds": round(t_emb, 2),
            "blocking_time_seconds": round(t_block, 2),
            "scoring_time_seconds": round(t_score, 2),
            "total_runtime_seconds": round(t_total, 2),
        },
        "embedding": {
            "embedding_method": emb_meta.get("embedding_method"),
            "embedding_model": emb_meta.get("embedding_model"),
            "embedding_dimension": emb_meta.get("embedding_dimension"),
            "fallback_used": emb_meta.get("fallback_used"),
            "input_sha256": emb_meta.get("input_sha256"),
        },
        "candidate_summary": {
            "total_candidates": total_candidates_count,
            "cross_cpse_candidates": cross_cpse_count,
            "same_cpse_candidates": same_cpse_count,
            "high_confidence_candidates": high_conf_count,
            "medium_confidence_candidates": med_conf_count,
            "low_confidence_candidates": low_conf_count,
            "exact_canonical_key_candidates": exact_canonical_key_count,
            "engineering_incompatibilities": engineering_incompatibilities_count,
        },
        "cpse_distribution": dict(sorted(cpse_distribution.items(), key=lambda x: -x[1])),
        "benchmark_examples": benchmark_examples,
        "immutability": {
            "raw_dataset_hash_before": hash_before,
            "raw_dataset_hash_after": _sha256(raw_path),
            "raw_dataset_unchanged": (hash_before == _sha256(raw_path)),
        },
    }

    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # ── Step 9: Post-check Raw Hash ────────────────────────────────────
    hash_after = _sha256(raw_path)
    if hash_after != hash_before:
        return {
            "status": "failed",
            "stage": "post_hash_check",
            "message": "CRITICAL: Raw dataset hash changed DURING Phase 5 execution.",
        }

    return {
        "status": "completed",
        "stage": "phase07_candidate_matching",
        "message": "Phase 5 (Candidate Generation & Semantic Matching) completed successfully.",
        "input_rows": input_rows,
        "total_candidates": total_candidates_count,
        "cross_cpse_candidates": cross_cpse_count,
        "high_confidence_candidates": high_conf_count,
        "reduction_ratio_percent": reduction_ratio,
        "embedding_method": emb_meta.get("embedding_method"),
        "output_sha256": output_sha256,
        "total_runtime_seconds": round(t_total, 2),
    }
