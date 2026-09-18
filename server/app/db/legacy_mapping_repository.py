"""
Legacy Material Mapping Repository (Phase 9)
Handles transactional persistence and queries for legacy_material_mappings.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, desc, or_

try:
    from app.db.review_repository import review_repository
    from app.models.common_master import CommonMaterialMaster
    from app.models.legacy_mapping import LegacyMaterialMapping
    from app.models.review import Base
except ImportError:
    from server.app.db.review_repository import review_repository
    from server.app.models.common_master import CommonMaterialMaster
    from server.app.models.legacy_mapping import LegacyMaterialMapping
    from server.app.models.review import Base


class LegacyMappingRepository:
    """
    Repository managing Legacy Material Mapping records.
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

    def get_mapping_by_code(self, source_cpse: str, material_code: str) -> Optional[Dict[str, Any]]:
        """Fetch single legacy mapping by composite key (source_cpse, material_code)"""
        codes_to_try = [material_code]
        if not material_code.startswith(f"{source_cpse}-"):
            codes_to_try.append(f"{source_cpse}-{material_code}")
        else:
            codes_to_try.append(material_code[len(source_cpse) + 1:])

        with self.get_session() as session:
            stmt = select(LegacyMaterialMapping).where(
                LegacyMaterialMapping.source_cpse == source_cpse,
                LegacyMaterialMapping.material_code.in_(codes_to_try),
            )
            row = session.execute(stmt).scalar_one_or_none()
            return row.to_dict() if row else None

    def query_mappings(
        self,
        search: Optional[str] = None,
        source_cpse: Optional[str] = None,
        mapping_status: Optional[str] = None,
        cmm_code: Optional[str] = None,
        confidence_semantics: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Query legacy mappings with filtering, search, and pagination"""
        with self.get_session() as session:
            stmt = select(LegacyMaterialMapping)

            if source_cpse and source_cpse != "all":
                stmt = stmt.where(LegacyMaterialMapping.source_cpse == source_cpse)

            if mapping_status and mapping_status != "all":
                stmt = stmt.where(LegacyMaterialMapping.mapping_status == mapping_status)

            if confidence_semantics and confidence_semantics != "all":
                stmt = stmt.where(LegacyMaterialMapping.confidence_semantics == confidence_semantics)

            if cmm_code:
                stmt = stmt.where(LegacyMaterialMapping.cmm_code == cmm_code)

            if search:
                term = f"%{search.strip().lower()}%"
                stmt = stmt.where(
                    or_(
                        func.lower(LegacyMaterialMapping.material_code).like(term),
                        func.lower(LegacyMaterialMapping.source_description).like(term),
                        func.lower(LegacyMaterialMapping.cmm_code).like(term),
                    )
                )

            # Count total matching rows
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total = session.execute(count_stmt).scalar() or 0

            # Sorting & pagination: deterministic sort by (source_cpse, material_code)
            stmt = stmt.order_by(
                LegacyMaterialMapping.source_cpse.asc(),
                LegacyMaterialMapping.material_code.asc(),
            )
            offset = (page - 1) * page_size
            stmt = stmt.offset(offset).limit(page_size)

            rows = session.execute(stmt).scalars().all()
            return {
                "items": [r.to_dict() for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
            }

    def get_mappings_by_cmm(self, cmm_code: str) -> List[Dict[str, Any]]:
        """List all legacy materials mapped to a given CMM code"""
        with self.get_session() as session:
            stmt = (
                select(LegacyMaterialMapping)
                .where(LegacyMaterialMapping.cmm_code == cmm_code)
                .order_by(
                    LegacyMaterialMapping.source_cpse.asc(),
                    LegacyMaterialMapping.material_code.asc(),
                )
            )
            rows = session.execute(stmt).scalars().all()
            return [r.to_dict() for r in rows]

    def get_stats(self) -> Dict[str, Any]:
        """Aggregate high-level summary KPIs for Legacy Material Mappings"""
        with self.get_session() as session:
            total_mappings = session.execute(select(func.count(LegacyMaterialMapping.mapping_id))).scalar() or 0
            
            mapped_verified = session.execute(
                select(func.count(LegacyMaterialMapping.mapping_id)).where(LegacyMaterialMapping.mapping_status == "MAPPED_VERIFIED")
            ).scalar() or 0

            mapped_standalone = session.execute(
                select(func.count(LegacyMaterialMapping.mapping_id)).where(LegacyMaterialMapping.mapping_status == "MAPPED_STANDALONE")
            ).scalar() or 0

            review_required = session.execute(
                select(func.count(LegacyMaterialMapping.mapping_id)).where(LegacyMaterialMapping.mapping_status == "REVIEW_REQUIRED")
            ).scalar() or 0

            conflict = session.execute(
                select(func.count(LegacyMaterialMapping.mapping_id)).where(LegacyMaterialMapping.mapping_status == "CONFLICT")
            ).scalar() or 0

            unmapped = session.execute(
                select(func.count(LegacyMaterialMapping.mapping_id)).where(LegacyMaterialMapping.mapping_status == "UNMAPPED")
            ).scalar() or 0

            # CPSE distribution - dynamically queried from all distinct source CPSEs in the dataset
            cpse_counts = {}
            cpse_rows = session.execute(
                select(LegacyMaterialMapping.source_cpse, func.count(LegacyMaterialMapping.mapping_id))
                .group_by(LegacyMaterialMapping.source_cpse)
                .order_by(LegacyMaterialMapping.source_cpse.asc())
            ).all()
            for cpse, cnt in cpse_rows:
                if cpse:
                    cpse_counts[str(cpse).strip()] = cnt

            coverage_pct = round(((mapped_verified + mapped_standalone) / total_mappings) * 100, 1) if total_mappings > 0 else 0.0

            return {
                "total_source_materials": total_mappings,
                "total_mappings": total_mappings,
                "mapped_verified": mapped_verified,
                "verified_mapped": mapped_verified,
                "mapped_standalone": mapped_standalone,
                "standalone_mapped": mapped_standalone,
                "review_required": review_required,
                "conflict": conflict,
                "unmapped": unmapped,
                "transitive_verified": 0,
                "cpse_distribution": cpse_counts,
                "mapping_coverage_pct": coverage_pct,
            }

    def bulk_replace_mappings(self, mapping_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Atomically replaces the entire legacy_material_mappings table
        with newly synthesized deterministic records.
        """
        with self.get_session() as session:
            try:
                session.query(LegacyMaterialMapping).delete()
                
                db_records = []
                for m in mapping_records:
                    rec = LegacyMaterialMapping(
                        mapping_id=m["mapping_id"],
                        source_cpse=m["source_cpse"],
                        material_code=m["material_code"],
                        source_description=m["source_description"],
                        cmm_code=m.get("cmm_code"),
                        cmm_group_id=m.get("cmm_group_id"),
                        mapping_status=m["mapping_status"],
                        membership_type=m["membership_type"],
                        confidence_score=m["confidence_score"],
                        confidence_semantics=m["confidence_semantics"],
                        mapping_method=m["mapping_method"],
                        mapping_reason=m["mapping_reason"],
                        accepted_candidate_id=m.get("accepted_candidate_id"),
                        phase6_validation_status=m.get("phase6_validation_status"),
                        phase7_review_decision=m.get("phase7_review_decision"),
                        evidence_hash=m.get("evidence_hash"),
                        canonical_material_key=m["canonical_material_key"],
                    )
                    db_records.append(rec)

                session.bulk_save_objects(db_records)
                session.commit()
                return {
                    "status": "success",
                    "records_saved": len(db_records),
                }
            except Exception as e:
                session.rollback()
                raise e


# Global repository instance
legacy_mapping_repository = LegacyMappingRepository()
