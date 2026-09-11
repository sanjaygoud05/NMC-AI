"""
Common Material Master Service (Phase 8)
Core deterministic synthesis and grouping engine:
1. Builds graph from accepted human decisions (review_export / accepted_harmonization_pairs.csv).
2. Executes Guarded Clique / Maximum Compatible Subgraph partitioning to prevent transitive poisoning.
3. Performs safe attribute consolidation (unanimous agreement, canonical normalization, safe specificity inheritance).
4. Generates deterministic CMM codes (CMM-<FAMILY>-<HASH_6>-<SEQ_3>).
5. Synthesizes canonical descriptions from available verified attributes.
6. Enforces governance status invariants (NO automatic APPROVED_MASTER).
"""

import os
import re
import json
import hashlib
import uuid
from typing import Dict, Any, List, Set, Tuple, Optional
import pandas as pd


class CommonMasterService:
    """
    Deterministic grouping and synthesis service for Common Material Master.
    """

    CORE_ATTRIBUTES = [
        "Canonical_Material_Family",
        "Canonical_Material_Type",
        "Canonical_Material_Subtype",
        "Canonical_Material",
        "Canonical_Material_Grade",
        "Canonical_Nominal_Size",
        "Canonical_Size",
        "Canonical_Pressure_Class",
        "Canonical_Rating",
        "Canonical_Standard",
        "Canonical_Specification",
        "Canonical_Connection_Type",
        "Canonical_End_Type",
        "Canonical_Construction",
        "Canonical_Orientation",
        "Canonical_Unit",
    ]

    FAMILY_CODE_MAP = {
        "BEARING": "BEARNG",
        "PIPE": "PIPE",
        "VALVE": "VALVE",
        "FLANGE": "FLANGE",
        "FITTING": "FITTNG",
        "GASKET": "GASKET",
        "PUMP": "PUMP",
        "MOTOR": "MOTOR",
        "ELECTRICAL": "ELECTR",
        "INSTRUMENTATION": "INSTRU",
        "FASTENER": "FASTNR",
        "BOLT": "BOLT",
        "CABLE": "CABLE",
        "STRUCTURAL": "STRUCT",
    }

    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "data")
            )
        self.data_dir = data_dir
        self.standardized_csv = os.path.join(data_dir, "processed", "standardized_materials.csv")
        self.accepted_csv = os.path.join(data_dir, "processed", "accepted_harmonization_pairs.csv")
        self.validated_csv = os.path.join(data_dir, "processed", "validated_candidates.csv")

    def load_inputs(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Load standardized materials, accepted pairs, and validated candidate matrices"""
        df_std = pd.read_csv(self.standardized_csv, dtype=str).fillna("")
        df_acc = pd.read_csv(self.accepted_csv, dtype=str).fillna("") if os.path.exists(self.accepted_csv) else pd.DataFrame()
        df_val = pd.read_csv(self.validated_csv, dtype=str).fillna("") if os.path.exists(self.validated_csv) else pd.DataFrame()
        return df_std, df_acc, df_val

    def _build_incompatibility_matrix(self, df_val: pd.DataFrame) -> Set[Tuple[str, str]]:
        """
        Extract all material pairs that have HARD engineering conflicts
        or ENGINEERING_INCOMPATIBLE status from Phase 6.
        """
        incompatibilities = set()
        if df_val.empty:
            return incompatibilities

        # Filter rows that have engineering incompatibility
        incompat_mask = (
            (df_val["validation_status"] == "ENGINEERING_INCOMPATIBLE")
            | (df_val["engineering_conflict_class"] == "HARD_INCOMPATIBLE")
            | (df_val["engineering_incompatibility"].astype(str).str.lower() == "true")
        )
        incompat_df = df_val[incompat_mask]

        for _, row in incompat_df.iterrows():
            m1 = str(row["source_material_code"]).strip()
            m2 = str(row["candidate_material_code"]).strip()
            if m1 and m2:
                pair = tuple(sorted([m1, m2]))
                incompatibilities.add(pair)

        return incompatibilities

    def _build_accepted_graph(
        self, df_acc: pd.DataFrame
    ) -> Tuple[Dict[str, Set[str]], Dict[Tuple[str, str], Dict[str, Any]]]:
        """
        Build adjacency list and edge metadata lookup from Phase 7 accepted relationships.
        Only rows with decision == 'ACCEPT' are admitted.
        """
        adj = {}
        edge_data = {}

        if df_acc.empty:
            return adj, edge_data

        # Filter strictly for ACCEPT
        accept_df = df_acc[df_acc["decision"].str.upper() == "ACCEPT"] if "decision" in df_acc.columns else df_acc

        for _, row in accept_df.iterrows():
            u = str(row["source_material_code"]).strip()
            v = str(row["candidate_material_code"]).strip()
            if not u or not v or u == v:
                continue

            pair = tuple(sorted([u, v]))
            edge_data[pair] = {
                "candidate_id": row.get("candidate_id", ""),
                "reviewer_id": row.get("human_reviewer_id", row.get("reviewer_id", "")),
                "reviewer_email": row.get("human_reviewer_email", row.get("reviewer_email", "")),
                "rationale": row.get("human_rationale", row.get("rationale", "")),
                "reviewed_at": row.get("human_reviewed_at", row.get("decision_timestamp", "")),
                "evidence_snapshot_hash": row.get("evidence_snapshot_hash", ""),
                "refined_score": float(row.get("refined_score", 1.0)) if row.get("refined_score") else 1.0,
            }

            if u not in adj:
                adj[u] = set()
            if v not in adj:
                adj[v] = set()
            adj[u].add(v)
            adj[v].add(u)

        return adj, edge_data

    def _partition_component_to_cliques(
        self,
        component_nodes: List[str],
        accepted_edges: Set[Tuple[str, str]],
        incompatibilities: Set[Tuple[str, str]],
        material_profiles: Dict[str, Dict[str, str]],
        edge_data: Dict[Tuple[str, str], Dict[str, Any]],
    ) -> List[Tuple[List[str], str]]:
        """
        Deterministically partition a connected component into maximal compatible subgraphs.
        Returns a list of tuples: (member_list, status_override)
        """
        sorted_nodes = sorted(component_nodes)

        # 1. Verify all pairs in component
        has_incompatibility = False
        for i in range(len(sorted_nodes)):
            for j in range(i + 1, len(sorted_nodes)):
                pair = tuple(sorted([sorted_nodes[i], sorted_nodes[j]]))
                fam_i = material_profiles[sorted_nodes[i]].get("Canonical_Material_Family", "")
                fam_j = material_profiles[sorted_nodes[j]].get("Canonical_Material_Family", "")

                if pair in incompatibilities or (fam_i and fam_j and fam_i != fam_j):
                    has_incompatibility = True
                    break
            if has_incompatibility:
                break

        # If fully compatible, return as a single group
        if not has_incompatibility:
            return [(sorted_nodes, "COMPATIBLE")]

        # Otherwise, deterministic clique partition:
        # Find maximal compatible cliques with deterministic tie-breaking
        # 1. max member count, 2. max accepted edges, 3. max avg confidence, 4. lex lowest codes
        cliques = []
        unassigned = set(sorted_nodes)

        while unassigned:
            best_clique = None
            best_metrics = None

            # Explore potential seeds in deterministic order
            sorted_unassigned = sorted(list(unassigned))
            for seed in sorted_unassigned:
                candidate_clique = [seed]
                for node in sorted_unassigned:
                    if node == seed:
                        continue
                    # Check compatibility with all nodes currently in candidate_clique
                    compatible = True
                    for c_node in candidate_clique:
                        pair = tuple(sorted([c_node, node]))
                        fam_c = material_profiles[c_node].get("Canonical_Material_Family", "")
                        fam_n = material_profiles[node].get("Canonical_Material_Family", "")
                        if pair in incompatibilities or (fam_c and fam_n and fam_c != fam_n):
                            compatible = False
                            break
                    if compatible:
                        candidate_clique.append(node)

                candidate_clique = sorted(candidate_clique)

                # Compute tie-breaking metrics
                member_count = len(candidate_clique)
                edge_count = 0
                score_sum = 0.0
                for i in range(len(candidate_clique)):
                    for j in range(i + 1, len(candidate_clique)):
                        p = tuple(sorted([candidate_clique[i], candidate_clique[j]]))
                        if p in accepted_edges:
                            edge_count += 1
                            score_sum += edge_data.get(p, {}).get("refined_score", 1.0)
                avg_score = (score_sum / edge_count) if edge_count > 0 else 0.0

                # Metrics: (member_count, edge_count, avg_score, lexicographical_signature)
                # Signature inverted for max comparison or handle explicitly
                metrics = (member_count, edge_count, avg_score, candidate_clique)

                if best_metrics is None:
                    best_metrics = metrics
                    best_clique = candidate_clique
                else:
                    # Compare
                    if metrics[0] > best_metrics[0]:
                        best_metrics = metrics
                        best_clique = candidate_clique
                    elif metrics[0] == best_metrics[0]:
                        if metrics[1] > best_metrics[1]:
                            best_metrics = metrics
                            best_clique = candidate_clique
                        elif metrics[1] == best_metrics[1]:
                            if metrics[2] > best_metrics[2]:
                                best_metrics = metrics
                                best_clique = candidate_clique
                            elif metrics[2] == best_metrics[2]:
                                # Lexicographically smallest member-code list wins
                                if metrics[3] < best_metrics[3]:
                                    best_metrics = metrics
                                    best_clique = candidate_clique

            # Remove best_clique members from unassigned
            for m in best_clique:
                unassigned.remove(m)
            cliques.append((best_clique, "SPLIT_CONFLICT"))

        return cliques

    def consolidate_attributes(
        self, member_codes: List[str], material_profiles: Dict[str, Dict[str, str]]
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Consolidate attributes across member materials deterministically.
        Applies safe specificity inheritance and flags unresolved conflicts.
        Returns: (consolidated_dict, has_conflict_flag)
        """
        consolidated = {}
        has_conflict = False

        for attr in self.CORE_ATTRIBUTES:
            clean_name = attr.replace("Canonical_", "").lower()
            vals = {}
            for code in member_codes:
                val = material_profiles[code].get(attr, "").strip()
                if val:
                    vals[code] = val

            unique_vals = sorted(list(set(vals.values())))

            if not unique_vals:
                consolidated[clean_name] = ""
            elif len(unique_vals) == 1:
                # 1. Unanimous agreement
                consolidated[clean_name] = unique_vals[0]
            else:
                # Multiple values present
                # Check for representation differences (case/spacing)
                normalized_map = {}
                for v in unique_vals:
                    norm = re.sub(r"[\s_]+", " ", v).strip().upper()
                    normalized_map[norm] = v

                if len(normalized_map) == 1:
                    # Pure representation variance -> take canonical representation
                    consolidated[clean_name] = list(normalized_map.values())[0]
                else:
                    # Genuinely different populated values -> Safe Specificity Inheritance Check
                    # Can only inherit if one value is a strict substring/sub-detail and verified
                    # E.g. "ASME B16.5; 1 IN; ASTM A105" vs "ASTM A105"
                    # If distinct (e.g. "2 IN" vs "3 IN"), mark UNRESOLVED_CONFLICT
                    specific_candidate = None
                    is_safe_refinement = False

                    # Check if longer value contains all non-empty tokens of shorter value
                    sorted_by_len = sorted(unique_vals, key=lambda x: len(x), reverse=True)
                    longest = sorted_by_len[0]
                    other = sorted_by_len[1]

                    if other in longest:
                        specific_candidate = longest
                        is_safe_refinement = True

                    if is_safe_refinement and specific_candidate:
                        consolidated[clean_name] = specific_candidate
                    else:
                        consolidated[clean_name] = f"UNRESOLVED_CONFLICT ({' vs '.join(unique_vals)})"
                        has_conflict = True

        return consolidated, has_conflict

    def synthesize_common_description(self, consolidated: Dict[str, Any]) -> str:
        """
        Synthesizes a structured common description:
        FAMILY | TYPE | GRADE | SIZE | RATING | STANDARD | CONNECTION | END
        Omits unavailable fields rather than inventing values.
        """
        parts = []

        fam = consolidated.get("material_family", "")
        if fam and fam != "UNRESOLVED_CONFLICT":
            parts.append(fam)

        typ = consolidated.get("material_type", "")
        if typ and typ != "UNRESOLVED_CONFLICT" and typ != fam:
            parts.append(typ)

        grd = consolidated.get("material_grade", "")
        if grd and "UNRESOLVED" not in grd:
            parts.append(grd)

        sz = consolidated.get("nominal_size") or consolidated.get("size")
        if sz and "UNRESOLVED" not in sz:
            parts.append(sz)

        rtg = consolidated.get("pressure_class") or consolidated.get("rating")
        if rtg and "UNRESOLVED" not in rtg:
            parts.append(rtg)

        std = consolidated.get("standard") or consolidated.get("specification")
        if std and "UNRESOLVED" not in std:
            parts.append(std)

        conn = consolidated.get("connection_type", "")
        if conn and "UNRESOLVED" not in conn:
            parts.append(conn)

        end_type = consolidated.get("end_type", "")
        if end_type and "UNRESOLVED" not in end_type and end_type != conn:
            parts.append(end_type)

        return " | ".join(parts) if parts else (fam or "COMMON MATERIAL")

    def _generate_deterministic_cmm_code(
        self,
        family: str,
        group_identity_hash: str,
        seq: int,
    ) -> str:
        """
        Generates deterministic CMM code:
        CMM-<FAMILY>-<HASH_6>-<SEQ_3>
        """
        fam_token = self.FAMILY_CODE_MAP.get(family.upper(), family.upper()[:6])
        fam_token = re.sub(r"[^A-Z0-9]", "", fam_token)
        if len(fam_token) < 3:
            fam_token = fam_token.ljust(3, "X")

        hash_prefix = group_identity_hash[:6].upper()
        seq_str = f"{seq:03d}"

        return f"CMM-{fam_token}-{hash_prefix}-{seq_str}"

    def build_common_material_catalog(self) -> Dict[str, Any]:
        """
        Main execution workflow:
        1. Loads inputs.
        2. Discovers connected components from Phase 7 ACCEPT relationships.
        3. Partitions components into maximal compatible cliques.
        4. Retains all singletons (100% universe).
        5. Consolidates attributes deterministically.
        6. Assigns deterministic CMM codes with sequence tie-breaking.
        7. Enforces governance status invariants.
        """
        df_std, df_acc, df_val = self.load_inputs()

        # Build material profiles lookup
        material_profiles = {}
        for _, row in df_std.iterrows():
            code = str(row["Material_Code"]).strip()
            material_profiles[code] = row.to_dict()

        all_material_codes = sorted(list(material_profiles.keys()))

        # Build graph and incompatibility index
        adj, edge_data = self._build_accepted_graph(df_acc)
        incompatibilities = self._build_incompatibility_matrix(df_val)
        accepted_edge_set = set(edge_data.keys())

        # Discover connected components in deterministic order
        visited = set()
        raw_groups = []  # List of tuples: (member_list, status_override)

        for code in all_material_codes:
            if code in visited:
                continue

            if code not in adj:
                # Singleton
                raw_groups.append(([code], "STANDALONE_CANDIDATE"))
                visited.add(code)
                continue

            # BFS/DFS in deterministic sorted order
            comp = []
            queue = [code]
            visited.add(code)

            while queue:
                curr = queue.pop(0)
                comp.append(curr)
                neighbors = sorted(list(adj.get(curr, set())))
                for n in neighbors:
                    if n not in visited:
                        visited.add(n)
                        queue.append(n)

            # Partition component into compatible cliques
            clique_partitions = self._partition_component_to_cliques(
                comp, accepted_edge_set, incompatibilities, material_profiles, edge_data
            )
            raw_groups.extend(clique_partitions)

        # Process each group into un-sequenced candidate master records
        candidate_groups = []

        for member_codes, partition_status in raw_groups:
            sorted_members = sorted(member_codes)
            member_count = len(sorted_members)
            cpse_coverage = sorted(list(set([material_profiles[m].get("CPSE", "") for m in sorted_members])))

            # Attribute consolidation
            consolidated, has_attr_conflict = self.consolidate_attributes(sorted_members, material_profiles)
            common_desc = self.synthesize_common_description(consolidated)
            family = consolidated.get("material_family", "") or material_profiles[sorted_members[0]].get("Canonical_Material_Family", "GENERAL")

            # Canonical key signature for identity hash
            canonical_keys = [material_profiles[m].get("Canonical_Material_Key", "") for m in sorted_members]
            hash_input = f"{':'.join(sorted_members)}|{':'.join(canonical_keys)}|{json.dumps(consolidated, sort_keys=True)}"
            group_identity_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

            # Determine governance status (AUTOMATED CANNOT BE APPROVED_MASTER)
            if member_count == 1:
                status = "STANDALONE_CANDIDATE"
                confidence = 1.0
            elif partition_status == "SPLIT_CONFLICT":
                status = "SPLIT_CONFLICT"
                confidence = 0.60
            elif has_attr_conflict:
                status = "AMBIGUOUS_REVIEW_REQUIRED"
                confidence = 0.70
            else:
                # Multi-CPSE group with complete compatibility
                # Check if all pairs are direct accepted vs transitive
                is_fully_direct = True
                avg_confidence = 1.0
                scores = []
                for i in range(len(sorted_members)):
                    for j in range(i + 1, len(sorted_members)):
                        p = tuple(sorted([sorted_members[i], sorted_members[j]]))
                        if p in edge_data:
                            scores.append(edge_data[p].get("refined_score", 1.0))
                        else:
                            is_fully_direct = False

                if scores:
                    avg_confidence = sum(scores) / len(scores)

                if is_fully_direct and not has_attr_conflict and len(cpse_coverage) >= 2:
                    status = "VERIFIED_HARMONIZED"
                else:
                    status = "AMBIGUOUS_REVIEW_REQUIRED" if not is_fully_direct else "VERIFIED_HARMONIZED"

                confidence = round(avg_confidence, 3)

            candidate_groups.append({
                "member_codes": sorted_members,
                "family": family,
                "consolidated": consolidated,
                "common_description": common_desc,
                "cpse_coverage": cpse_coverage,
                "member_count": member_count,
                "governance_status": status,
                "group_confidence": confidence,
                "group_identity_hash": group_identity_hash,
            })

        # Deterministic Sequence Assignment:
        # Group by (family, hash_prefix) collision buckets and sort by group_identity_hash
        collision_buckets = {}
        for grp in candidate_groups:
            fam_token = self.FAMILY_CODE_MAP.get(grp["family"].upper(), grp["family"].upper()[:6])
            fam_token = re.sub(r"[^A-Z0-9]", "", fam_token)
            if len(fam_token) < 3:
                fam_token = fam_token.ljust(3, "X")
            hash_prefix = grp["group_identity_hash"][:6].upper()
            bucket_key = (fam_token, hash_prefix)

            if bucket_key not in collision_buckets:
                collision_buckets[bucket_key] = []
            collision_buckets[bucket_key].append(grp)

        master_records = []
        member_records = []

        # Process buckets in deterministic order
        for bucket_key in sorted(collision_buckets.keys()):
            bucket_groups = sorted(collision_buckets[bucket_key], key=lambda x: x["group_identity_hash"])
            for idx, grp in enumerate(bucket_groups, start=1):
                cmm_code = self._generate_deterministic_cmm_code(grp["family"], grp["group_identity_hash"], idx)
                common_material_id = cmm_code

                master_rec = {
                    "common_material_id": common_material_id,
                    "common_code": cmm_code,
                    "common_description": grp["common_description"],
                    "material_family": grp["family"],
                    "material_type": grp["consolidated"].get("material_type", ""),
                    "material_grade": grp["consolidated"].get("material_grade", ""),
                    "nominal_size": grp["consolidated"].get("nominal_size") or grp["consolidated"].get("size", ""),
                    "pressure_rating": grp["consolidated"].get("pressure_class") or grp["consolidated"].get("rating", ""),
                    "standard_spec": grp["consolidated"].get("standard") or grp["consolidated"].get("specification", ""),
                    "unit_of_measure": grp["consolidated"].get("unit", ""),
                    "consolidated_attributes": grp["consolidated"],
                    "cpse_coverage": grp["cpse_coverage"],
                    "member_count": grp["member_count"],
                    "governance_status": grp["governance_status"],
                    "group_confidence": grp["group_confidence"],
                    "group_identity_hash": grp["group_identity_hash"],
                    "approved_by": None,
                    "approved_at": None,
                    "approval_rationale": None,
                }
                master_records.append(master_rec)

                # Create member records with explicit membership semantics
                for m_code in grp["member_codes"]:
                    m_prof = material_profiles[m_code]

                    # Membership type evaluation
                    # Check edges involving m_code within this group
                    m_edges = []
                    m_reviewers = []
                    m_hashes = []
                    is_direct = False

                    for other in grp["member_codes"]:
                        if other == m_code:
                            continue
                        p = tuple(sorted([m_code, other]))
                        if p in edge_data:
                            is_direct = True
                            e_info = edge_data[p]
                            if e_info.get("candidate_id"):
                                m_edges.append(e_info["candidate_id"])
                            if e_info.get("reviewer_id"):
                                m_reviewers.append(e_info["reviewer_id"])
                            if e_info.get("evidence_snapshot_hash"):
                                m_hashes.append(e_info["evidence_snapshot_hash"])

                    if grp["member_count"] == 1:
                        m_type = "STANDALONE"
                    elif is_direct:
                        m_type = "DIRECT_ACCEPTED"
                    else:
                        m_type = "TRANSITIVE_VERIFIED"

                    # Deterministic member UUID based on master and source code
                    mem_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{common_material_id}:{m_code}"))

                    mem_rec = {
                        "id": mem_uuid,
                        "common_material_id": common_material_id,
                        "source_material_code": m_code,
                        "source_cpse": m_prof.get("CPSE", ""),
                        "source_description": m_prof.get("Material_Description", ""),
                        "canonical_material_key": m_prof.get("Canonical_Material_Key", ""),
                        "membership_type": m_type,
                        "accepted_edge_candidate_ids": sorted(list(set(m_edges))),
                        "reviewer_ids": sorted(list(set(m_reviewers))),
                        "evidence_snapshot_hashes": sorted(list(set(m_hashes))),
                    }
                    member_records.append(mem_rec)

        # Sort master records deterministically
        master_records = sorted(master_records, key=lambda x: x["common_code"])
        member_records = sorted(member_records, key=lambda x: (x["common_material_id"], x["source_material_code"]))

        return {
            "master_records": master_records,
            "member_records": member_records,
            "summary": {
                "total_source_materials": len(all_material_codes),
                "total_common_material_groups": len(master_records),
                "multi_cpse_groups": sum(1 for m in master_records if len(m["cpse_coverage"]) > 1),
                "standalone_groups": sum(1 for m in master_records if m["member_count"] == 1),
                "verified_harmonized": sum(1 for m in master_records if m["governance_status"] == "VERIFIED_HARMONIZED"),
                "ambiguous_review_required": sum(1 for m in master_records if m["governance_status"] == "AMBIGUOUS_REVIEW_REQUIRED"),
                "split_conflict": sum(1 for m in master_records if m["governance_status"] == "SPLIT_CONFLICT"),
                "approved_master": sum(1 for m in master_records if m["governance_status"] == "APPROVED_MASTER"),
            }
        }


# Global service instance
common_master_service = CommonMasterService()
