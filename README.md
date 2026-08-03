# OCEANet / Nerexis

OCEANet / Nerexis is a full-stack ocean analytics platform with a Python backend and a Next.js frontend. It includes API services, analytics workflows, autonomous ocean intelligence modules, and supporting documentation for deployment and engineering upgrades.

## What is included

- Backend APIs for health, datasets, metrics, auth, news, analytics, and autonomous agents.
- Frontend app routes and UI components for the platform experience.
- Deployment assets such as Dockerfiles, compose files, and Render configuration.
- Technical documentation, upgrade guides, and testing utilities.

## Quick start

Backend and frontend are separated under `CEP_SEM4/oceanet-platform/OCEANet/`.

```bash
cd CEP_SEM4/oceanet-platform/OCEANet/backend
pip install -r requirements.txt

cd ../frontend
npm install
```

Run the backend and frontend using the project-specific scripts or the Docker compose files in the same folder.

## Notes

- Large generated dataset, report, cache, and upload artifacts are intentionally excluded from GitHub to keep the repository cloneable and easy to share.
- If you need those generated files later, recreate them locally from the application or store them in a separate data repository.

## Repository

Public GitHub repo: https://github.com/codewithshriraj/oceanet-nerexis