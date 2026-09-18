"""
Common Material Master Repository (Phase 8)
Handles transactional persistence and queries for common_material_master and common_material_members.
"""

import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload

try:
    from app.db.review_repository import review_repository
    from app.models.common_master import CommonMaterialMaster, CommonMaterialMember
    from app.models.review import Base
except ImportError:
    from server.app.db.review_repository import review_repository
    from server.app.models.common_master import CommonMaterialMaster, CommonMaterialMember
    from server.app.models.review import Base


class CommonMasterRepository:
    """
    Repository managing Common Material Master records and source membership links.
    """

    def __init__(self, engine=None):
        self.engine = engine or review_repository.engine
        self.SessionLocal = review_repository.SessionLocal
        self._init_db()

    def _init_db(self):
        """Create database tables if they do not exist"""
        Base.metadata.create_all(bind=self.engine)

    def get_session(self):
        """Get a new database session"""
        return self.SessionLocal()

    def get_common_material(self, common_material_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single common material by ID with all member mappings"""
        with self.get_session() as session:
            stmt = (
                select(CommonMaterialMaster)
                .options(selectinload(CommonMaterialMaster.members))
                .where(
                    or_(
                        CommonMaterialMaster.common_material_id == common_material_id,
                        CommonMaterialMaster.common_code == common_material_id,
                    )
                )
            )
            row = session.execute(stmt).scalar_one_or_none()
            return row.to_dict() if row else None

    def query_common_materials(
        self,
        search: Optional[str] = None,
        family: Optional[str] = None,
        governance_status: Optional[str] = None,
        cpse: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Query common materials with filtering, search, and pagination"""
        with self.get_session() as session:
            stmt = select(CommonMaterialMaster).options(selectinload(CommonMaterialMaster.members))

            if family and family != "all":
                stmt = stmt.where(CommonMaterialMaster.material_family == family)

            if governance_status and governance_status != "all":
                stmt = stmt.where(CommonMaterialMaster.governance_status == governance_status)

            if search:
                term = f"%{search.strip().lower()}%"
                stmt = stmt.where(
                    or_(
                        func.lower(CommonMaterialMaster.common_code).like(term),
                        func.lower(CommonMaterialMaster.common_description).like(term),
                        func.lower(CommonMaterialMaster.material_family).like(term),
                    )
                )

            # Total matching count
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total = session.execute(count_stmt).scalar() or 0

            # Sorting & pagination
            stmt = stmt.order_by(
                desc(CommonMaterialMaster.member_count),
                CommonMaterialMaster.common_code.asc(),
            )
            offset = (page - 1) * page_size
            stmt = stmt.offset(offset).limit(page_size)

            rows = session.execute(stmt).scalars().all()
            items = [r.to_dict() for r in rows]

            # In-memory filter for JSON cpse if specified
            if cpse and cpse != "all":
                items = [m for m in items if cpse in m.get("cpse_coverage", [])]

            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            }

    def get_stats(self) -> Dict[str, Any]:
        """Calculate high-level summary KPIs for Common Material Master catalog"""
        with self.get_session() as session:
            total_groups = session.execute(select(func.count(CommonMaterialMaster.common_material_id))).scalar() or 0
            
            multi_cpse = session.execute(
                select(func.count(CommonMaterialMaster.common_material_id)).where(CommonMaterialMaster.member_count > 1)
            ).scalar() or 0

            standalone = session.execute(
                select(func.count(CommonMaterialMaster.common_material_id)).where(CommonMaterialMaster.member_count == 1)
            ).scalar() or 0

            approved = session.execute(
                select(func.count(CommonMaterialMaster.common_material_id)).where(CommonMaterialMaster.governance_status == "APPROVED_MASTER")
            ).scalar() or 0

            verified = session.execute(
                select(func.count(CommonMaterialMaster.common_material_id)).where(CommonMaterialMaster.governance_status == "VERIFIED_HARMONIZED")
            ).scalar() or 0

            ambiguous = session.execute(
                select(func.count(CommonMaterialMaster.common_material_id)).where(CommonMaterialMaster.governance_status == "AMBIGUOUS_REVIEW_REQUIRED")
            ).scalar() or 0

            split_conflict = session.execute(
                select(func.count(CommonMaterialMaster.common_material_id)).where(CommonMaterialMaster.governance_status == "SPLIT_CONFLICT")
            ).scalar() or 0

            total_members = session.execute(select(func.count(CommonMaterialMember.id))).scalar() or 0

            # Unique families
            families = session.execute(select(CommonMaterialMaster.material_family).distinct()).scalars().all()

            return {
                "total_common_materials": total_groups,
                "multi_cpse_harmonized": multi_cpse,
                "standalone_candidates": standalone,
                "verified_harmonized": verified,
                "approved_master": approved,
                "ambiguous_review_required": ambiguous,
                "split_conflict": split_conflict,
                "total_members_mapped": total_members,
                "unique_families_count": len(families),
                "unique_families": sorted(families),
            }

    def update_governance_status(
        self,
        common_material_id: str,
        new_status: str,
        approved_by: str,
        rationale: str,
    ) -> Dict[str, Any]:
        """Update governance status with explicit human sign-off audit"""
        with self.get_session() as session:
            stmt = select(CommonMaterialMaster).where(
                or_(
                    CommonMaterialMaster.common_material_id == common_material_id,
                    CommonMaterialMaster.common_code == common_material_id,
                )
            )
            record = session.execute(stmt).scalar_one_or_none()
            if not record:
                raise ValueError(f"Common Material record {common_material_id} not found")

            record.governance_status = new_status
            record.approved_by = approved_by
            record.approved_at = datetime.now(timezone.utc)
            record.approval_rationale = rationale
            record.updated_at = datetime.now(timezone.utc)

            session.commit()
            return record.to_dict()

    def bulk_replace_master_catalog(
        self,
        master_records: List[Dict[str, Any]],
        member_records: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Atomically replaces the entire common_material_master and common_material_members tables
        with newly synthesized deterministic pipeline results.
        """
        with self.get_session() as session:
            try:
                # Delete existing records
                session.query(CommonMaterialMember).delete()
                session.query(CommonMaterialMaster).delete()

                # Insert masters
                masters = []
                for m in master_records:
                    rec = CommonMaterialMaster(
                        common_material_id=m["common_material_id"],
                        common_code=m["common_code"],
                        common_description=m["common_description"],
                        material_family=m["material_family"],
                        material_type=m.get("material_type"),
                        material_grade=m.get("material_grade"),
                        nominal_size=m.get("nominal_size"),
                        pressure_rating=m.get("pressure_rating"),
                        standard_spec=m.get("standard_spec"),
                        unit_of_measure=m.get("unit_of_measure"),
                        consolidated_attributes=m.get("consolidated_attributes", {}),
                        cpse_coverage=m.get("cpse_coverage", []),
                        member_count=m.get("member_count", 1),
                        governance_status=m.get("governance_status", "STANDALONE_CANDIDATE"),
                        group_confidence=m.get("group_confidence", 1.0),
                        group_identity_hash=m["group_identity_hash"],
                        approved_by=m.get("approved_by"),
                        approved_at=m.get("approved_at"),
                        approval_rationale=m.get("approval_rationale"),
                    )
                    masters.append(rec)
                session.bulk_save_objects(masters)

                # Insert members
                members = []
                for mem in member_records:
                    rec = CommonMaterialMember(
                        id=mem["id"],
                        common_material_id=mem["common_material_id"],
                        source_material_code=mem["source_material_code"],
                        source_cpse=mem["source_cpse"],
                        source_description=mem["source_description"],
                        canonical_material_key=mem["canonical_material_key"],
                        membership_type=mem["membership_type"],
                        accepted_edge_candidate_ids=mem.get("accepted_edge_candidate_ids", []),
                        reviewer_ids=mem.get("reviewer_ids", []),
                        evidence_snapshot_hashes=mem.get("evidence_snapshot_hashes", []),
                    )
                    members.append(rec)
                session.bulk_save_objects(members)

                session.commit()
                return {
                    "status": "success",
                    "masters_saved": len(masters),
                    "members_saved": len(members),
                }
            except Exception as e:
                session.rollback()
                raise e

    def get_pair_overlaps(self, top_n: int = 10) -> list:
        """
        Compute cross-CPSE pair harmonization overlap counts from member table.
        Returns list of {pair, c1, c2, count} dicts sorted by count desc.
        """
        sql = """
            SELECT a.source_cpse as c1, b.source_cpse as c2, COUNT(*) as cnt
            FROM common_material_members a
            JOIN common_material_members b
              ON a.common_material_id = b.common_material_id
              AND a.source_cpse < b.source_cpse
            GROUP BY a.source_cpse, b.source_cpse
            ORDER BY cnt DESC
            LIMIT :top_n
        """
        from sqlalchemy import text
        with self.get_session() as session:
            rows = session.execute(text(sql), {"top_n": top_n}).fetchall()
            return [
                {"c1": r[0], "c2": r[1], "pair": f"{r[0]} & {r[1]}", "count": r[2]}
                for r in rows
            ]

    def get_family_distribution(self) -> list:
        """Return multi-CPSE CMM counts by material_family."""
        from sqlalchemy import text
        sql = """
            SELECT material_family, COUNT(*) as cnt
            FROM common_material_master
            WHERE member_count > 1
            GROUP BY material_family
            ORDER BY cnt DESC
        """
        with self.get_session() as session:
            rows = session.execute(text(sql)).fetchall()
            return [{"family": r[0], "count": r[1]} for r in rows]


# Global repository instance
common_master_repository = CommonMasterRepository()
