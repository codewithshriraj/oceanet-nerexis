"""Graph schema definitions for knowledge graph entities and relationships."""

GRAPH_ENTITY_TYPES = [
    "Dataset",
    "Location",
    "Species",
    "Pollutant",
    "Event",
    "Report",
    "Publication",
    "Organization",
    "Sensor",
    "AgentTask",
]

GRAPH_RELATION_TYPES = [
    "contains",
    "measures",
    "impacts",
    "cites",
    "references",
    "originates_from",
    "validates",
    "detects",
    "generates",
    "aggregates",
]
