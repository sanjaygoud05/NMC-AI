"""
Pytest configuration and global fixtures for SIH26099
Ensures server/ directory is included in Python module search path.
"""

import sys
from pathlib import Path

# Add server directory to sys.path
server_dir = Path(__file__).parent.parent / "server"
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))
