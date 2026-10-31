# Authentication & Integration — Odoo Hackathon Module

![Odoo 17](https://img.shields.io/badge/Odoo-17.0-875A7B?logo=odoo)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python)
![License](https://img.shields.io/badge/License-LGPL--3-blue)

A production-grade **Authentication & Integration** Odoo 17 module built for the Odoo Hackathon.

---

## ✨ Features

| Category | Capabilities |
|---|---|
| **JWT Tokens** | HS256/RS256 signed access tokens, configurable TTL, blacklisting |
| **Refresh Tokens** | Opaque long-lived tokens with automatic rotation |
| **API Keys** | Non-expiring scoped API keys (`aik_…` prefix) |
| **OAuth2** | Authorization Code Flow with PKCE for Google, GitHub, Microsoft & custom providers |
| **Session Management** | Server-side sessions with device tracking, force-logout, concurrent session limiting |
| **TOTP / MFA** | RFC 6238 TOTP with QR code enrollment via `pyotp` |
| **Brute-Force Protection** | Configurable lockout after N failed attempts |
| **Audit Log** | Immutable, compliance-ready log for all auth events |
| **REST API** | Full JSON REST API for login, refresh, logout, MFA, and API key management |

---

## 📂 Module Structure

```
auth_integration/
├── __manifest__.py
├── __init__.py
├── models/
│   ├── auth_token.py          # JWT + API key + refresh token management
│   ├── auth_session.py        # Server-side session tracking
│   ├── auth_oauth_provider.py # OAuth2 provider configuration
│   ├── auth_audit_log.py      # Immutable audit log
│   └── res_users_ext.py       # TOTP/MFA + brute-force extension
├── controllers/
│   ├── auth_controller.py     # REST: /api/auth/*
│   └── oauth_controller.py    # OAuth2: /auth/oauth/*
├── wizards/
│   └── auth_revoke_wizard.py  # Bulk token revocation wizard
├── views/
│   ├── auth_token_views.xml
│   ├── auth_session_views.xml
│   ├── auth_oauth_views.xml
│   ├── auth_audit_views.xml
│   └── auth_menus.xml
├── security/
│   ├── ir.model.access.csv
│   └── auth_security.xml
└── data/
    └── auth_data.xml          # Cron jobs + system parameters
```

---

## 🚀 REST API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Password login → JWT + refresh token |
| `POST` | `/api/auth/refresh` | Rotate refresh token → new access token |
| `POST` | `/api/auth/logout` | Revoke token and terminate session |
| `GET` | `/api/auth/verify` | Verify bearer token validity |
| `GET` | `/api/auth/me` | Authenticated user profile |
| `POST` | `/api/auth/api-key/create` | Generate scoped API key |
| `POST` | `/api/auth/mfa/verify` | Verify TOTP OTP code |

### OAuth2

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth/oauth/providers` | List active OAuth providers |
| `GET` | `/auth/oauth/<id>/start` | Begin authorization code flow |
| `GET` | `/auth/oauth/callback` | Handle provider callback |

---

## 🔧 Quick Start

### 1. Install dependencies

```bash
pip install PyJWT pyotp qrcode requests
```

### 2. Install the module

```bash
# Add to your Odoo addons path, then:
./odoo-bin -d your_db -i auth_integration
```

### 3. Configure JWT Secret

Go to **Settings → Technical → System Parameters** and update:
- `auth_integration.jwt_secret` — Set a strong 256-bit secret

### 4. Try the Login API

```bash
curl -X POST http://localhost:8069/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin", "password": "admin"}'
```

### 5. Use the token

```bash
curl http://localhost:8069/api/auth/me \
  -H "Authorization: Bearer <your_access_token>"
```

---

## 🔒 Security Architecture

```
Client
  │
  ├─ POST /api/auth/login ──────────────────────────────────────────────────┐
  │         ↓ email + password (+ OTP if TOTP enabled)                       │
  │         ↓ Brute-force check                                               │
  │         ↓ res.users.authenticate()                                        │
  │         ↓ pyotp.TOTP.verify()                                             │
  │         ↓ JWT access token (HS256, 1hr TTL)                               │
  │         ↓ Opaque refresh token (30d TTL)                                  │
  │         ↓ auth.session created                                            │
  │         ← { access_token, refresh_token, user }                          │
  │                                                                           │
  ├─ GET /api/auth/* ──────────────────────────────────────────────────────── │
  │   Authorization: Bearer <access_token>                                    │
  │         ↓ @require_bearer decorator                                       │
  │         ↓ jwt.decode() → payload                                          │
  │         ↓ DB lookup (token_hash, state=active)                            │
  │         ↓ Update last_used_at                                             │
  │         → Authorized                                                      │
  │                                                                           │
  └─ GET /auth/oauth/<id>/start → Provider → /auth/oauth/callback ──────────┘
             PKCE code_verifier + code_challenge (S256)
             CSRF state token in Odoo session
```

---

## 👥 Authors

- **abishek55290** — [github.com/abishek55290](https://github.com/abishek55290)

---

## 📄 License

LGPL-3.0 — see [LICENSE](LICENSE) for details.
