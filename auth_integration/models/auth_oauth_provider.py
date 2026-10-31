# -*- coding: utf-8 -*-
import urllib.parse
import secrets
import requests
from odoo import models, fields, api, exceptions
import logging

_logger = logging.getLogger(__name__)


class AuthOAuthProvider(models.Model):
    """
    External OAuth2 Identity Provider configuration.
    Supports Authorization Code Flow with PKCE.
    Pre-built support for: Google, GitHub, Microsoft, Facebook, Generic OIDC.
    """
    _name = 'auth.oauth.provider'
    _description = 'OAuth2 Identity Provider'
    _order = 'sequence, name'

    # ── Basic Info ─────────────────────────────────────────────────────────────
    name = fields.Char(string='Provider Name', required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    provider_type = fields.Selection([
        ('google',    'Google'),
        ('github',    'GitHub'),
        ('microsoft', 'Microsoft / Azure AD'),
        ('facebook',  'Facebook'),
        ('linkedin',  'LinkedIn'),
        ('oidc',      'Generic OpenID Connect'),
        ('custom',    'Custom OAuth2'),
    ], string='Provider', required=True, default='custom')

    description = fields.Text(string='Description')
    logo_url = fields.Char(string='Provider Logo URL')

    # ── OAuth2 Credentials ────────────────────────────────────────────────────
    client_id = fields.Char(
        string='Client ID', required=True,
        help='OAuth2 application Client ID from the provider',
    )
    client_secret = fields.Char(
        string='Client Secret', required=True,
        groups='base.group_system',
        help='OAuth2 application Client Secret (stored encrypted)',
    )

    # ── Endpoints ─────────────────────────────────────────────────────────────
    authorization_url = fields.Char(
        string='Authorization Endpoint', required=True,
        help='URL where users are redirected to authenticate',
    )
    token_url = fields.Char(
        string='Token Endpoint', required=True,
        help='URL to exchange auth code for access/refresh tokens',
    )
    userinfo_url = fields.Char(
        string='UserInfo Endpoint',
        help='URL to fetch authenticated user profile',
    )
    revoke_url = fields.Char(
        string='Token Revocation Endpoint',
    )
    jwks_url = fields.Char(
        string='JWKS URI',
        help='JSON Web Key Set endpoint for RS256 token verification',
    )

    # ── Configuration ─────────────────────────────────────────────────────────
    scope = fields.Char(
        string='Scopes', default='openid email profile',
        help='Space-separated OAuth2 scopes to request',
    )
    redirect_uri = fields.Char(
        string='Redirect URI',
        help='Must match what is registered in the provider dashboard',
    )
    use_pkce = fields.Boolean(
        string='Use PKCE',
        default=True,
        help='Enable Proof Key for Code Exchange (recommended for SPAs)',
    )
    auto_create_user = fields.Boolean(
        string='Auto-create Odoo User',
        default=True,
        help='Automatically provision an Odoo user on first OAuth login',
    )
    default_group_ids = fields.Many2many(
        'res.groups', string='Default Groups for New Users',
    )
    attribute_mapping = fields.Text(
        string='Attribute Mapping (JSON)',
        default='{"email": "email", "name": "name", "sub": "oauth_uid"}',
        help='JSON mapping of provider field → Odoo user field',
    )

    # ── State ─────────────────────────────────────────────────────────────────
    token_count = fields.Integer(
        string='Tokens Issued',
        compute='_compute_token_count',
    )

    @api.depends()
    def _compute_token_count(self):
        for rec in self:
            rec.token_count = self.env['auth.token'].search_count([
                ('oauth_provider_id', '=', rec.id),
            ])

    # ──────────────────────────────────────────────────────────────────────────
    # Pre-filled presets
    # ──────────────────────────────────────────────────────────────────────────

    @api.onchange('provider_type')
    def _onchange_provider_type(self):
        """Auto-fill standard endpoints when a known provider is selected."""
        presets = {
            'google': {
                'authorization_url': 'https://accounts.google.com/o/oauth2/v2/auth',
                'token_url':         'https://oauth2.googleapis.com/token',
                'userinfo_url':      'https://openidconnect.googleapis.com/v1/userinfo',
                'revoke_url':        'https://oauth2.googleapis.com/revoke',
                'jwks_url':          'https://www.googleapis.com/oauth2/v3/certs',
                'scope':             'openid email profile',
            },
            'github': {
                'authorization_url': 'https://github.com/login/oauth/authorize',
                'token_url':         'https://github.com/login/oauth/access_token',
                'userinfo_url':      'https://api.github.com/user',
                'scope':             'read:user user:email',
            },
            'microsoft': {
                'authorization_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
                'token_url':         'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                'userinfo_url':      'https://graph.microsoft.com/v1.0/me',
                'jwks_url':          'https://login.microsoftonline.com/common/discovery/v2.0/keys',
                'scope':             'openid email profile',
            },
        }
        if self.provider_type in presets:
            for field, value in presets[self.provider_type].items():
                setattr(self, field, value)

    # ──────────────────────────────────────────────────────────────────────────
    # OAuth2 Flow Helpers
    # ──────────────────────────────────────────────────────────────────────────

    def build_authorization_url(self, state=None, code_challenge=None,
                                 code_challenge_method='S256'):
        """
        Build the full authorization URL to redirect the user to.
        Includes state (CSRF protection) and optional PKCE parameters.
        """
        self.ensure_one()
        params = {
            'client_id':     self.client_id,
            'redirect_uri':  self.redirect_uri,
            'response_type': 'code',
            'scope':         self.scope,
            'state':         state or secrets.token_urlsafe(16),
            'access_type':   'offline',
            'prompt':        'consent',
        }
        if self.use_pkce and code_challenge:
            params['code_challenge']        = code_challenge
            params['code_challenge_method'] = code_challenge_method

        url = f"{self.authorization_url}?{urllib.parse.urlencode(params)}"
        return url

    def exchange_code_for_tokens(self, code, code_verifier=None):
        """
        Exchange authorization code for access + refresh tokens.

        :returns: dict with 'access_token', 'refresh_token', 'id_token', etc.
        :raises:  ValidationError on HTTP or provider error
        """
        self.ensure_one()
        data = {
            'client_id':     self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri':  self.redirect_uri,
            'grant_type':    'authorization_code',
            'code':          code,
        }
        if code_verifier:
            data['code_verifier'] = code_verifier

        headers = {'Accept': 'application/json'}
        try:
            resp = requests.post(
                self.token_url, data=data, headers=headers, timeout=15
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise exceptions.ValidationError(
                f"Token exchange failed: {exc}"
            )

        tokens = resp.json()
        if 'error' in tokens:
            raise exceptions.ValidationError(
                f"Provider error: {tokens.get('error_description', tokens['error'])}"
            )
        return tokens

    def fetch_userinfo(self, access_token):
        """Fetch the authenticated user's profile from the provider."""
        self.ensure_one()
        if not self.userinfo_url:
            raise exceptions.ValidationError(
                f"No userinfo URL configured for provider '{self.name}'"
            )
        headers = {'Authorization': f"Bearer {access_token}"}
        try:
            resp = requests.get(self.userinfo_url, headers=headers, timeout=10)
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise exceptions.ValidationError(
                f"UserInfo request failed: {exc}"
            )
        return resp.json()

    def revoke_token(self, token):
        """Revoke an access/refresh token at the provider's revocation endpoint."""
        self.ensure_one()
        if not self.revoke_url:
            _logger.warning(
                'No revoke URL for provider %s; skipping revocation.', self.name
            )
            return
        try:
            requests.post(
                self.revoke_url,
                data={
                    'token':         token,
                    'client_id':     self.client_id,
                    'client_secret': self.client_secret,
                },
                timeout=10,
            )
        except requests.RequestException as exc:
            _logger.error('Token revocation failed: %s', exc)
