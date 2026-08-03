import atexit
import os
import shutil
import sqlite3
import tempfile
import secrets

from fastapi.testclient import TestClient

_TEST_DATA_ROOT = tempfile.mkdtemp(prefix="nerexis-datie-test-data-")
os.environ["NEREXIS_DATA_ROOT"] = _TEST_DATA_ROOT
os.environ["NEREXIS_ENABLE_BACKGROUND_REFRESH"] = "0"
atexit.register(lambda: shutil.rmtree(_TEST_DATA_ROOT, ignore_errors=True))

from app.main import app, _create_connection, _utc_now_iso  # noqa: E402

client = TestClient(app)


def _seed_dataset_and_report() -> tuple[int, int]:
    os.makedirs(os.path.join(_TEST_DATA_ROOT, "datasets"), exist_ok=True)
    os.makedirs(os.path.join(_TEST_DATA_ROOT, "reports"), exist_ok=True)

    unique_suffix = secrets.token_hex(4)

    dataset_name = f"sample-ocean-{unique_suffix}.csv"
    report_file_name = f"report-1-sample-{unique_suffix}.txt"

    dataset_path = os.path.join(_TEST_DATA_ROOT, "datasets", dataset_name)
    with open(dataset_path, "w", encoding="utf-8") as handle:
        handle.write("latitude,longitude,sst\n10,20,24.1\n11,21,24.3\n12,22,24.4\n13,23,24.5\n")

    report_path = os.path.join(_TEST_DATA_ROOT, "reports", report_file_name)
    with open(report_path, "w", encoding="utf-8") as handle:
        handle.write("# Sample Report\n\nThis is a validated report about coastal monitoring.\n")

    created_at = _utc_now_iso()
    with _create_connection() as conn:
        dataset_cursor = conn.execute(
            """
            INSERT INTO datasets(
                original_name, stored_name, dataset_type, source, mime_type,
                size_bytes, content_hash, semantic_hash, validation_status,
                validation_reason, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_name,
                dataset_name,
                "Oceanographic",
                "noaa",
                "text/csv",
                os.path.getsize(dataset_path),
                "hash-1",
                "semantic-1",
                "APPROVED",
                "Accepted",
                "Stored",
                created_at,
            ),
        )
        dataset_id = int(dataset_cursor.lastrowid)
        report_cursor = conn.execute(
            """
            INSERT INTO reports(
                title, report_type, region, custom_title, include_ai_insights,
                content, status, format, size_kb, created_at, share_token, report_file_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "Sample Report",
                "Ocean Intelligence",
                "North Atlantic",
                "",
                1,
                "# Sample Report\n\nThis is a validated report about coastal monitoring.\n",
                "Generated",
                "TXT",
                1.0,
                created_at,
                None,
                report_file_name,
            ),
        )
        report_id = int(report_cursor.lastrowid)
        conn.commit()
    return dataset_id, report_id


def test_datie_summary_and_registry() -> None:
    dataset_id, report_id = _seed_dataset_and_report()

    summary_response = client.get("/datie/summary")
    assert summary_response.status_code == 200, summary_response.text
    summary_payload = summary_response.json()
    assert summary_payload["total_datasets"] >= 1
    assert "average_authenticity_score" in summary_payload
    assert "model_registry" in summary_payload

    dataset_response = client.get(f"/datie/datasets/{dataset_id}")
    assert dataset_response.status_code == 200, dataset_response.text
    dataset_payload = dataset_response.json()
    assert dataset_payload["entity_type"] == "dataset"
    assert "final_authenticity_score" in dataset_payload
    assert "research" in dataset_payload

    report_response = client.get(f"/datie/reports/{report_id}")
    assert report_response.status_code == 200, report_response.text
    report_payload = report_response.json()
    assert report_payload["entity_type"] == "report"
    assert "score_band" in report_payload


def test_datie_exports_and_research_endpoint() -> None:
    dataset_id, _report_id = _seed_dataset_and_report()

    export_json = client.get(f"/datie/export/dataset/{dataset_id}?format=json")
    assert export_json.status_code == 200, export_json.text
    assert export_json.json()["entity_id"] == dataset_id

    export_md = client.get(f"/datie/export/dataset/{dataset_id}?format=md")
    assert export_md.status_code == 200, export_md.text
    assert "DATIE" in export_md.text

    research_response = client.get("/datie/research")
    assert research_response.status_code == 200, research_response.text
    research_payload = research_response.json()
    assert "research_brief" in research_payload
