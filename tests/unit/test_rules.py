"""
Unit tests for rule definitions and baseline constants
"""

import sys
from pathlib import Path

# Add server directory to path
server_dir = Path(__file__).resolve().parent.parent.parent / "server"
sys.path.insert(0, str(server_dir))

from rules.abbreviation_dictionary import (
    MATERIAL_ABBREVIATIONS,
    UNIT_ABBREVIATIONS,
    SPEC_ABBREVIATIONS,
)


def test_material_abbreviations():
    assert "MS" in MATERIAL_ABBREVIATIONS
    assert MATERIAL_ABBREVIATIONS["MS"] == "Mild Steel"
    assert MATERIAL_ABBREVIATIONS["SS"] == "Stainless Steel"
    assert MATERIAL_ABBREVIATIONS["Cu"] == "Copper"


def test_unit_abbreviations():
    assert "KG" in UNIT_ABBREVIATIONS
    assert UNIT_ABBREVIATIONS["KG"] == "Kilogram"
    assert UNIT_ABBREVIATIONS["MTR"] == "Meter"


def test_spec_abbreviations():
    assert "mm" in SPEC_ABBREVIATIONS
    assert SPEC_ABBREVIATIONS["mm"] == "millimeter"
    assert SPEC_ABBREVIATIONS["thk"] == "thickness"
