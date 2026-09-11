"""
Seed database script - Seed database with initial data
"""

import sys
import os

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))

from app.config import settings


def seed_database():
    """
    Seed database with initial data
    """
    # TODO: Implement database seeding
    # - Create tables
    # - Insert reference data
    # - Load dictionary data
    # - Create initial users
    print("Seeding database")
    print("Database seeding not implemented yet")


if __name__ == "__main__":
    seed_database()
