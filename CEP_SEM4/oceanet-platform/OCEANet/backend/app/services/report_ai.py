from typing import Any


def report_risk_band(score: int) -> str:
    if score >= 78:
        return "High"
    if score >= 62:
        return "Elevated"
    return "Moderate"


def local_report_ai_lines(region: str, report_type: str, context: dict[str, Any]) -> list[str]:
    risk_band = str(context.get("risk_band") or "Moderate")
    risk_score = int(context.get("risk_score") or 0)
    regional_report_count = int(context.get("regional_report_count") or 0)
    dataset_count = int(context.get("dataset_count") or 0)
    top_sources = context.get("top_sources") or []
    top_source_summary = ", ".join(top_sources[:3]) if top_sources else "approved platform sources"

    first_line = (
        f"{region} currently sits in the {risk_band.lower()} priority band for {report_type.lower()}, "
        f"with a modeled baseline risk score of {risk_score}/100 derived from the active project template and regional monitoring profile."
    )
    second_line = (
        f"The platform context for this report includes {dataset_count:,} datasets and {regional_report_count:,} prior reports for this region, "
        f"giving the narrative a stable operational baseline rather than a one-off snapshot."
    )
    third_line = (
        f"Primary evidence streams informing this brief are {top_source_summary}; recommended cadence is continued monitoring each sync cycle with escalation when anomalies persist across consecutive updates."
    )

    return [first_line, second_line, third_line]
