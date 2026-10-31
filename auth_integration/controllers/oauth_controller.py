# -*- coding: utf-8 -*-
"""
OAuth2 Authorization Code Flow Controller.

Endpoints:
    GET  /auth/oauth/<int:provider_id>/start    — Redirect user to provider
    GET  /auth/oauth/callback                   — Handle authorization code callback
    GET  /auth/oauth/providers                  — List enabled providers (public)
"""
import json
import secrets
import hashlib
import base64
import logging

from odoo import http, exceptions
from odoo.http import request, Response

_logger = logging.getLogger(__name__)

_JSON_HEADERS = {'Content-Type': 'application/json'}


def _json_response(data, status=200):
    return Response(
        json.dumps(data, default=str), status=status, headers=_JSON_HEADERS,
    )


def _error_response(msg, status=400, code='error'):
    return _json_response({'success': False, 'error': msg, 'code': code}, status)


class OAuthController(http.Controller):

    # ──────────────────────────────────────────────────────────────────────────
    # GET /auth/oauth/providers
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/auth/oauth/providers', type='http', auth='none', methods=['GET'], csrf=False)
    def list_providers(self, **_kwargs):
        """Return a list of active OAuth providers for the login page."""
        providers = request.env['auth.oauth.provider'].sudo().search([
            ('active', '=', True)
        ])
        data = [{
            'id':           p.id,
            'name':         p.name,
            'provider_type': p.provider_type,
            'logo_url':     p.logo_url or '',
            'start_url':    f'/auth/oauth/{p.id}/start',
        } for p in providers]
        return _json_response({'success': True, 'providers': data})

    # ──────────────────────────────────────────────────────────────────────────
    # GET /auth/oauth/<int:provider_id>/start
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/auth/oauth/<int:provider_id>/start', type='http', auth='none',
                methods=['GET'], csrf=False)
    def oauth_start(self, provider_id, **_kwargs):
        """
        Begin OAuth2 Authorization Code flow.
        Generates PKCE code_verifier + code_challenge and stores in session.
        Redirects user to provider's authorization URL.
        """
        env = request.env(user=1)
        provider = env['auth.oauth.provider'].browse(provider_id)

        if not provider.exists() or not provider.active:
            return _error_response('Provider not found or inactive', 404, 'not_found')

        ip = request.httprequest.remote_addr
        ua = request.httprequest.user_agent.string

        # PKCE: code_verifier (random) → code_challenge (S256 hash)
        code_verifier   = secrets.token_urlsafe(64)
        code_challenge  = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode()).digest()
        ).rstrip(b'=').decode()

        # CSRF state
        state = secrets.token_urlsafe(16)

        # Persist in Odoo session
        request.session['oauth_state']         = state
        request.session['oauth_provider_id']   = provider_id
        request.session['oauth_code_verifier'] = code_verifier

        auth_url = provider.build_authorization_url(
            state=state,
            code_challenge=code_challenge,
        )

        env['auth.audit.log'].log_event(
            'oauth_start', provider=provider, ip=ip, user_agent=ua,
            message=f'OAuth flow started → {provider.name}',
        )

        return request.redirect(auth_url)

    # ──────────────────────────────────────────────────────────────────────────
    # GET /auth/oauth/callback
    # ──────────────────────────────────────────────────────────────────────────

    @http.route('/auth/oauth/callback', type='http', auth='none',
                methods=['GET'], csrf=False)
    def oauth_callback(self, code=None, state=None, error=None, **_kwargs):
        """
        Handle the authorization code callback from the provider.
        Exchange code for tokens, fetch user info, and log the user in.
        """
        env = request.env(user=1)
        ip  = request.httprequest.remote_addr
        ua  = request.httprequest.user_agent.string

        # ── Error from provider ───────────────────────────────────────────────
        if error:
            env['auth.audit.log'].log_event(
                'oauth_fail', message=f'Provider returned error: {error}',
                severity='error', success=False, ip=ip, user_agent=ua,
            )
            return _error_response(f'OAuth provider error: {error}', 400, 'oauth_error')

        # ── CSRF State Validation ─────────────────────────────────────────────
        session_state = request.session.get('oauth_state')
        if not state or state != session_state:
            env['auth.audit.log'].log_event(
                'oauth_fail', message='CSRF state mismatch',
                severity='critical', success=False, ip=ip, user_agent=ua,
            )
            return _error_response('Invalid OAuth state — possible CSRF attack', 403, 'csrf_error')

        provider_id    = request.session.get('oauth_provider_id')
        code_verifier  = request.session.get('oauth_code_verifier')

        if not provider_id or not code:
            return _error_response('Missing provider or code', 400)

        provider = env['auth.oauth.provider'].browse(provider_id)
        if not provider.exists():
            return _error_response('Provider not found', 404)

        # ── Exchange Code for Tokens ──────────────────────────────────────────
        try:
            tokens = provider.exchange_code_for_tokens(code, code_verifier)
        except exceptions.ValidationError as exc:
            env['auth.audit.log'].log_event(
                'oauth_fail', provider=provider, message=str(exc),
                severity='error', success=False, ip=ip, user_agent=ua,
            )
            return _error_response(str(exc), 502, 'token_exchange_failed')

        provider_access_token = tokens.get('access_token', '')

        # ── Fetch User Info ───────────────────────────────────────────────────
        try:
            userinfo = provider.fetch_userinfo(provider_access_token)
        except exceptions.ValidationError as exc:
            return _error_response(str(exc), 502, 'userinfo_failed')

        email   = userinfo.get('email') or userinfo.get('login')
        name    = userinfo.get('name') or userinfo.get('login', 'OAuth User')
        sub_uid = str(userinfo.get('sub') or userinfo.get('id', ''))

        if not email:
            return _error_response(
                'Provider did not return an email address. '
                'Ensure the "email" scope is requested.',
                502, 'missing_email',
            )

        # ── Find or Create Odoo User ──────────────────────────────────────────
        user = env['res.users'].search([('login', '=', email)], limit=1)

        if not user and provider.auto_create_user:
            user = env['res.users'].create({
                'name':              name,
                'login':             email,
                'oauth_uid':         sub_uid,
                'oauth_provider_id': provider.id,
                'groups_id':         [(4, g.id) for g in provider.default_group_ids],
            })
            _logger.info('Auto-provisioned OAuth user: %s', email)
        elif not user:
            return _error_response(
                f'No Odoo account found for {email}. '
                'Contact your administrator.',
                403, 'user_not_found',
            )
        else:
            # Update OAuth metadata
            user.write({
                'oauth_uid':              sub_uid,
                'oauth_provider_id':      provider.id,
                'oauth_access_token':     provider_access_token,
            })

        # ── Issue Odoo JWT ────────────────────────────────────────────────────
        raw_access, access_rec = env['auth.token'].generate_access_token(
            user, ip=ip, user_agent=ua, provider=provider,
        )
        raw_refresh, _ = env['auth.token'].generate_refresh_token(
            user, access_token_rec=access_rec, ip=ip, user_agent=ua,
        )
        session = env['auth.session'].create_session(
            user, token_rec=access_rec, ip=ip, user_agent=ua,
            auth_method='oauth2',
        )

        # Clean up session state
        for k in ('oauth_state', 'oauth_provider_id', 'oauth_code_verifier'):
            request.session.pop(k, None)

        env['auth.audit.log'].log_event(
            'oauth_success', user=user, provider=provider,
            token=access_rec, session=session, ip=ip, user_agent=ua,
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
