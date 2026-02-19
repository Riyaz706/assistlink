# Project Architecture Overview

This project has been reorganized into a **Production-Ready** structure following industry best practices for scalability, security, and clear separation of concerns.

## Directory Structure

```text
ASSISTLINKFINAL-main/
├── backend/            # Python FastAPI backend
│   ├── app/            # Core application logic (routes, models, services)
│   ├── scripts/        # Utility and maintenance scripts
│   ├── tests/          # Automated testing suite
│   ├── legacy/         # Deprecated and monolithic code (for reference)
│   ├── .env            # Backend-specific environment variables
│   └── run.py          # Unified entry point for the API
├── frontend/           # React Native (Expo) application
│   ├── src/            # Source code and components
│   ├── assets/         # Images, fonts, and static resources
│   ├── app.config.js   # Dynamic Expo configuration
│   └── .env            # Frontend-specific environment variables
├── docs/               # Centralized documentation and setup guides
├── render.yaml         # Render.com deployment configuration
├── koyeb.yaml          # Koyeb cloud deployment configuration
└── README.md           # High-level project entry point
```

## Key Architectural Decisions

### 1. Separation of Concerns
By decoupling the `/frontend` and `/backend`, we allow each to scale independently. This prevents dependency leakage and simplifies CI/CD pipelines.

### 2. Centralized Entry Points
- **Backend**: Use `python run.py` from the `/backend` root to start the server. This script uses the modularized `app.main` structure.
- **Frontend**: Use `npm start` from within the `/frontend` directory to launch the Expo development server.

### 3. Organized Scripting
Maintenance scripts (like database seeding) are now isolated in `/backend/scripts`. These should be run as modules (`python -m scripts.seed_test_data`) to maintain correct package context.

### 4. Consolidated Documentation
All onboarding and technical guides have been moved to `/docs` to keep the root directory clean and professional.

### 5. Deployment Readiness
The `render.yaml` and `koyeb.yaml` files have been updated to target the new `/backend` folder as the build root, ensuring seamless cloud deployments.

---
**This project is now production-ready in structure.**
