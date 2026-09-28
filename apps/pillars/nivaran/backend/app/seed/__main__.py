"""
CLI Entrypoint for NIVARAN Master Data Seeding.

Usage:
    python -m app.seed
"""

import sys
from app.core.config import settings
from app.seed.seeder import seed_master_data


def main() -> None:
    print("=" * 60)
    print("NIVARAN Pillar - Institutional Master Data Seeder")
    print(f"Service: {settings.SERVICE_NAME} | Environment: {settings.ENVIRONMENT}")
    print("=" * 60)

    try:
        summary = seed_master_data()
        print("\nMaster Data Seed Completed Successfully:")
        print(f"  Subject Clusters:       {summary['subject_clusters']}")
        print(f"  Subjects:               {summary['subjects']}")
        print(f"  Grievance Clusters:     {summary['grievance_clusters']}")
        print(f"  Categories:             {summary['categories']}")
        print(f"  Resolved Authorities:   {summary['resolved_authorities']}")

        unresolved = summary.get("unresolved_authorities", [])
        if unresolved:
            print(f"  Unresolved Authorities: {len(unresolved)}")
            for item in unresolved:
                print(f"    - {item}")
        else:
            print("  Unresolved Authorities: 0")

        print("=" * 60)
    except Exception as e:
        print(f"\n[ERROR] Seeding failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
