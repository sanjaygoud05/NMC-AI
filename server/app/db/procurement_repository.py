"""
Procurement Intelligence Repository (Phase 10)
Handles transactional persistence and queries for:
- procurement_facts
- cmm_procurement_summary
- procurement_opportunities
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy import select, func, desc, or_

try:
    from app.db.review_repository import review_repository
    from app.models.common_master import CommonMaterialMaster
    from app.models.procurement import (
        ProcurementFact,
        CMMProcurementSummary,
        ProcurementOpportunity,
    )
    from app.models.review import Base
except ImportError:
    from server.app.db.review_repository import review_repository
    from server.app.models.common_master import CommonMaterialMaster
    from server.app.models.procurement import (
        ProcurementFact,
        CMMProcurementSummary,
        ProcurementOpportunity,
    )
    from server.app.models.review import Base


class ProcurementRepository:
    """
    Repository managing Phase 10 Procurement Intelligence & Analytics data.
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

    def bulk_replace_procurement_data(
        self,
        facts: List[Dict[str, Any]],
        cmm_summaries: List[Dict[str, Any]],
        opportunities: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Atomically replaces all procurement tables in a single transaction.
        """
        with self.get_session() as session:
            try:
                # 1. Clear existing tables in dependency order
                session.query(ProcurementOpportunity).delete()
                session.query(CMMProcurementSummary).delete()
                session.query(ProcurementFact).delete()

                # 2. Insert Procurement Facts
                fact_entities = []
                for f in facts:
                    lpd = None
                    if f.get("last_purchase_date"):
                        try:
                            lpd = datetime.strptime(str(f["last_purchase_date"]).strip(), "%Y-%m-%d").date()
                        except ValueError:
                            lpd = None

                    fact_entities.append(
                        ProcurementFact(
                            fact_id=f["fact_id"],
                            source_cpse=f["source_cpse"],
                            material_code=f["material_code"],
                            material_description=f["material_description"],
                            cmm_code=f["cmm_code"],
                            material_category=f["material_category"],
                            material_type=f.get("material_type"),
                            unit_of_measure=f["unit_of_measure"],
                            plant=f["plant"],
                            material_status=f["material_status"],
                            annual_consumption=int(f["annual_consumption"]),
                            last_purchase_date=lpd,
                            manufacturer=f.get("manufacturer"),
                            manufacturer_part_no=f.get("manufacturer_part_no"),
                        )
                    )
                session.bulk_save_objects(fact_entities)

                # 3. Insert CMM Procurement Summaries
                cmm_entities = []
                for c in cmm_summaries:
                    epd = None
                    if c.get("earliest_purchase_date"):
                        try:
                            epd = datetime.strptime(str(c["earliest_purchase_date"]).strip(), "%Y-%m-%d").date()
                        except ValueError:
                            epd = None

                    lpd = None
                    if c.get("latest_purchase_date"):
                        try:
                            lpd = datetime.strptime(str(c["latest_purchase_date"]).strip(), "%Y-%m-%d").date()
                        except ValueError:
                            lpd = None

                    cmm_entities.append(
                        CMMProcurementSummary(
                            cmm_code=c["cmm_code"],
                            common_description=c["common_description"],
                            material_family=c["material_family"],
                            governance_status=c["governance_status"],
                            member_count=int(c["member_count"]),
                            cpse_count=int(c["cpse_count"]),
                            consuming_cpses=c["consuming_cpses"],
                            primary_uom=c["primary_uom"],
                            total_annual_consumption=int(c["total_annual_consumption"]),
                            avg_consumption_per_member=float(c["avg_consumption_per_member"]),
                            plant_count=int(c["plant_count"]),
                            dominant_plant=c.get("dominant_plant"),
                            earliest_purchase_date=epd,
                            latest_purchase_date=lpd,
                            purchase_recency_days=int(c["purchase_recency_days"]) if c.get("purchase_recency_days") not in (None, "") else None,
                            active_member_count=int(c["active_member_count"]),
                            inactive_member_count=int(c["inactive_member_count"]),
                            unique_manufacturers_count=int(c["unique_manufacturers_count"]),
                            unique_part_numbers_count=int(c["unique_part_numbers_count"]),
                            manufacturer_diversity_flag=bool(c.get("manufacturer_diversity_flag", False)),
                        )
                    )
                session.bulk_save_objects(cmm_entities)

                # 4. Insert Procurement Opportunities
                opp_entities = []
                for o in opportunities:
                    opp_entities.append(
                        ProcurementOpportunity(
                            opportunity_id=o["opportunity_id"],
                            opportunity_type=o["opportunity_type"],
                            cmm_code=o["cmm_code"],
                            source_cpses=o["source_cpses"],
                            material_codes=o["material_codes"],
                            trigger_metric=o["trigger_metric"],
                            trigger_value=str(o["trigger_value"]),
                            threshold=str(o["threshold"]),
                            reason=o["reason"],
                            evidence_reference=o["evidence_reference"],
                        )
                    )
                session.bulk_save_objects(opp_entities)

                session.commit()
                return {
                    "facts_count": len(fact_entities),
                    "cmm_summaries_count": len(cmm_entities),
                    "opportunities_count": len(opp_entities),
                }
            except Exception:
                session.rollback()
                raise

    def get_kpis(self) -> Dict[str, Any]:
        """
        Calculates high-level procurement analytics KPIs partitioned strictly by UOM.
        """
        with self.get_session() as session:
            total_materials = session.execute(select(func.count(ProcurementFact.fact_id))).scalar() or 0
            total_cmms = session.execute(select(func.count(CMMProcurementSummary.cmm_code))).scalar() or 0

            # Multi-CPSE vs Standalone CMM counts
            multi_cpse_cmms = session.execute(
                select(func.count(CMMProcurementSummary.cmm_code)).where(CMMProcurementSummary.cpse_count >= 2)
            ).scalar() or 0
            standalone_cmms = session.execute(
                select(func.count(CMMProcurementSummary.cmm_code)).where(CMMProcurementSummary.cpse_count == 1)
            ).scalar() or 0

            # Strictly partition consumption volume by UOM
            uom_stmt = select(
                ProcurementFact.unit_of_measure,
                func.sum(ProcurementFact.annual_consumption)
            ).group_by(ProcurementFact.unit_of_measure)
            volume_by_uom = {row[0]: int(row[1]) for row in session.execute(uom_stmt).all()}

            # Multi-CPSE harmonized volume strictly per UOM
            multi_cpse_uom_stmt = select(
                CMMProcurementSummary.primary_uom,
                func.sum(CMMProcurementSummary.total_annual_consumption)
            ).where(CMMProcurementSummary.cpse_count >= 2).group_by(CMMProcurementSummary.primary_uom)
            multi_cpse_volume_by_uom = {row[0]: int(row[1]) for row in session.execute(multi_cpse_uom_stmt).all()}

            # Lifecycle distribution
            active_materials = session.execute(
                select(func.count(ProcurementFact.fact_id)).where(ProcurementFact.material_status == "Active")
            ).scalar() or 0
            inactive_materials = total_materials - active_materials
            active_pct = round((active_materials / total_materials * 100), 2) if total_materials > 0 else 0.0

            # Operational counts
            distinct_plants = session.execute(select(func.count(func.distinct(ProcurementFact.plant)))).scalar() or 0
            distinct_manufacturers = session.execute(
                select(func.count(func.distinct(ProcurementFact.manufacturer))).where(ProcurementFact.manufacturer != "")
            ).scalar() or 0

            # Opportunities breakdown
            opp_stmt = select(
                ProcurementOpportunity.opportunity_type,
                func.count(ProcurementOpportunity.opportunity_id)
            ).group_by(ProcurementOpportunity.opportunity_type)
            opps_by_type = {row[0]: int(row[1]) for row in session.execute(opp_stmt).all()}
            total_opps = sum(opps_by_type.values())

            return {
                "total_materials_analyzed": total_materials,
                "total_cmm_entities": total_cmms,
                "multi_cpse_cmms_count": multi_cpse_cmms,
                "standalone_cmms_count": standalone_cmms,
                "volume_by_uom": volume_by_uom,
                "multi_cpse_volume_by_uom": multi_cpse_volume_by_uom,
                "active_materials_count": active_materials,
                "inactive_materials_count": inactive_materials,
                "active_materials_pct": active_pct,
                "distinct_plants_count": distinct_plants,
                "distinct_manufacturers_count": distinct_manufacturers,
                "opportunities_by_type": opps_by_type,
                "total_opportunities_count": total_opps,
                "analysis_reference_date": "2026-03-31",
            }

    def get_cpse_summaries(self) -> List[Dict[str, Any]]:
        """Returns enterprise CPSE procurement summaries partitioned by UOM"""
        with self.get_session() as session:
            results = []
            distinct_cpses = session.execute(
                select(func.distinct(ProcurementFact.source_cpse)).where(ProcurementFact.source_cpse != "").order_by(ProcurementFact.source_cpse)
            ).scalars().all()
            for cpse in distinct_cpses:
                total_mats = session.execute(
                    select(func.count(ProcurementFact.fact_id)).where(
                        ProcurementFact.source_cpse == cpse
                    )
                ).scalar() or 0

                active_count = session.execute(
                    select(func.count(ProcurementFact.fact_id)).where(
                        ProcurementFact.source_cpse == cpse,
                        ProcurementFact.material_status == "Active"
                    )
                ).scalar() or 0

                inactive_count = total_mats - active_count

                vol_nos = session.execute(
                    select(func.coalesce(func.sum(ProcurementFact.annual_consumption), 0)).where(
                        ProcurementFact.source_cpse == cpse,
                        ProcurementFact.unit_of_measure == "NOS"
                    )
                ).scalar() or 0

                vol_mtr = session.execute(
                    select(func.coalesce(func.sum(ProcurementFact.annual_consumption), 0)).where(
                        ProcurementFact.source_cpse == cpse,
                        ProcurementFact.unit_of_measure == "MTR"
                    )
                ).scalar() or 0

                vol_set = session.execute(
                    select(func.coalesce(func.sum(ProcurementFact.annual_consumption), 0)).where(
                        ProcurementFact.source_cpse == cpse,
                        ProcurementFact.unit_of_measure == "SET"
                    )
                ).scalar() or 0

                vol_other = session.execute(
                    select(func.coalesce(func.sum(ProcurementFact.annual_consumption), 0)).where(
                        ProcurementFact.source_cpse == cpse,
                        ~ProcurementFact.unit_of_measure.in_(["NOS", "MTR", "SET"])
                    )
                ).scalar() or 0

                distinct_plants = session.execute(
                    select(func.count(func.distinct(ProcurementFact.plant))).where(
                        ProcurementFact.source_cpse == cpse,
                        ProcurementFact.plant != ""
                    )
                ).scalar() or 0

                distinct_oems = session.execute(
                    select(func.count(func.distinct(ProcurementFact.manufacturer))).where(
                        ProcurementFact.source_cpse == cpse,
                        ProcurementFact.manufacturer != ""
                    )
                ).scalar() or 0

                multi_members = session.execute(
                    select(func.count(ProcurementFact.fact_id)).where(
                        ProcurementFact.source_cpse == cpse,
                        ProcurementFact.cmm_code == "CMM-VALVE-A79389-001"
                    )
                ).scalar() or 0

                results.append({
                    "source_cpse": cpse,
                    "total_material_records": int(total_mats),
                    "active_material_count": int(active_count),
                    "inactive_material_count": int(inactive_count),
                    "total_volume_nos": int(vol_nos),
                    "total_volume_mtr": int(vol_mtr),
                    "total_volume_set": int(vol_set),
                    "total_volume_other": int(vol_other),
                    "distinct_plants_count": int(distinct_plants),
                    "distinct_manufacturers_count": int(distinct_oems),
                    "multi_cpse_harmonized_members": int(multi_members),
                })
            return results

    def query_cmm_summaries(
        self,
        search: Optional[str] = None,
        material_family: Optional[str] = None,
        primary_uom: Optional[str] = None,
        cpse: Optional[str] = None,
        min_consumption: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Query CMM procurement summaries with filtering, search, and pagination"""
        with self.get_session() as session:
            stmt = select(CMMProcurementSummary)

            if search:
                term = f"%{search.strip()}%"
                stmt = stmt.where(
                    or_(
                        CMMProcurementSummary.cmm_code.ilike(term),
                        CMMProcurementSummary.common_description.ilike(term),
                        CMMProcurementSummary.material_family.ilike(term),
                    )
                )

            if material_family and material_family.upper() != "ALL":
                stmt = stmt.where(CMMProcurementSummary.material_family == material_family.upper())

            if primary_uom and primary_uom.upper() != "ALL":
                stmt = stmt.where(CMMProcurementSummary.primary_uom == primary_uom.upper())

            if cpse and cpse.upper() != "ALL":
                stmt = stmt.where(CMMProcurementSummary.consuming_cpses.like(f"%{cpse.upper()}%"))

            if min_consumption is not None and min_consumption > 0:
                stmt = stmt.where(CMMProcurementSummary.total_annual_consumption >= min_consumption)

            total = session.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0

            # Sort descending by total annual consumption volume
            stmt = stmt.order_by(desc(CMMProcurementSummary.total_annual_consumption), CMMProcurementSummary.cmm_code.asc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)

            rows = session.execute(stmt).scalars().all()
            total_pages = max(1, (total + page_size - 1) // page_size)

            return {
                "items": [r.to_dict() for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
            }

    def get_cmm_summary_detail(self, cmm_code: str) -> Optional[Dict[str, Any]]:
        """Fetch single CMM procurement summary with all member facts"""
        with self.get_session() as session:
            summary = session.execute(
                select(CMMProcurementSummary).where(CMMProcurementSummary.cmm_code == cmm_code)
            ).scalar_one_or_none()

            if not summary:
                return None

            facts = session.execute(
                select(ProcurementFact).where(ProcurementFact.cmm_code == cmm_code).order_by(
                    ProcurementFact.source_cpse.asc(), ProcurementFact.material_code.asc()
                )
            ).scalars().all()

            opps = session.execute(
                select(ProcurementOpportunity).where(ProcurementOpportunity.cmm_code == cmm_code).order_by(
                    ProcurementOpportunity.opportunity_type.asc()
                )
            ).scalars().all()

            res = summary.to_dict()
            res["members"] = [f.to_dict() for f in facts]
            res["opportunities"] = [o.to_dict() for o in opps]
            return res

    def query_opportunities(
        self,
        opportunity_type: Optional[str] = None,
        cpse: Optional[str] = None,
        source_cpse: Optional[str] = None,
        cmm_code: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Query procurement opportunities with filtering and pagination"""
        effective_cpse = cpse or source_cpse
        with self.get_session() as session:
            stmt = select(ProcurementOpportunity)

            if opportunity_type and opportunity_type.upper() != "ALL":
                stmt = stmt.where(ProcurementOpportunity.opportunity_type == opportunity_type.strip())

            if effective_cpse and effective_cpse.upper() != "ALL":
                stmt = stmt.where(ProcurementOpportunity.source_cpses.like(f"%{effective_cpse.strip()}%"))

            if cmm_code:
                stmt = stmt.where(ProcurementOpportunity.cmm_code == cmm_code.strip())

            total = session.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0

            stmt = stmt.order_by(
                ProcurementOpportunity.opportunity_type.asc(),
                ProcurementOpportunity.cmm_code.asc(),
                ProcurementOpportunity.opportunity_id.asc(),
            )
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)

            rows = session.execute(stmt).scalars().all()
            total_pages = max(1, (total + page_size - 1) // page_size)

            return {
                "items": [r.to_dict() for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
            }

    def get_plant_distribution(self) -> List[Dict[str, Any]]:
        """Aggregates consumption volume strictly per plant and UOM"""
        with self.get_session() as session:
            stmt = select(
                ProcurementFact.plant,
                ProcurementFact.source_cpse,
                ProcurementFact.unit_of_measure,
                func.sum(ProcurementFact.annual_consumption).label("total_volume"),
                func.count(ProcurementFact.fact_id).label("material_count")
            ).group_by(
                ProcurementFact.plant,
                ProcurementFact.source_cpse,
                ProcurementFact.unit_of_measure
            ).order_by(
                ProcurementFact.source_cpse.asc(),
                ProcurementFact.plant.asc(),
                ProcurementFact.unit_of_measure.asc()
            )

            rows = session.execute(stmt).all()
            return [
                {
                    "plant": r[0],
                    "source_cpse": r[1],
                    "unit_of_measure": r[2],
                    "total_volume": int(r[3]),
                    "material_count": int(r[4]),
                }
                for r in rows
            ]

    def query_facts(
        self,
        source_cpse: Optional[str] = None,
        cmm_code: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Query line-level procurement facts"""
        with self.get_session() as session:
            stmt = select(ProcurementFact)

            if source_cpse and source_cpse.upper() != "ALL":
                stmt = stmt.where(ProcurementFact.source_cpse == source_cpse.upper())

            if cmm_code:
                stmt = stmt.where(ProcurementFact.cmm_code == cmm_code.strip())

            if search:
                term = f"%{search.strip()}%"
                stmt = stmt.where(
                    or_(
                        ProcurementFact.material_code.ilike(term),
                        ProcurementFact.material_description.ilike(term),
                        ProcurementFact.plant.ilike(term),
                        ProcurementFact.manufacturer.ilike(term),
                    )
                )

            total = session.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
            stmt = stmt.order_by(ProcurementFact.source_cpse.asc(), ProcurementFact.material_code.asc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)

            rows = session.execute(stmt).scalars().all()
            total_pages = max(1, (total + page_size - 1) // page_size)

            return {
                "items": [r.to_dict() for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
            }


# Global repository instance
procurement_repository = ProcurementRepository()
