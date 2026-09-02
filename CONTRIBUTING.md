# Contributing to Gujarat Sentinel Video Intelligence Platform (GPH-2026)

Thank you for your interest in contributing to the **Gujarat Government Sentinel Video Intelligence Platform**.

---

## 🚀 Development Workflow & Standards

### 1. Branching Strategy
- `main`: Production-ready code.
- `feature/<short-description>`: New features or UI components.
- `fix/<issue-description>`: Bug fixes or security patches.

### 2. Local Setup & Testing
Before submitting a Pull Request, ensure that all tests and build steps pass:

```bash
# 1. Run backend tests
cd backend
npm test

# 2. Test frontend production build
cd ../frontend
npm run build
```

### 3. Pull Request Guidelines
- Ensure PRs are focused and describe the rationale behind architectural changes.
- Do not commit secrets (`.env`), database credentials, or large binary files.
- Follow existing codebase style conventions and document new REST endpoints or database migration scripts.

---

## 🔒 Security Vulnerability Reporting

If you discover a security vulnerability, please do **NOT** open a public issue. Email security concerns directly to the maintainers or report via official government channels.
