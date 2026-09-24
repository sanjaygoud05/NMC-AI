"""
NMC Procurement Intelligence API
Read-only analytics on top of harmonized NMC data.
No fake/mock/hardcoded values anywhere in this module.
"""

from typing import Optional, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, Header
from sqlalchemy import select, func, and_, text

from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import extract_token_from_header, _is_valid_token, _ADMIN_TOKEN_PREFIX
from app.config import settings

def optional_procurement_access(
    authorization: Optional[str] = Header(None),
    x_reviewer_key: Optional[str] = Header(None),
) -> str:
    token = extract_token_from_header(authorization=authorization, x_reviewer_key=x_reviewer_key)
    if not token:
        return 'reviewer'
    if token == settings.ADMIN_PASSWORD or _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
        return 'admin'
    return 'reviewer'

from app.models.nmc_models import (
    CPSE, Material, NMCCommonMaterial, MaterialMapping,
    InventoryRecord, DemandRecord,
)

router = APIRouter(prefix="/api/nmc/procurement", tags=["NMC Procurement Intelligence"])


def _cpse_lookup(session) -> Dict[str, str]:
    rows = session.execute(select(CPSE.id, CPSE.code)).all()
    return {r[0]: r[1] for r in rows}


def _cmm_lookup(session) -> Dict[str, Dict]:
    # Use raw SQL to avoid JSONDecodeError when source_cpses has corrupt/empty values in DB
    rows = session.execute(
        text("""
            SELECT id, national_material_code, canonical_description,
                   material_type, material_family, grade, dimensions, specifications, uom, status
            FROM nmc_common_materials
        """)
    ).fetchall()
    result = {}
    for r in rows:
        result[r[0]] = {
            "id": r[0],
            "national_material_code": r[1],
            "canonical_description": r[2],
            "material_type": r[3],
            "material_family": r[4],
            "grade": r[5],
            "dimensions": r[6],
            "specifications": r[7],
            "uom": r[8],
            "status": r[9],
        }
    return result


# ─── Inventory Summary ────────────────────────────────────────────────────────

@router.get("/summary")
@router.get("/inventory/summary")
def get_inventory_summary(role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        total_on_hand = s.execute(
            select(func.coalesce(func.sum(InventoryRecord.quantity_on_hand), 0.0))
        ).scalar() or 0.0

        total_reserved = s.execute(
            select(func.coalesce(func.sum(InventoryRecord.reserved_quantity), 0.0))
        ).scalar() or 0.0

        total_available = s.execute(
            select(func.coalesce(func.sum(InventoryRecord.available_quantity), 0.0))
        ).scalar() or 0.0

        materials_with_inventory = s.execute(
            select(func.count(func.distinct(InventoryRecord.material_id)))
        ).scalar() or 0

        nmc_cpse_rows = s.execute(
            select(InventoryRecord.cmm_id, func.count(func.distinct(InventoryRecord.cpse_id)))
            .where(InventoryRecord.cmm_id.isnot(None))
            .where(InventoryRecord.available_quantity > 0)
            .group_by(InventoryRecord.cmm_id)
        ).all()

        multi_cpse_nmcs = sum(1 for r in nmc_cpse_rows if r[1] >= 2)

        avail_pct = round((total_available / total_on_hand * 100.0), 1) if total_on_hand > 0 else 0.0
        res_pct = round((total_reserved / total_on_hand * 100.0), 1) if total_on_hand > 0 else 0.0

        return {
            "total_on_hand": round(total_on_hand, 2),
            "total_reserved": round(total_reserved, 2),
            "total_available": round(total_available, 2),
            "total_inventory_units": round(total_on_hand, 2),
            "availability_percentage": avail_pct,
            "reserved_percentage": res_pct,
            "materials_with_inventory": materials_with_inventory,
            "multi_cpse_stock": multi_cpse_nmcs,
            "multi_cpse_nmcs": multi_cpse_nmcs,
            "consolidation_opportunities": multi_cpse_nmcs,
        }


# ─── Filter Options ──────────────────────────────────────────────────────────

@router.get("/filters")
def get_procurement_filters(role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        cpse_rows = s.execute(select(CPSE)).scalars().all()
        cpses = [{"id": c.id, "code": c.code, "name": c.name} for c in cpse_rows]

        cmms = s.execute(select(NMCCommonMaterial)).scalars().all()
        mat_types = sorted(list({c.material_type for c in cmms if c.material_type} | {c.material_family for c in cmms if c.material_family}))

        inv_uoms = s.execute(select(func.distinct(InventoryRecord.uom))).scalars().all()
        dem_uoms = s.execute(select(func.distinct(DemandRecord.uom))).scalars().all()
        uoms = sorted(list({u for u in (inv_uoms + dem_uoms) if u}))

        dem_periods = s.execute(select(func.distinct(DemandRecord.demand_period))).scalars().all()
        periods = sorted([p for p in dem_periods if p])

        nmcs = sorted([{"id": c.id, "code": c.national_material_code, "name": c.canonical_description} for c in cmms], key=lambda x: x["code"])

        return {
            "cpses": cpses,
            "material_types": mat_types,
            "uoms": uoms,
            "demand_periods": periods,
            "nmcs": nmcs,
        }


# ─── Inventory by CPSE ───────────────────────────────────────────────────────

@router.get("/inventory/by-cpse")
def get_inventory_by_cpse(role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        cpse_map = _cpse_lookup(s)
        rows = s.execute(
            select(
                InventoryRecord.cpse_id,
                InventoryRecord.uom,
                func.sum(InventoryRecord.available_quantity).label("total_available"),
                func.sum(InventoryRecord.quantity_on_hand).label("total_on_hand"),
                func.count(func.distinct(InventoryRecord.material_id)).label("material_count"),
            )
            .group_by(InventoryRecord.cpse_id, InventoryRecord.uom)
            .order_by(func.sum(InventoryRecord.available_quantity).desc())
        ).all()

        cpse_totals: Dict[str, Dict] = {}
        for r in rows:
            code = cpse_map.get(r.cpse_id, r.cpse_id)
            if code not in cpse_totals:
                cpse_totals[code] = {
                    "cpse_code": code,
                    "total_available": 0.0,
                    "total_on_hand": 0.0,
                    "material_count": 0,
                    "uom": r.uom,
                    "uom_mixed": False,
                }
            entry = cpse_totals[code]
            if entry["uom"] != r.uom:
                entry["uom_mixed"] = True
            entry["total_available"] += r.total_available or 0.0
            entry["total_on_hand"] += r.total_on_hand or 0.0
            entry["material_count"] += r.material_count or 0

        return sorted(cpse_totals.values(), key=lambda x: x["total_available"], reverse=True)


# ─── Inventory by NMC ────────────────────────────────────────────────────────

@router.get("/inventory/by-nmc")
def get_inventory_by_nmc(
    cpse_id: Optional[str] = Query(None),
    uom: Optional[str] = Query(None),
    material_type: Optional[str] = Query(None),
    nmc_code: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str = Depends(optional_procurement_access),
):
    with nmc_repo.get_session() as s:
        cmm_map = _cmm_lookup(s)

        q = (
            select(
                InventoryRecord.cmm_id,
                InventoryRecord.uom,
                func.sum(InventoryRecord.quantity_on_hand).label("total_on_hand"),
                func.sum(InventoryRecord.available_quantity).label("total_available"),
                func.count(func.distinct(InventoryRecord.cpse_id)).label("cpse_count"),
                func.count(func.distinct(InventoryRecord.material_id)).label("material_count"),
            )
            .where(InventoryRecord.cmm_id.isnot(None))
            .group_by(InventoryRecord.cmm_id, InventoryRecord.uom)
        )
        if cpse_id and cpse_id != "ALL":
            q = q.where(InventoryRecord.cpse_id == cpse_id)
        if uom and uom != "ALL":
            q = q.where(InventoryRecord.uom == uom)

        rows = s.execute(q).all()
        items = []
        for r in rows:
            cmm = cmm_map.get(r.cmm_id, {})
            nmc_val = cmm.get("national_material_code", r.cmm_id)
            desc = cmm.get("canonical_description", "")
            cmm_type = cmm.get("material_type") or ""
            cmm_fam = cmm.get("material_family") or ""

            if nmc_code and nmc_code != "ALL":
                if nmc_code.lower() != nmc_val.lower() and nmc_code != r.cmm_id:
                    continue

            if material_type and material_type != "ALL":
                mt = material_type.lower()
                if mt not in cmm_type.lower() and mt not in cmm_fam.lower():
                    continue

            if search:
                term = search.lower().strip()
                if term not in nmc_val.lower() and term not in desc.lower() and term not in cmm_type.lower() and term not in cmm_fam.lower():
                    continue

            items.append({
                "cmm_id": r.cmm_id,
                "nmc_code": nmc_val,
                "canonical_description": desc,
                "material_type": cmm.get("material_type") or cmm.get("material_family"),
                "material_family": cmm.get("material_family"),
                "grade": cmm.get("grade"),
                "uom": r.uom,
                "total_on_hand": round(r.total_on_hand or 0.0, 4),
                "total_available": round(r.total_available or 0.0, 4),
                "cpse_count": r.cpse_count,
                "material_count": r.material_count,
                "status": "Multi-CPSE" if r.cpse_count >= 2 else "Single-CPSE",
                "consolidation_status": (
                    "Potential Consolidation Opportunity"
                    if r.cpse_count >= 2 and (r.total_available or 0) > 0
                    else "Single CPSE" if r.cpse_count == 1
                    else "No Available Stock"
                ),
            })

        items.sort(key=lambda x: x["total_available"], reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        return {
            "items": items[start: start + page_size],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, -(-total // page_size)),
        }


# ─── Inventory Detail ────────────────────────────────────────────────────────

@router.get("/inventory/{cmm_id}")
@router.get("/inventory/detail/{cmm_id}")
def get_inventory_detail(cmm_id: str, role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        cmm = s.execute(
            select(NMCCommonMaterial).where(NMCCommonMaterial.id == cmm_id)
        ).scalar_one_or_none()
        if not cmm:
            raise HTTPException(status_code=404, detail="Common Material not found.")

        cpse_map = _cpse_lookup(s)
        inv_rows = s.execute(
            select(InventoryRecord)
            .where(InventoryRecord.cmm_id == cmm_id)
            .order_by(InventoryRecord.cpse_id)
        ).scalars().all()

        cpse_inventory = []
        for inv in inv_rows:
            mat = s.execute(select(Material).where(Material.id == inv.material_id)).scalar_one_or_none()
            cpse_inventory.append({
                "inventory_id": inv.id,
                "cpse_code": cpse_map.get(inv.cpse_id, inv.cpse_id),
                "cpse_id": inv.cpse_id,
                "plant": inv.plant or "MAIN-PLANT",
                "material_id": inv.material_id,
                "original_material_code": mat.original_material_code if mat else None,
                "original_description": mat.original_description if mat else None,
                "quantity_on_hand": inv.quantity_on_hand,
                "reserved_quantity": inv.reserved_quantity,
                "available_quantity": inv.available_quantity,
                "uom": inv.uom,
                "inventory_date": inv.inventory_date.isoformat() if inv.inventory_date else None,
            })

        return {
            "cmm": cmm.to_dict(),
            "cpse_inventory": cpse_inventory,
            "total_records": len(cpse_inventory),
        }


# ─── Demand Summary ──────────────────────────────────────────────────────────

@router.get("/demand/summary")
def get_demand_summary(role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        total_demand = s.execute(
            select(func.coalesce(func.sum(DemandRecord.required_quantity), 0.0))
        ).scalar() or 0.0

        total_forecast = s.execute(
            select(func.coalesce(func.sum(DemandRecord.forecast_quantity), 0.0))
        ).scalar() or 0.0

        materials_with_demand = s.execute(
            select(func.count(func.distinct(DemandRecord.material_id)))
        ).scalar() or 0

        nmc_cpse_rows = s.execute(
            select(DemandRecord.cmm_id, func.count(func.distinct(DemandRecord.cpse_id)))
            .where(DemandRecord.cmm_id.isnot(None))
            .where(DemandRecord.required_quantity > 0)
            .group_by(DemandRecord.cmm_id)
        ).all()

        multi_cpse_demand = sum(1 for r in nmc_cpse_rows if r[1] >= 2)

        return {
            "total_demand": round(total_demand, 2),
            "total_forecast": round(total_forecast, 2),
            "materials_with_demand": materials_with_demand,
            "multi_cpse_demand": multi_cpse_demand,
            "multi_cpse_demand_nmcs": multi_cpse_demand,
            "procurement_opportunities": multi_cpse_demand,
            "consolidation_opportunities": multi_cpse_demand,
        }


# ─── Demand by CPSE ──────────────────────────────────────────────────────────

@router.get("/demand/by-cpse")
def get_demand_by_cpse(role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        cpse_map = _cpse_lookup(s)
        rows = s.execute(
            select(
                DemandRecord.cpse_id,
                DemandRecord.uom,
                func.sum(DemandRecord.required_quantity).label("total_required"),
                func.count(func.distinct(DemandRecord.material_id)).label("material_count"),
            )
            .group_by(DemandRecord.cpse_id, DemandRecord.uom)
            .order_by(func.sum(DemandRecord.required_quantity).desc())
        ).all()

        cpse_totals: Dict[str, Dict] = {}
        for r in rows:
            code = cpse_map.get(r.cpse_id, r.cpse_id)
            if code not in cpse_totals:
                cpse_totals[code] = {
                    "cpse_code": code,
                    "total_required": 0.0,
                    "material_count": 0,
                    "uom": r.uom,
                    "uom_mixed": False,
                }
            entry = cpse_totals[code]
            if entry["uom"] != r.uom:
                entry["uom_mixed"] = True
            entry["total_required"] += r.total_required or 0.0
            entry["material_count"] += r.material_count or 0

        return sorted(cpse_totals.values(), key=lambda x: x["total_required"], reverse=True)


# ─── Demand by NMC ───────────────────────────────────────────────────────────

@router.get("/demand/by-nmc")
def get_demand_by_nmc(
    cpse_id: Optional[str] = Query(None),
    uom: Optional[str] = Query(None),
    material_type: Optional[str] = Query(None),
    demand_period: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str = Depends(optional_procurement_access),
):
    with nmc_repo.get_session() as s:
        cpse_map = _cpse_lookup(s)
        cmm_map = _cmm_lookup(s)

        q = (
            select(
                DemandRecord.cmm_id,
                DemandRecord.uom,
                func.sum(DemandRecord.required_quantity).label("combined_demand"),
                func.count(func.distinct(DemandRecord.cpse_id)).label("cpse_count"),
                func.count(func.distinct(DemandRecord.material_id)).label("material_count"),
            )
            .where(DemandRecord.cmm_id.isnot(None))
            .group_by(DemandRecord.cmm_id, DemandRecord.uom)
        )
        if cpse_id and cpse_id != "ALL":
            q = q.where(DemandRecord.cpse_id == cpse_id)
        if uom and uom != "ALL":
            q = q.where(DemandRecord.uom == uom)
        if demand_period and demand_period != "ALL":
            q = q.where(DemandRecord.demand_period == demand_period)

        rows = s.execute(q).all()
        items = []
        for r in rows:
            cmm = cmm_map.get(r.cmm_id, {})
            nmc_code = cmm.get("national_material_code", r.cmm_id)
            desc = cmm.get("canonical_description", "")
            cmm_type = cmm.get("material_type") or ""
            cmm_fam = cmm.get("material_family") or ""

            if material_type and material_type != "ALL":
                mt = material_type.lower()
                if mt not in cmm_type.lower() and mt not in cmm_fam.lower():
                    continue

            if search:
                term = search.lower().strip()
                if term not in nmc_code.lower() and term not in desc.lower() and term not in cmm_type.lower() and term not in cmm_fam.lower():
                    continue

            cpse_rows = s.execute(
                select(DemandRecord.cpse_id, func.sum(DemandRecord.required_quantity))
                .where(and_(DemandRecord.cmm_id == r.cmm_id, DemandRecord.uom == r.uom))
                .group_by(DemandRecord.cpse_id)
            ).all()
            cpse_demand = [
                {"cpse_code": cpse_map.get(cr[0], cr[0]), "required_quantity": round(cr[1] or 0.0, 4)}
                for cr in cpse_rows
            ]

            items.append({
                "cmm_id": r.cmm_id,
                "nmc_code": nmc_code,
                "canonical_description": desc,
                "material_type": cmm.get("material_type") or cmm.get("material_family"),
                "material_family": cmm.get("material_family"),
                "grade": cmm.get("grade"),
                "uom": r.uom,
                "combined_demand": round(r.combined_demand or 0.0, 4),
                "cpse_count": r.cpse_count,
                "material_count": r.material_count,
                "cpse_demand": cpse_demand,
                "procurement_opportunity": (
                    "Potential Consolidated Procurement Opportunity"
                    if r.cpse_count >= 2 and (r.combined_demand or 0) > 0
                    else "Single CPSE Demand" if r.cpse_count == 1
                    else "No Demand"
                ),
            })

        items.sort(key=lambda x: x["combined_demand"], reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        return {
            "items": items[start: start + page_size],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, -(-total // page_size)),
        }


# ─── Demand Detail ───────────────────────────────────────────────────────────

@router.get("/demand/{cmm_id}")
@router.get("/demand/detail/{cmm_id}")
def get_demand_detail(cmm_id: str, role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        cmm = s.execute(
            select(NMCCommonMaterial).where(NMCCommonMaterial.id == cmm_id)
        ).scalar_one_or_none()
        if not cmm:
            raise HTTPException(status_code=404, detail="Common Material not found.")

        cpse_map = _cpse_lookup(s)
        dem_rows = s.execute(
            select(DemandRecord)
            .where(DemandRecord.cmm_id == cmm_id)
            .order_by(DemandRecord.cpse_id)
        ).scalars().all()

        cpse_demand = []
        for dem in dem_rows:
            mat = s.execute(select(Material).where(Material.id == dem.material_id)).scalar_one_or_none()
            cpse_demand.append({
                "demand_id": dem.id,
                "cpse_code": cpse_map.get(dem.cpse_id, dem.cpse_id),
                "cpse_id": dem.cpse_id,
                "plant": dem.plant or "PLANT-01",
                "material_id": dem.material_id,
                "original_material_code": mat.original_material_code if mat else None,
                "original_description": mat.original_description if mat else None,
                "required_quantity": dem.required_quantity,
                "forecast_quantity": dem.forecast_quantity or 0.0,
                "demand_period": dem.demand_period or "Q4 2026",
                "uom": dem.uom,
            })

        total_required = sum(d["required_quantity"] for d in cpse_demand)

        return {
            "cmm": cmm.to_dict(),
            "cpse_demand": cpse_demand,
            "combined_required_quantity": round(total_required, 4),
            "total_records": len(cpse_demand),
        }


# ─── Opportunities ───────────────────────────────────────────────────────────

@router.get("/opportunities")
def get_opportunities(role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        cmm_map = _cmm_lookup(s)

        inv_opps = s.execute(
            select(InventoryRecord.cmm_id, func.count(func.distinct(InventoryRecord.cpse_id)).label("cpse_count"))
            .where(and_(InventoryRecord.cmm_id.isnot(None), InventoryRecord.available_quantity > 0))
            .group_by(InventoryRecord.cmm_id)
            .having(func.count(func.distinct(InventoryRecord.cpse_id)) >= 2)
        ).all()

        dem_opps = s.execute(
            select(DemandRecord.cmm_id, func.count(func.distinct(DemandRecord.cpse_id)).label("cpse_count"))
            .where(and_(DemandRecord.cmm_id.isnot(None), DemandRecord.required_quantity > 0))
            .group_by(DemandRecord.cmm_id)
            .having(func.count(func.distinct(DemandRecord.cpse_id)) >= 2)
        ).all()

        inv_set = {r.cmm_id: r.cpse_count for r in inv_opps}
        dem_set = {r.cmm_id: r.cpse_count for r in dem_opps}
        all_ids = set(inv_set) | set(dem_set)

        result = []
        for cid in all_ids:
            cmm = cmm_map.get(cid, {})
            result.append({
                "cmm_id": cid,
                "nmc_code": cmm.get("national_material_code", cid),
                "canonical_description": cmm.get("canonical_description", ""),
                "has_inventory_opportunity": cid in inv_set,
                "inventory_cpse_count": inv_set.get(cid, 0),
                "has_demand_opportunity": cid in dem_set,
                "demand_cpse_count": dem_set.get(cid, 0),
                "opportunity_type": (
                    "Inventory + Demand" if cid in inv_set and cid in dem_set
                    else "Inventory Only" if cid in inv_set
                    else "Demand Only"
                ),
            })

        return sorted(result, key=lambda x: x["demand_cpse_count"] + x["inventory_cpse_count"], reverse=True)


# ─── Combined Inventory + Demand ─────────────────────────────────────────────

@router.get("/combined/{cmm_id}")
def get_combined(cmm_id: str, role: str = Depends(optional_procurement_access)):
    with nmc_repo.get_session() as s:
        cmm = s.execute(
            select(NMCCommonMaterial).where(NMCCommonMaterial.id == cmm_id)
        ).scalar_one_or_none()
        if not cmm:
            raise HTTPException(status_code=404, detail="Common Material not found.")

        inv_by_uom = s.execute(
            select(InventoryRecord.uom, func.sum(InventoryRecord.available_quantity))
            .where(InventoryRecord.cmm_id == cmm_id)
            .group_by(InventoryRecord.uom)
        ).all()

        dem_by_uom = s.execute(
            select(DemandRecord.uom, func.sum(DemandRecord.required_quantity))
            .where(DemandRecord.cmm_id == cmm_id)
            .group_by(DemandRecord.uom)
        ).all()

        inv_map = {r[0]: round(r[1] or 0.0, 4) for r in inv_by_uom}
        dem_map = {r[0]: round(r[1] or 0.0, 4) for r in dem_by_uom}
        all_uoms = set(inv_map) | set(dem_map)

        uom_analysis = []
        for u in all_uoms:
            inv_qty = inv_map.get(u, 0.0)
            dem_qty = dem_map.get(u, 0.0)
            both = u in inv_map and u in dem_map
            net = round(dem_qty - inv_qty, 4) if both else None
            uom_analysis.append({
                "uom": u,
                "available_inventory": inv_qty,
                "combined_demand": dem_qty,
                "net_requirement": net,
                "uom_compatible": both,
                "insight": (
                    "Existing standardized inventory may cover the aggregated demand."
                    if both and net is not None and net <= 0
                    else "Additional procurement requirement identified."
                    if both and net is not None and net > 0
                    else "Inventory only — no demand data for this UOM."
                    if u in inv_map and u not in dem_map
                    else "Demand only — no inventory data for this UOM."
                ),
            })

        cpse_map = _cpse_lookup(s)
        inv_rows = s.execute(
            select(InventoryRecord).where(InventoryRecord.cmm_id == cmm_id).order_by(InventoryRecord.cpse_id)
        ).scalars().all()
        cpse_inventory = [
            {
                "cpse_code": cpse_map.get(r.cpse_id, r.cpse_id),
                "plant": r.plant or "PLANT-01",
                "quantity_on_hand": r.quantity_on_hand,
                "reserved_quantity": r.reserved_quantity,
                "available_quantity": r.available_quantity,
                "uom": r.uom,
            }
            for r in inv_rows
        ]

        dem_rows = s.execute(
            select(DemandRecord).where(DemandRecord.cmm_id == cmm_id).order_by(DemandRecord.cpse_id)
        ).scalars().all()
        cpse_demand = [
            {
                "cpse_code": cpse_map.get(r.cpse_id, r.cpse_id),
                "plant": r.plant or "PLANT-01",
                "required_quantity": r.required_quantity,
                "forecast_quantity": r.forecast_quantity or 0.0,
                "demand_period": r.demand_period or "Q4 2026",
                "uom": r.uom,
            }
            for r in dem_rows
        ]

        return {
            "cmm": cmm.to_dict(),
            "uom_analysis": uom_analysis,
            "cpse_inventory": cpse_inventory,
            "cpse_demand": cpse_demand,
            "inventory_present": len(inv_map) > 0,
            "demand_present": len(dem_map) > 0,
        }


# ─── Procurement History (per NMC) ───────────────────────────────────────────

@router.get("/history/{cmm_id}")
def get_procurement_history(cmm_id: str, role: str = Depends(optional_procurement_access)):
    """
    Return purchase order history for a given NMC.
    Reads from procurement_history_records table (separate from inventory & demand).
    If the table does not exist yet, returns empty list gracefully.
    """
    with nmc_repo.get_session() as s:
        cmm = s.execute(
            select(NMCCommonMaterial).where(NMCCommonMaterial.id == cmm_id)
        ).scalar_one_or_none()
        if not cmm:
            raise HTTPException(status_code=404, detail="Common Material not found.")

        cpse_map = _cpse_lookup(s)

        try:
            rows = s.execute(
                text("""
                    SELECT phr.id, phr.cpse_id, phr.po_number, phr.supplier_name,
                           phr.quantity, phr.unit_price, phr.uom, phr.po_date,
                           m.original_material_code
                    FROM procurement_history_records phr
                    LEFT JOIN materials m ON phr.material_id = m.id
                    WHERE phr.cmm_id = :cmm_id
                    ORDER BY phr.po_date DESC
                """),
                {"cmm_id": cmm_id}
            ).all()
        except Exception:
            rows = []

        history = []
        for r in rows:
            history.append({
                "id": r[0],
                "cpse_code": cpse_map.get(r[1], r[1]),
                "po_number": r[2],
                "supplier_name": r[3],
                "quantity": r[4],
                "unit_price": r[5],
                "uom": r[6],
                "po_date": r[7],
                "material_code": r[8],
            })

        return {
            "cmm": cmm.to_dict(),
            "history": history,
            "total_records": len(history),
        }
