# -*- coding: utf-8 -*-
"""
REST API endpoints for JWT / API Key authentication.

Base path:  /api/auth/
Endpoints:
    POST /api/auth/login          — Password login → JWT + refresh token
    POST /api/auth/refresh         — Refresh access token
    POST /api/auth/logout          — Invalidate session / tokens
    GET  /api/auth/verify          — Verify a bearer token
    POST /api/auth/api-key/create  — Generate an API key
    GET  /api/auth/me              — Authenticated user profile
    POST /api/auth/mfa/verify      — Verify TOTP code
"""
import json
import logging
from functools import wraps

from odoo import http, exceptions
from odoo.http import request, Response

_logger = logging.getLogger(__name__)

_JSON_HEADERS = {'Content-Type': 'application/json'}


def _json_response(data, status=200):
    """Return a clean JSON HTTP response."""
    return Response(
        json.dumps(data, default=str),
        status=status,
        headers=_JSON_HEADERS,
    )


def _error_response(message, status=400, code=None):
    return _json_response(
        {'success': False, 'error': message, 'code': code or 'error'},
        status=status,
    )


def require_bearer(fn):
    """
    Decorator: extract & validate the Bearer token from the
    Authorization header before entering the route.
    Attaches (payload, token_rec) to request.auth_info.
    """
    @wraps(fn)
    def wrapper(self, *args, **kwargs):
        auth_header = request.httprequest.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return _error_response('Missing or invalid Authorization header', 401, 'unauthorized')

        raw_token = auth_header[7:]
        try:
            payload, token_rec = request.env['auth.token'].sudo().verify_token(raw_token)
        except exceptions.ValidationError as exc:
            # Audit the failure
            request.env['auth.audit.log'].sudo().log_event(
                'permission_denied',
                message=str(exc),
                severity='warning',
                success=False,
                ip=request.httprequest.remote_addr,
                user_agent=request.httprequest.user_agent.string,
            )
            return _error_response(str(exc), 401, 'token_invalid')

        request.auth_info = (payload, token_rec)
        return fn(self, *args, **kwargs)
    return wrapper


class AuthController(http.Controller):

    # ──────────────────────────────────────────────────────────────────────────
    # POST /api/auth/login
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/api/auth/login', type='http', auth='none', methods=['POST'], csrf=False)
    def login(self, **_kwargs):
        """
        Authenticate with email + password.
        Optionally accepts ``otp`` for TOTP / MFA.

        Request body (JSON)::

            {
                "email":    "user@example.com",
                "password": "secret",
                "otp":      "123456"   // optional, required if TOTP enabled
            }

        Response::

            {
                "success": true,
                "access_token": "<jwt>",
                "refresh_token": "<opaque>",
                "token_type": "Bearer",
                "expires_in": 3600,
                "user": { "id": 1, "name": "...", "email": "..." }
            }
        """
        try:
            body = json.loads(request.httprequest.data or '{}')
        except json.JSONDecodeError:
            return _error_response('Invalid JSON body', 400, 'bad_request')

        email    = body.get('email', '').strip()
        password = body.get('password', '')
        otp      = body.get('otp')
        ip       = request.httprequest.remote_addr
        ua       = request.httprequest.user_agent.string

        if not email or not password:
            return _error_response('email and password are required', 400, 'validation_error')

        env = request.env(user=1)  # sudo

        # ── Find User ─────────────────────────────────────────────────────────
        user = env['res.users'].search([
            ('login', '=', email), ('active', '=', True),
        ], limit=1)

        if not user:
            env['auth.audit.log'].log_event(
                'login_fail', message=f"Unknown login: {email}",
                severity='warning', success=False, ip=ip, user_agent=ua,
            )
            return _error_response('Invalid credentials', 401, 'invalid_credentials')

        # ── Brute-force Check ─────────────────────────────────────────────────
        if user.is_account_locked():
            env['auth.audit.log'].log_event(
                'login_fail',
                user=user,
                message='Account locked — too many failed attempts',
                severity='error', success=False, ip=ip, user_agent=ua,
            )
            return _error_response(
                f'Account locked until {user.locked_until}', 403, 'account_locked'
            )

        # ── Verify Password ───────────────────────────────────────────────────
        try:
            uid = env['res.users'].authenticate(
                request.db, email, password, {'interactive': False}
            )
        except Exception:
            uid = None

        if not uid:
            user.record_failed_login()
            env['auth.audit.log'].log_event(
                'login_fail', user=user, severity='warning', success=False,
                ip=ip, user_agent=ua, message='Wrong password',
            )
            return _error_response('Invalid credentials', 401, 'invalid_credentials')

        # ── TOTP Verification ─────────────────────────────────────────────────
        mfa_verified = False
        if user.totp_enabled:
            if not otp:
                return _error_response(
                    'OTP required — TOTP is enabled for this account',
                    400, 'otp_required',
                )
            try:
                user.verify_totp(otp)
                mfa_verified = True
            except exceptions.ValidationError as exc:
                env['auth.audit.log'].log_event(
                    'mfa_fail', user=user, severity='warning', success=False,
                    ip=ip, user_agent=ua, message=str(exc),
                )
                return _error_response(str(exc), 401, 'mfa_invalid')

        # ── Issue Tokens ──────────────────────────────────────────────────────
        raw_access, access_rec = env['auth.token'].generate_access_token(
            user, ttl_minutes=60, ip=ip, user_agent=ua,
        )
        raw_refresh, _ = env['auth.token'].generate_refresh_token(
            user, access_token_rec=access_rec, ip=ip, user_agent=ua,
        )

        # ── Create Session ────────────────────────────────────────────────────
        session = env['auth.session'].create_session(
            user, token_rec=access_rec, ip=ip, user_agent=ua,
            auth_method='password', mfa=mfa_verified,
        )

        # ── Reset failure counter ─────────────────────────────────────────────
        user.reset_failed_login(ip=ip)

        # ── Audit ─────────────────────────────────────────────────────────────
        env['auth.audit.log'].log_event(
            'login_success', user=user, token=access_rec, session=session,
            ip=ip, user_agent=ua, success=True,
        )

        return _json_response({
            'success':       True,
            'access_token':  raw_access,
            'refresh_token': raw_refresh,
            'token_type':    'Bearer',
            'expires_in':    3600,
            'user': {
                'id':    user.id,
                'name':  user.name,
                'email': user.login,
            },
        })

    # ──────────────────────────────────────────────────────────────────────────
    # POST /api/auth/refresh
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/api/auth/refresh', type='http', auth='none', methods=['POST'], csrf=False)
    def refresh(self, **_kwargs):
        """
        Exchange a refresh token for a new access token (token rotation).

        Body: ``{"refresh_token": "<opaque>"}``
        """
        import hashlib
        try:
            body = json.loads(request.httprequest.data or '{}')
        except json.JSONDecodeError:
            return _error_response('Invalid JSON', 400)

        raw_refresh = body.get('refresh_token', '').strip()
        if not raw_refresh:
            return _error_response('refresh_token is required', 400)

        env  = request.env(user=1)
        ip   = request.httprequest.remote_addr
        ua   = request.httprequest.user_agent.string
        h    = hashlib.sha256(raw_refresh.encode()).hexdigest()

        refresh_rec = env['auth.token'].search([
            ('token_hash', '=', h),
            ('token_type', '=', 'refresh'),
            ('state', '=', 'active'),
        ], limit=1)

        if not refresh_rec or refresh_rec.is_expired:
            return _error_response('Invalid or expired refresh token', 401, 'token_invalid')

        # Rotate: revoke old refresh token
        refresh_rec.action_revoke(reason='Token rotation — new refresh issued')

        user = refresh_rec.user_id
        raw_access, access_rec = env['auth.token'].generate_access_token(
            user, ip=ip, user_agent=ua,
        )
        raw_new_refresh, _ = env['auth.token'].generate_refresh_token(
            user, access_token_rec=access_rec, ip=ip, user_agent=ua,
        )

        env['auth.audit.log'].log_event(
            'token_refresh', user=user, token=access_rec, ip=ip, user_agent=ua,
        )

        return _json_response({
            'success':       True,
            'access_token':  raw_access,
            'refresh_token': raw_new_refresh,
            'token_type':    'Bearer',
            'expires_in':    3600,
        })

    # ──────────────────────────────────────────────────────────────────────────
    # POST /api/auth/logout
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/api/auth/logout', type='http', auth='none', methods=['POST'], csrf=False)
    @require_bearer
    def logout(self, **_kwargs):
        payload, token_rec = request.auth_info
        env = request.env(user=1)
        ip  = request.httprequest.remote_addr
        ua  = request.httprequest.user_agent.string

        session = env['auth.session'].search([
            ('token_id', '=', token_rec.id), ('state', '=', 'active'),
        ], limit=1)
        if session:
            session.action_logout()

        token_rec.action_revoke(reason='User logout')

        env['auth.audit.log'].log_event(
            'logout', user=token_rec.user_id, token=token_rec,
            session=session, ip=ip, user_agent=ua,
        )
        return _json_response({'success': True, 'message': 'Logged out successfully.'})

    # ──────────────────────────────────────────────────────────────────────────
    # GET /api/auth/verify
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/api/auth/verify', type='http', auth='none', methods=['GET'], csrf=False)
    @require_bearer
    def verify(self, **_kwargs):
        payload, token_rec = request.auth_info
        return _json_response({
            'success': True,
            'valid':   True,
            'payload': payload,
            'token': {
                'jti':        token_rec.jti,
                'scopes':     token_rec.scopes,
                'expires_at': str(token_rec.expires_at),
            },
        })

    # ──────────────────────────────────────────────────────────────────────────
    # GET /api/auth/me
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/api/auth/me', type='http', auth='none', methods=['GET'], csrf=False)
    @require_bearer
    def me(self, **_kwargs):
        payload, token_rec = request.auth_info
        user = token_rec.user_id
        return _json_response({
            'success': True,
            'user': {
                'id':                  user.id,
                'name':                user.name,
                'email':               user.login,
                'active_sessions':     user.active_session_count,
                'active_tokens':       user.active_token_count,
                'totp_enabled':        user.totp_enabled,
                'last_login_at':       str(user.last_login_at or ''),
                'last_login_ip':       user.last_login_ip or '',
            },
        })

    # ──────────────────────────────────────────────────────────────────────────
    # POST /api/auth/api-key/create
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/api/auth/api-key/create', type='http', auth='none', methods=['POST'], csrf=False)
    @require_bearer
    def create_api_key(self, **_kwargs):
        payload, token_rec = request.auth_info
        try:
            body = json.loads(request.httprequest.data or '{}')
        except json.JSONDecodeError:
            return _error_response('Invalid JSON', 400)

        name   = body.get('name', 'API Key')
        scopes = body.get('scopes', 'read')

        raw_key, key_rec = request.env['auth.token'].sudo().generate_api_key(
            token_rec.user_id, name=name, scopes=scopes,
        )
        return _json_response({
            'success':   True,
            'api_key':   raw_key,
            'key_id':    key_rec.id,
            'scopes':    scopes,
            'warning':   'Store this API key securely — it will not be shown again.',
        })

    # ──────────────────────────────────────────────────────────────────────────
    # POST /api/auth/mfa/verify
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/api/auth/mfa/verify', type='http', auth='none', methods=['POST'], csrf=False)
    @require_bearer
    def mfa_verify(self, **_kwargs):
        payload, token_rec = request.auth_info
        try:
            body = json.loads(request.httprequest.data or '{}')
        except json.JSONDecodeError:
            return _error_response('Invalid JSON', 400)

        otp = body.get('otp', '').strip()
        if not otp:
            return _error_response('otp is required', 400)

        user = token_rec.user_id
        try:
            user.verify_totp(otp)
        except exceptions.ValidationError as exc:
            return _error_response(str(exc), 401, 'mfa_invalid')

        return _json_response({'success': True, 'mfa_verified': True})
