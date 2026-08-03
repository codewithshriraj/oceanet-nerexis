# OCEANet / Nerexis Platform — Verified Technical Documentation

This document is grounded in the repository contents that are present in this workspace as of 2026-07-28. It describes the implementation that is actually wired into the codebase, configuration files, and route definitions rather than assuming features that are only described in prose or planning notes.

---

## 1. Executive Summary

OCEANet (also presented as Nerexis in the frontend) is a full-stack environmental intelligence platform for marine, climate, biodiversity, and ecosystem monitoring. The codebase is implemented as a modular FastAPI backend plus a Next.js frontend, with support for SQLite in local development and PostgreSQL in containerized deployment.

The repository clearly contains:
- a FastAPI application entrypoint with multiple router modules
- JWT-based authentication and role-based authorization helpers
- dataset upload, validation, deduplication, and integrity tracking
- report generation and analytics endpoints
- a DATIE-style trust-scoring subsystem for dataset/report authenticity
- autonomy and AI-oriented modules for research assistance, forecasting, event detection, digital twins, and scientific reporting
- an ML workspace exposing multiple model-analysis jobs backed by scikit-learn
- a Docker Compose deployment topology with backend, frontend, Postgres, Redis, and Adminer

The system is best understood as a modular monolith: the backend is one application with many route modules, while the frontend is a route-based Next.js experience.

---

## 2. Repository Evidence and Source-of-Truth Files

The following files are the most important evidence points for the implementation described here:

- Backend entrypoint: backend/app/main.py
- Backend router modules: backend/app/routers/
- Core configuration: backend/app/core/config.py
- Authentication implementation: backend/app/routers/auth_v1.py and backend/app/core/jwt_handler.py
- DATIE implementation: backend/app/validators/datie.py
- Dataset integrity and fake-data detection: backend/app/dataset_validator.py
- Autonomy features: backend/app/routers/autonomy.py and backend/app/autonomy/
- Frontend entrypoint and routes: frontend/src/app/
- Frontend API transport layer: frontend/src/utils/api.ts
- Deployment configuration: docker-compose.yml
- Python dependencies: backend/requirements.txt

---

## 3. System Architecture

### 3.1 High-Level Components

The platform is composed of four layers:

1. Presentation layer
   - Next.js + React + TypeScript frontend
   - App Router structure under frontend/src/app
   - UI pages for dashboard, analytics, reports, biodiversity, data manager, AI assistant, and supporting informational pages

2. API layer
   - FastAPI backend exposed at the application root and routed through multiple modules
   - Router modules include health, auth, datasets, reports, analytics, DATIE, news, metrics, autonomy, graph, and RAG

3. Data layer
   - SQLite database by default for local development
   - PostgreSQL support for containerized deployments
   - File-based storage under backend/data for datasets and reports
   - Additional in-memory or transient state for authentication/session-like flows and ML job state

4. Intelligence layer
   - DATIE scoring engine
   - dataset validator and duplicate detection system
   - ML workspace with scikit-learn jobs such as Isolation Forest, Gradient Boosting, PCA, DBSCAN, Logistic Regression, and SVR
   - autonomy helpers for research, forecast, event detection, digital twin simulation, and scientific reporting

### 3.2 Runtime Flow

A typical request path looks like this:

1. The frontend calls an API endpoint through the shared API utility.
2. The FastAPI backend receives the request and routes it to the appropriate router module.
3. The backend reads or writes to the database and/or file storage.
4. The response is returned to the frontend, which presents the data in pages and components.

The primary backend entrypoint wires the routers together at startup and initializes database and refresh logic.

---

## 4. Backend Architecture

### 4.1 Backend Framework and Runtime

The backend is implemented in Python and uses:
- FastAPI for the web API
- Uvicorn/Gunicorn-style runtime patterns in deployment and startup configuration
- SQLAlchemy and Alembic for database access and migrations
- Pydantic models for request/response validation
- JWT-based auth helpers
- Prometheus-style metrics exposure and optional OpenTelemetry instrumentation

The backend is started from the FastAPI application object created in backend/app/main.py.

### 4.2 Router Structure

The backend uses a router-based modular layout under backend/app/routers. The visible modules include:

- health: health and basic availability endpoints
- auth_v1: JWT signup/signin/refresh/me/logout/change-password endpoints
- datasets: dataset upload, validation, refresh, archive, ingest, and status workflows
- reports: report listing, generation, download, share, and sync logic
- analytics: dashboard and analytics summaries plus ML workspace export endpoints
- datie: DATIE trust score and research-related endpoints
- autonomy: research copilot, forecast, events, agents, memory, scientific report, KG, digital twin
- graph: graph-related functionality
- rag: retrieval-augmented generation related endpoints
- news: news summary/article helpers
- metrics: Prometheus-compatible /metrics endpoint

### 4.3 Main Backend Entry Point

The application object is created in backend/app/main.py and includes the routers at startup. The code also:
- initializes the database
- backfills dataset integrity metadata
- applies startup refresh scheduling logic
- attaches CORS middleware and request logging middleware
- registers metrics and telemetry hooks

The app also exposes a large number of legacy endpoints under /_legacy, which the frontend frequently uses as a compatibility layer.

---

## 5. Authentication and Authorization

### 5.1 Authentication Mechanism

Authentication is implemented through JWT tokens.

The implementation is present in:
- backend/app/routers/auth_v1.py
- backend/app/core/jwt_handler.py

Supported flows include:
- signup
- signin
- refresh token rotation
- /me to inspect current user
- logout
- change-password

Tokens are signed with HS256 using a secret configured through environment variables. The default secret in code is a development placeholder.

### 5.2 Storage Model

The auth router uses an in-memory user store for development. That is explicitly noted in the source file. In other words, user registration and sign-in state are not backed by a relational database in the observed implementation.

### 5.3 Authorization Helpers

The JWT helper module includes an RBAC-style permission dependency helper that can enforce roles and scopes. The code supports role-based checks such as admin/user distinctions.

---

## 6. Data Management and Storage

### 6.1 Database Configuration

Configuration is driven through the settings object in backend/app/core/config.py.

The observed defaults are:
- SQLite by default
- PostgreSQL when OCEANET_DB_TYPE=postgres and related environment variables are set
- data root configurable through OCEANET_DATA_ROOT

### 6.2 File Storage

The application writes datasets and reports to filesystem paths under the configured data root. The storage layout is organized as:
- data/datasets
- data/reports

This is used alongside the database records that reference the stored artifacts.

### 6.3 Dataset Validation and Deduplication

The dataset validation pipeline is implemented in backend/app/dataset_validator.py.

It includes:
- structural validation for CSV/JSON/text/archive/container contents
- thresholds for minimum rows/columns and null ratios
- detection of fake or synthetic-looking content through regex-based patterns
- allowlist-based verified-source handling
- content hash generation and semantic hash generation for duplicate detection
- support for archive/container file inspection

This is a meaningful integrity layer and is referenced by the DATIE scoring engine.

---

## 7. DATIE: Dataset Authenticity and Trust Intelligence Engine

### 7.1 Purpose

The DATIE subsystem is implemented in backend/app/validators/datie.py. It is designed to produce an authenticity and trust score across several weighted dimensions:
- source trust
- content quality
- duplicate probability
- freshness
- metadata reliability
- explainability

### 7.2 Scoring Model

The validator computes a final score and also returns:
- score banding
- feature importance explanations
- detailed explanations
- formulas for transparency
- evidence attached to the result

The implementation is not a simple single-rule heuristic; it combines multiple features and exposes an explainable breakdown.

### 7.3 Integration

The DATIE subsystem is exposed via the autonomy router as well as a dedicated DATIE router in the main application. The frontend includes a DATIE trust panel component, which indicates that the subsystem is meant to be part of the user-facing trust experience.

---

## 8. AI and ML Capabilities

The project contains a real ML workspace endpoint and multiple model implementations.

### 8.1 ML Workspace

The backend exposes ML workspace endpoints in backend/app/main.py:
- /analytics/ml-workspace
- /analytics/ml-workspace/{model_id}/run
- /analytics/ml-workspace/train-all
- export endpoints for each model result

The implementation uses background worker threads and a job state dictionary to track job status and progress.

### 8.2 Models Implemented in Code

The code contains concrete implementations for these models:

- Random Forest classifier
- K-Means clustering
- Time-series linear regression forecast
- Isolation Forest for anomaly detection
- Gradient Boosting Regressor
- PCA for dimensionality reduction
- DBSCAN for clustering
- Logistic Regression for tier classification
- SVR for tide-level forecasting

The actual model implementations are wired through scikit-learn imports, and the code uses real training/prediction routines rather than being purely stubbed.

### 8.3 Autonomy Features

The autonomy router exposes:
- research copilot query
- DATIE trust breakdown lookups
- forecast prediction
- event detection
- agent execution and planning
- agent memory
- scientific report generation
- knowledge-graph querying (when enabled)
- digital twin simulation

These are implemented through modules in backend/app/autonomy/ and exposed through the FastAPI router.

---

## 9. Frontend Architecture

### 9.1 Frontend Stack

The frontend is a Next.js application using:
- React and TypeScript
- Tailwind CSS
- Framer Motion for UI animation
- Recharts for charting
- Leaflet for mapping
- Zustand-style state handling patterns in the codebase

The package manifest indicates Next.js 16.1.6 and React 18.2.0.

### 9.2 Route Structure

The main app router contains these visible application areas:
- home page
- dashboard
- analytics
- reports
- biodiversity
- data-manager
- API hub
- AI assistant workspace
- digital-twin
- event-detection
- forecast-intelligence
- research-copilot
- scientific-report
- news
- sign-in
- privacy / terms / contact

### 9.3 Frontend-to-Backend Integration

The frontend uses a shared API helper in frontend/src/utils/api.ts. This utility is responsible for:
- resolving the API base URL
- probing localhost ports for backend availability
- retrying requests
- falling back to alternate local ports when needed
- mapping some routes to /_legacy endpoints when the modern route is unavailable

This is an important implementation detail because the frontend is clearly designed to tolerate local backend switching and use compatibility fallbacks.

---

## 10. Deployment and Operations

### 10.1 Docker Compose Topology

The deployment topology in docker-compose.yml defines:
- postgres service
- redis service
- backend service
- frontend service
- adminer service

The backend container:
- builds from backend/Dockerfile
- depends on Postgres health checks
- uses environment variables for PostgreSQL and JWT configuration
- runs Alembic migrations and Uvicorn on startup

The frontend container runs the Next.js development server with port 3000 exposed.

### 10.2 Environment Variables

The codebase uses environment variables such as:
- OCEANET_ENV
- OCEANET_DEBUG
- OCEANET_LOG_LEVEL
- OCEANET_DB_TYPE
- OCEANET_DB_HOST
- OCEANET_DB_PORT
- OCEANET_DB_USER
- OCEANET_DB_PASSWORD
- OCEANET_DB_NAME
- OCEANET_JWT_SECRET
- OCEANET_CORS_ALLOWED_ORIGINS
- OCEANET_DATA_ROOT
- OPENAI_API_KEY
- GEMINI_API_KEY
- OCEANET_AI_PROVIDER
- OCEANET_OTEL_ENABLED
- OCEANET_OTEL_EXPORTER_OTLP_ENDPOINT

### 10.3 Observability

Observability support exists in two forms:
- Prometheus-compatible /metrics endpoint via backend/app/routers/metrics.py
- optional OpenTelemetry instrumentation via backend/app/core/telemetry.py

The code attempts to initialize telemetry only when OpenTelemetry dependencies are available and explicitly enabled.

---

## 11. Notable Implementation Characteristics

### 11.1 Legacy and Modern Coexistence

The repository contains both modern routes and legacy endpoints. The frontend often uses /_legacy routes as compatibility fallbacks. This indicates the platform is evolving and preserving older handlers while new modules are added.

### 11.2 Mixed Stateful and Stateless Design

Some features are fully stateful (for example, the ML worker job state dictionary) while others depend on stateless request handling. Authentication is stateless via JWT, but the user store is in-memory.

### 11.3 Local-First Development Orientation

The default backend configuration is SQLite and the frontend defaults to localhost-based API access. Docker Compose adds a more production-like environment with Postgres and Redis, but the repository still contains strong evidence of local development ergonomics.

---

## 12. Important Limitations and Caveats

The following points are important when interpreting the platform:

- Authentication is currently backed by an in-memory user store rather than a persistent database-backed user table.
- Some features are implemented as legacy routes or compatibility shims rather than new canonical router modules.
- The ML workspace is present and implemented, but its outputs are generated through background workers and heuristic/real-model combinations rather than a formal MLOps pipeline.
- The OpenTelemetry and external AI provider integrations are optional and depend on environment configuration and installed dependencies.
- The repository contains a large amount of implementation, but some modules appear to be partially evolved or hybrid rather than fully standardized.

These caveats matter because they define the current state of the system more accurately than any purely aspirational description.

---

## 13. Bottom Line

OCEANet/Nerexis is a real, working-style environmental intelligence platform with:
- a modern FastAPI backend
- a Next.js frontend
- persistent storage and dataset integrity logic
- a transparent DATIE trust-scoring subsystem
- an actual ML workspace backed by scikit-learn
- Docker-based deployment support

It is best described as a hybrid, modular monolith with strong evidence of production-oriented structure, but with some legacy compatibility layers and development-oriented defaults remaining in place.
