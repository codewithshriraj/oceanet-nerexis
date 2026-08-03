"""Knowledge graph integration package for optional Neo4j support."""

from .neo4j_adapter import is_enabled, sync_graph, query_graph
from .schema import GRAPH_ENTITY_TYPES, GRAPH_RELATION_TYPES
