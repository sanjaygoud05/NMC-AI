"""
generate_cpse_dataset.py

Generates a synthetic Industrial Material Master dataset for 8 Indian CPSEs
and saves it as data/raw/CPSE_Material_Master_cleaned.csv

Run:  python scripts/generate_cpse_dataset.py
"""

import random
from pathlib import Path
import numpy as np
import pandas as pd
from datetime import date, timedelta

# ----------------------------------------------------------------------
# Reproducibility
# ----------------------------------------------------------------------
random.seed(42)
np.random.seed(42)

# ----------------------------------------------------------------------
# Reference data
# ----------------------------------------------------------------------
CPSES = ["ONGC", "IOCL", "HPCL", "NTPC", "SAIL", "Coal India", "NMDC", "BHEL"]

SECTOR_MAP = {
    "ONGC": "Oil & Gas",
    "IOCL": "Oil & Gas",
    "HPCL": "Oil & Gas",
    "NTPC": "Power",
    "SAIL": "Steel",
    "Coal India": "Mining",
    "NMDC": "Mining",
    "BHEL": "Heavy Engineering",
}

# CPSE code prefix used for Material_Code (unique per CPSE)
CODE_PREFIX = {
    "ONGC": "ONGC",
    "IOCL": "IOCL",
    "HPCL": "HPCL",
    "NTPC": "NTPC",
    "SAIL": "SAIL",
    "Coal India": "CIL",
    "NMDC": "NMDC",
    "BHEL": "BHEL",
}

# Starting numeric block per CPSE (mimics ONGC-100001, NTPC-200001 style)
CODE_START = {
    "ONGC": 100001,
    "IOCL": 110001,
    "HPCL": 120001,
    "NTPC": 200001,
    "SAIL": 300001,
    "Coal India": 400001,
    "NMDC": 410001,
    "BHEL": 500001,
}

PLANTS = {
    "ONGC": ["Mumbai Offshore Complex", "Ankleshwar Asset", "Rajahmundry Asset", "Sivasagar Asset", "Uran Plant"],
    "IOCL": ["Panipat Refinery", "Gujarat Refinery", "Haldia Refinery", "Barauni Refinery", "Mathura Refinery"],
    "HPCL": ["Mumbai Refinery", "Visakh Refinery", "Bhatinda Refinery"],
    "NTPC": ["Singrauli STPS", "Ramagundam STPS", "Vindhyachal STPS", "Dadri Plant", "Korba STPS"],
    "SAIL": ["Bhilai Steel Plant", "Rourkela Steel Plant", "Durgapur Steel Plant", "Bokaro Steel Plant"],
    "Coal India": ["Talcher Coalfields", "Korba Coalfields", "Singareni Collieries", "Jharia Coalfields"],
    "NMDC": ["Bailadila Iron Ore Mine", "Donimalai Iron Ore Mine", "Kirandul Complex"],
    "BHEL": ["Hazira Complex", "Trichy Complex", "Bhopal Complex", "Ranipet Complex"],
}

CATEGORIES = ["Valves", "Bearings", "Fasteners", "Pumps", "Pipes & Fittings",
              "Electrical", "Instrumentation", "Seals"]

TYPES_BY_CATEGORY = {
    "Valves": ["Gate Valve", "Ball Valve", "Globe Valve", "Check Valve", "Butterfly Valve", "Control Valve"],
    "Bearings": ["Ball Bearing", "Roller Bearing", "Thrust Bearing", "Needle Bearing", "Taper Roller Bearing"],
    "Fasteners": ["Hex Bolt", "Hex Nut", "Stud Bolt", "Flat Washer", "Socket Head Screw", "Anchor Bolt"],
    "Pumps": ["Centrifugal Pump", "Reciprocating Pump", "Submersible Pump", "Gear Pump", "Vertical Turbine Pump"],
    "Pipes & Fittings": ["Seamless Pipe", "Elbow 90 Deg", "Equal Tee", "Flange", "Reducer", "Welded Pipe"],
    "Electrical": ["XLPE Cable", "Circuit Breaker", "Distribution Transformer", "Induction Motor", "Switchgear Panel"],
    "Instrumentation": ["Pressure Gauge", "Temperature Transmitter", "Flow Meter", "Level Transmitter", "RTD Sensor"],
    "Seals": ["Mechanical Seal", "Spiral Wound Gasket", "O-Ring", "Oil Seal", "Rubber Gasket"],
}

SPECS_BY_CATEGORY = {
    "Valves": ["API 600", "API 602", "API 598", "ASME B16.34", "BS 1873"],
    "Bearings": ["ISO 15", "DIN 625", "ABMA 9"],
    "Fasteners": ["IS 1367", "DIN 931", "ASTM A193", "ASME B18.2.1"],
    "Pumps": ["API 610", "ISO 2858", "IS 1520"],
    "Pipes & Fittings": ["ASTM A106", "IS 1239", "ASME B16.5", "API 5L", "ASME B16.9"],
    "Electrical": ["IS 7098", "IEC 60502", "IS 13947", "IS 2026"],
    "Instrumentation": ["IEC 60529", "ISA 75.01", "ASME B40.100"],
    "Seals": ["API 682", "ASME B16.20", "DIN 3760"],
}

GRADES_BY_CATEGORY = {
    "Valves": ["ASTM A216 WCB", "ASTM A351 CF8M", "SS316", "SS304", "WCB", "LCB"],
    "Bearings": ["Chrome Steel", "Stainless Steel", "AISI 52100"],
    "Fasteners": ["Grade 8.8", "Grade 10.9", "Grade B7", "SS304", "Carbon Steel"],
    "Pumps": ["Cast Iron", "SS316", "Duplex Steel", "Carbon Steel"],
    "Pipes & Fittings": ["IS 2062", "ASTM A106 Gr B", "SS316L", "Carbon Steel", "Alloy Steel"],
    "Electrical": ["Copper", "Aluminium", "XLPE Insulated"],
    "Instrumentation": ["SS316", "Brass", "Polycarbonate"],
    "Seals": ["Viton", "PTFE", "NBR", "Graphite"],
}

SIZES_BY_CATEGORY = {
    "Valves": ["1/2 in", "1 in", "2 in", "4 in", "6 in", "DN 50", "DN 100", "DN 150"],
    "Bearings": ["6208", "6304", "6408", "30205", "22208"],
    "Fasteners": ["M10 x 40", "M12 x 50", "M16 x 65", "M20 x 80", "M24 x 100"],
    "Pumps": ["2 in x 1.5 in", "DN 80", "DN 100", "3 in x 2 in"],
    "Pipes & Fittings": ["DN 50", "DN 80", "DN 100", "DN 150", "2 in", "6 in"],
    "Electrical": ["3C x 95 sq mm", "4C x 25 sq mm", "1C x 300 sq mm", "415V 100A"],
    "Instrumentation": ["0-100 bar", "4-20 mA", "1/2 in NPT", "0-500 Deg C"],
    "Seals": ["50 mm", "65 mm", "100 mm", "2 in"],
}

COATINGS = ["Galvanized", "PTFE Lined", "Epoxy Coated", "None", "Zinc Plated", ""]

UNIT_BY_CATEGORY = {
    "Valves": "NOS",
    "Bearings": "NOS",
    "Fasteners": "NOS",
    "Pumps": "SET",
    "Pipes & Fittings": "MTR",
    "Electrical": "MTR",
    "Instrumentation": "NOS",
    "Seals": "NOS",
}
KG_ELIGIBLE = ["Fasteners", "Seals"]

MANUFACTURERS_BY_CATEGORY = {
    "Valves": ["L&T Valves", "Audco", "KSB", "Fouress", "Leader Valves"],
    "Bearings": ["SKF", "FAG", "NBC Bearings", "Timken"],
    "Fasteners": ["Unbrako", "Sundram Fasteners", "GKW", "Precision Fasteners"],
    "Pumps": ["Kirloskar", "KSB", "Mather+Platt", "WPIL"],
    "Pipes & Fittings": ["Jindal Pipes", "Tata Steel", "ISMT", "Maharashtra Seamless"],
    "Electrical": ["Siemens", "ABB", "Crompton Greaves", "Havells", "BHEL"],
    "Instrumentation": ["Honeywell", "Yokogawa", "ABB", "Emerson"],
    "Seals": ["Chesterton", "Flowserve", "Sealol"],
}

STATUS_CHOICES = ["Active", "Slow-Moving", "Obsolete"]
STATUS_WEIGHTS = [0.7, 0.22, 0.08]

DESC_NOISE_PREFIX = ["", "IND.", "SPARE-", "STORES ITEM ", ""]
DESC_ABBR = {
    "Gate Valve": ["GV", "GATE VLV"],
    "Ball Valve": ["BV", "BALL VLV"],
    "Ball Bearing": ["BRG BALL", "BALL BRG"],
    "Roller Bearing": ["BRG ROLLER", "ROLLER BRG"],
    "Hex Bolt": ["BOLT HEX", "HX BOLT"],
    "Centrifugal Pump": ["PUMP CENTRIF", "CENT. PUMP"],
    "Seamless Pipe": ["PIPE SMLS", "SMLS PIPE"],
}


def random_date(start="2024-01-01", end="2025-12-31"):
    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    delta = (end_d - start_d).days
    return (start_d + timedelta(days=random.randint(0, delta))).isoformat()


def build_description(mtype, category, grade, size, extra_tag=""):
    """Builds a realistic, slightly noisy material description."""
    abbr_pool = DESC_ABBR.get(mtype, [mtype.upper()])
    base_name = random.choice([mtype, random.choice(abbr_pool)])
    prefix = random.choice(DESC_NOISE_PREFIX)

    order_variants = [
        f"{prefix}{base_name} {size} {grade} {extra_tag}".strip(),
        f"{prefix}{base_name}, {grade}, SIZE {size} {extra_tag}".strip(),
        f"{prefix}{size} {base_name} - {grade} {extra_tag}".strip(),
        f"{prefix}{base_name} {extra_tag} {grade} {size}".strip(),
    ]
    desc = random.choice(order_variants)
    desc = " ".join(desc.split())  # collapse extra spaces
    return desc


def make_manufacturer_part_no(manufacturer, mtype, size):
    manu_abbr = "".join([w[:3].upper() for w in manufacturer.split()])[:6]
    type_abbr = "".join([w[0] for w in mtype.split()]).upper()
    size_clean = str(size).replace(" ", "").replace("/", "-")
    return f"{manu_abbr}-{type_abbr}-{size_clean}-{random.randint(1, 99):02d}"


def length_diameter_coating(category, size):
    """Returns (length, diameter, coating) - some fields left empty depending on category."""
    length, diameter, coating = "", "", ""
    if category == "Pipes & Fittings":
        length = random.choice(["1000 mm", "3 m", "6 m", "12 m", ""])
        diameter = size if random.random() < 0.6 else f"{random.choice([25,50,80,100,150,200])} mm"
        coating = random.choice(COATINGS)
    elif category == "Electrical":
        length = random.choice(["100 m", "500 m", "1000 m", ""])
        coating = ""
    elif category in ("Valves", "Pumps", "Seals"):
        diameter = size if random.random() < 0.5 else ""
        coating = random.choice(COATINGS) if random.random() < 0.4 else ""
    elif category == "Bearings":
        coating = ""
    elif category == "Fasteners":
        length = size.split(" x ")[-1] + " mm" if " x " in size else ""
        coating = random.choice(["Zinc Plated", "None", ""])
    return length, diameter, coating


def price_for(category):
    """Base price ranges roughly scaled by category, clipped to 250-150000."""
    ranges = {
        "Valves": (2000, 90000),
        "Bearings": (500, 25000),
        "Fasteners": (250, 3000),
        "Pumps": (15000, 150000),
        "Pipes & Fittings": (800, 60000),
        "Electrical": (1500, 120000),
        "Instrumentation": (3000, 95000),
        "Seals": (400, 20000),
    }
    lo, hi = ranges[category]
    return round(np.random.uniform(lo, hi), 2)


def build_item_core():
    """Generate the core attributes of a material item (category-driven)."""
    category = random.choice(CATEGORIES)
    mtype = random.choice(TYPES_BY_CATEGORY[category])
    spec = random.choice(SPECS_BY_CATEGORY[category])
    grade = random.choice(GRADES_BY_CATEGORY[category])
    size = random.choice(SIZES_BY_CATEGORY[category])
    unit = UNIT_BY_CATEGORY[category]
    if category in KG_ELIGIBLE and random.random() < 0.25:
        unit = "KG"
    length, diameter, coating = length_diameter_coating(category, size)
    base_price = price_for(category)
    manufacturer = random.choice(MANUFACTURERS_BY_CATEGORY[category])
    return {
        "Category": category,
        "Type": mtype,
        "Specification": spec,
        "Grade": grade,
        "Size": size,
        "Length": length,
        "Diameter": diameter,
        "Coating": coating,
        "Unit": unit,
        "Manufacturer": manufacturer,
        "BasePrice": base_price,
    }


def domain_specific_item(cpse):
    """Standalone items unique to a given CPSE's core business."""
    domain_pool = {
        "ONGC": [("Instrumentation", "Subsea Wellhead Sensor", "API 6A", "SS316", "5000 psi"),
                 ("Valves", "Christmas Tree Valve", "API 6A", "ASTM A182 F22", "2 in"),
                 ("Pumps", "Mud Pump Liner", "API 7K", "Alloy Steel", "6 in")],
        "IOCL": [("Instrumentation", "Refinery Flare Sensor", "API 537", "SS316", "1/2 in NPT"),
                 ("Valves", "Coker Slide Valve", "API 599", "ASTM A217 C5", "4 in")],
        "HPCL": [("Pumps", "LPG Bottling Pump", "API 675", "Carbon Steel", "DN 80"),
                 ("Instrumentation", "Tank Farm Level Gauge", "API 2350", "SS304", "0-20 m")],
        "NTPC": [("Electrical", "Boiler Feed Pump Motor", "IS 12615", "Copper Wound", "6.6 kV"),
                 ("Instrumentation", "Coal Bunker Level Switch", "IEC 60529", "SS316", "0-15 m")],
        "SAIL": [("Pipes & Fittings", "Blast Furnace Tuyere", "IS 2062", "Copper Alloy", "DN 200"),
                 ("Electrical", "Rolling Mill Drive Motor", "IS 12615", "Copper Wound", "11 kV")],
        "Coal India": [("Fasteners", "Coal Cutter Pick", "IS 4772", "Tungsten Carbide", "M20"),
                        ("Pumps", "Mine Dewatering Pump", "IS 5120", "Cast Iron", "DN 150")],
        "NMDC": [("Fasteners", "Ore Crusher Hammer", "IS 4772", "Manganese Steel", "M24 x 100"),
                 ("Pipes & Fittings", "Conveyor Idler Roller", "IS 8598", "Carbon Steel", "DN 100")],
        "BHEL": [("Electrical", "Turbine Generator Stator Coil", "IS 12066", "Copper", "11 kV"),
                 ("Valves", "Steam Turbine Control Valve", "ASME B16.34", "ASTM A217 WC6", "6 in")],
    }
    category, mtype, spec, grade, size = random.choice(domain_pool[cpse])
    unit = UNIT_BY_CATEGORY[category]
    length, diameter, coating = length_diameter_coating(category, size)
    base_price = price_for(category)
    manufacturer = random.choice(MANUFACTURERS_BY_CATEGORY.get(category, ["Bharat Heavy Electricals"]))
    return {
        "Category": category,
        "Type": mtype,
        "Specification": spec,
        "Grade": grade,
        "Size": size,
        "Length": length,
        "Diameter": diameter,
        "Coating": coating,
        "Unit": unit,
        "Manufacturer": manufacturer,
        "BasePrice": base_price,
    }


# ----------------------------------------------------------------------
# Row assembly
# ----------------------------------------------------------------------
code_counters = {c: CODE_START[c] for c in CPSES}


def next_material_code(cpse):
    code = f"{CODE_PREFIX[cpse]}-{code_counters[cpse]}"
    code_counters[cpse] += 1
    return code


def assemble_row(cpse, core, price_multiplier=1.0):
    category = core["Category"]
    sector = SECTOR_MAP[cpse]
    plant = random.choice(PLANTS[cpse])
    manufacturer = core["Manufacturer"]
    size = core["Size"]
    part_no = make_manufacturer_part_no(manufacturer, core["Type"], size)
    description = build_description(core["Type"], category, core["Grade"], size)
    price = round(min(max(core["BasePrice"] * price_multiplier, 250.0), 150000.0), 2)
    row = {
        "CPSE": cpse,
        "Sector": sector,
        "Material_Code": next_material_code(cpse),
        "Material_Description": description,
        "Material_Category": category,
        "Material_Type": core["Type"],
        "Specification": core["Specification"],
        "Material_Grade": core["Grade"],
        "Size": size,
        "Length": core["Length"],
        "Diameter": core["Diameter"],
        "Coating": core["Coating"],
        "Unit": core["Unit"],
        "Manufacturer": manufacturer,
        "Manufacturer_Part_No": part_no,
        "Plant": plant,
        "Material_Status": random.choices(STATUS_CHOICES, weights=STATUS_WEIGHTS)[0],
        "Annual_Consumption": random.randint(50, 15000),
        "Last_Purchase_Date": random_date(),
        "Unit_Price_INR": price,
    }
    return row


def generate_dataset(output_path: str = "data/raw/CPSE_Material_Master_cleaned.csv"):
    TOTAL_ROWS = 2200
    N_COMMON = int(TOTAL_ROWS * 0.40)      # ~880
    N_AMBIGUOUS = int(TOTAL_ROWS * 0.30)   # ~660
    N_STANDALONE = TOTAL_ROWS - N_COMMON - N_AMBIGUOUS  # remainder ~660

    rows = []

    target_per_cpse = TOTAL_ROWS // len(CPSES)
    remaining_capacity = {c: target_per_cpse for c in CPSES}
    leftover = TOTAL_ROWS - target_per_cpse * len(CPSES)
    for c in random.sample(CPSES, leftover):
        remaining_capacity[c] += 1

    def pick_cpses(k):
        available = [c for c in CPSES if remaining_capacity[c] > 0]
        if len(available) < k:
            k = len(available)
        weights = [remaining_capacity[c] for c in available]
        chosen = []
        pool = list(zip(available, weights))
        for _ in range(k):
            total = sum(w for _, w in pool)
            if total <= 0:
                break
            r = random.uniform(0, total)
            upto = 0
            for i, (c, w) in enumerate(pool):
                upto += w
                if upto >= r:
                    chosen.append(c)
                    pool.pop(i)
                    break
        return chosen

    # 1) MULTI-CPSE EQUIVALENT ITEMS (40%)
    common_rows_generated = 0
    while common_rows_generated < N_COMMON:
        core = build_item_core()
        k = random.randint(3, min(6, len(CPSES)))
        chosen_cpses = pick_cpses(k)
        if len(chosen_cpses) < 3:
            if sum(remaining_capacity.values()) == 0:
                break
            continue
        for cpse in chosen_cpses:
            if common_rows_generated >= N_COMMON:
                break
            variance = random.uniform(-0.30, 0.30)
            if abs(variance) < 0.10:
                variance = 0.10 if variance >= 0 else -0.10
            multiplier = 1.0 + variance
            row = assemble_row(cpse, core, price_multiplier=multiplier)
            rows.append(row)
            remaining_capacity[cpse] -= 1
            common_rows_generated += 1

    # 2) AMBIGUOUS / HUMAN-REVIEW ITEMS (30%)
    SOFT_VARIANTS = {
        "SS316": "SS304",
        "SS304": "SS316",
        "ASTM A216 WCB": "ASTM A351 CF8M",
        "ASTM A351 CF8M": "ASTM A216 WCB",
        "Grade 8.8": "Grade 10.9",
        "Grade 10.9": "Grade 8.8",
        "Carbon Steel": "Alloy Steel",
        "Alloy Steel": "Carbon Steel",
    }
    RATING_TAGS = ["150#", "300#", "600#"]

    ambiguous_rows_generated = 0
    while ambiguous_rows_generated < N_AMBIGUOUS:
        core = build_item_core()
        pair_cpses = pick_cpses(2)
        if len(pair_cpses) == 0:
            if sum(remaining_capacity.values()) == 0:
                break
            continue

        cpse_a = pair_cpses[0]
        tag_a = random.choice(RATING_TAGS)
        core_a = dict(core)
        row_a = assemble_row(cpse_a, core_a, price_multiplier=random.uniform(0.9, 1.1))
        row_a["Material_Description"] = build_description(
            core_a["Type"], core_a["Category"], core_a["Grade"], core_a["Size"], extra_tag=tag_a
        )
        rows.append(row_a)
        remaining_capacity[cpse_a] -= 1
        ambiguous_rows_generated += 1

        if len(pair_cpses) > 1 and ambiguous_rows_generated < N_AMBIGUOUS:
            cpse_b = pair_cpses[1]
            core_b = dict(core)
            core_b["Grade"] = SOFT_VARIANTS.get(core["Grade"], core["Grade"])
            tag_b = random.choice([t for t in RATING_TAGS if t != tag_a] or RATING_TAGS)
            row_b = assemble_row(cpse_b, core_b, price_multiplier=random.uniform(0.9, 1.1))
            row_b["Material_Description"] = build_description(
                core_b["Type"], core_b["Category"], core_b["Grade"], core_b["Size"], extra_tag=tag_b
            )
            rows.append(row_b)
            remaining_capacity[cpse_b] -= 1
            ambiguous_rows_generated += 1

    # 3) STANDALONE ITEMS (30%)
    standalone_rows_generated = 0
    attempts = 0
    while standalone_rows_generated < N_STANDALONE and attempts < N_STANDALONE * 20:
        attempts += 1
        available = [c for c in CPSES if remaining_capacity[c] > 0]
        if not available:
            break
        cpse = random.choice(available)
        core = domain_specific_item(cpse)
        row = assemble_row(cpse, core, price_multiplier=random.uniform(0.95, 1.05))
        rows.append(row)
        remaining_capacity[cpse] -= 1
        standalone_rows_generated += 1

    # 4) TOP-UP
    for cpse in CPSES:
        while remaining_capacity[cpse] > 0:
            core = build_item_core()
            row = assemble_row(cpse, core, price_multiplier=random.uniform(0.9, 1.1))
            rows.append(row)
            remaining_capacity[cpse] -= 1

    COLUMNS = [
        "CPSE", "Sector", "Material_Code", "Material_Description", "Material_Category",
        "Material_Type", "Specification", "Material_Grade", "Size", "Length", "Diameter",
        "Coating", "Unit", "Manufacturer", "Manufacturer_Part_No", "Plant", "Material_Status",
        "Annual_Consumption", "Last_Purchase_Date", "Unit_Price_INR",
    ]

    df = pd.DataFrame(rows)

    if len(df) > TOTAL_ROWS:
        df = df.sample(n=TOTAL_ROWS, random_state=42).reset_index(drop=True)

    df = df[COLUMNS]
    df["Annual_Consumption"] = df["Annual_Consumption"].astype(int)
    df["Unit_Price_INR"] = df["Unit_Price_INR"].astype(float).round(2)

    dupe_check = df.groupby("CPSE")["Material_Code"].apply(lambda s: s.duplicated().sum()).sum()
    assert dupe_check == 0, f"Found {dupe_check} duplicate Material_Code(s) within a CPSE!"

    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_p, index=False)

    print(f"Saved {len(df)} rows to {out_p}")
    print(df["CPSE"].value_counts())
    print("\nSectors:\n", df["Sector"].value_counts())
    print("Duplicate Material_Code within CPSE:", dupe_check)
    return out_p


if __name__ == "__main__":
    generate_dataset()
