import sys
import argparse
import json
import logging
from app.core.database import SessionLocal
from app.modules.phd_rag.services.ingestion_service import ingestion_service
from app.modules.phd_rag.services.retrieval_service import PhdRetrievalService
from app.modules.phd_rag.services.llm_service import llm_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def run_audit():
    print("Auditing Ph.D. Admission source documents directory...")
    inventory = ingestion_service.audit_directory()
    print(json.dumps(inventory, indent=2))
    print(f"\nAudit complete. Total authoritative files: {len(inventory)}")


def run_ingest(force: bool = False):
    print(f"Beginning Ph.D. Admission document ingestion (force={force})...")
    with SessionLocal() as db:
        results = ingestion_service.ingest_all(db, force_reingest=force)
        print(json.dumps(results, indent=2))
    print("\nIngestion complete.")


def run_query(query: str):
    print(f"Querying Ph.D. Assistant with: '{query}'\n")
    with SessionLocal() as db:
        retrieval = PhdRetrievalService()
        evidence = retrieval.retrieve(query, db, top_k=5)
        print(f"Retrieved {len(evidence)} evidence chunks:")
        for idx, ev in enumerate(evidence, 1):
            print(f"  [{idx}] {ev.citation_label} (Score: {ev.relevance_score:.3f})")
            print(f"      Snippet: {ev.chunk_text[:120]}...\n")

        response = llm_service.answer_query(query, evidence)
        print("=== ANSWER ===")
        print(response.answer)
        print(f"\nModel: {response.model_used} | Grounded: {response.is_grounded} | Conflict: {response.has_conflict}")
        print("=== CITATIONS ===")
        for c in response.cited_sources:
            print(f"- {c['citation_label']}")


def main():
    parser = argparse.ArgumentParser(description="VYASA Ph.D. RAG CLI")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("audit", help="Audit authoritative files")
    
    ingest_p = subparsers.add_parser("ingest", help="Ingest authoritative documents into PostgreSQL")
    ingest_p.add_argument("--force", action="store_true", help="Force re-ingestion even if checksum matches")

    query_p = subparsers.add_parser("query", help="Query Ph.D. Assistant")
    query_p.add_argument("query_text", type=str, help="Question to ask")

    args = parser.parse_args()

    if args.command == "audit":
        run_audit()
    elif args.command == "ingest":
        run_ingest(force=args.force)
    elif args.command == "query":
        run_query(args.query_text)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
