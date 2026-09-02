# Authentication (development)

`POST /api/auth/login` accepts an email and password and returns a one-hour HMAC-SHA256 JWT. Send it as `Authorization: Bearer <token>` to protected endpoints such as `GET /api/auth/me`.

Seeded development users use password `GovDevOnly!2026`:

- `state.admin@example.gov.in` — State Admin
- `police.head@example.gov.in` — Police Department Head (Ahmedabad and Rajkot)

These credentials are development-only and must be replaced before any non-development deployment.
