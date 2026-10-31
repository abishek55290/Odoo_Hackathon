# -*- coding: utf-8 -*-
import jwt
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta
from odoo import models, fields, api, exceptions
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
import logging

_logger = logging.getLogger(__name__)


class AuthToken(models.Model):
    """
    JWT / API Token Management.
    Supports:
        - Access tokens  (short-lived, HS256 / RS256)
        - Refresh tokens (long-lived, rotated on each use)
        - API Keys       (non-expiring, scoped)
    """
    _name = 'auth.token'
    _description = 'Authentication Token'
    _order = 'create_date desc'
    _rec_name = 'display_name'

    # ── Core Fields ────────────────────────────────────────────────────────────
    name = fields.Char(
        string='Token Name', required=True, index=True,
        help='Human-readable label for this token (e.g., "Mobile App v2")',
    )
    token_type = fields.Selection([
        ('access',   'Access Token (JWT)'),
        ('refresh',  'Refresh Token'),
        ('api_key',  'API Key'),
    ], string='Type', required=True, default='access', index=True)

    algorithm = fields.Selection([
        ('HS256', 'HMAC SHA-256'),
        ('RS256', 'RSA SHA-256'),
    ], string='Algorithm', default='HS256')

    # ── Identity ───────────────────────────────────────────────────────────────
    user_id = fields.Many2one(
        'res.users', string='User', required=True,
        ondelete='cascade', index=True,
    )
    jti = fields.Char(
        string='JWT ID (jti)', index=True, copy=False,
        default=lambda self: str(uuid.uuid4()),
        help='Unique identifier for this token (used for blacklisting)',
    )

    # ── Token Value ────────────────────────────────────────────────────────────
    token_hash = fields.Char(
        string='Token Hash (SHA-256)', copy=False, readonly=True,
        help='SHA-256 hash of the raw token — never store the raw value in DB',
    )
    scopes = fields.Char(
        string='Scopes',
        default='read',
        help='Space-separated OAuth scopes (e.g., "read write admin")',
    )

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    state = fields.Selection([
        ('active',    'Active'),
        ('expired',   'Expired'),
        ('revoked',   'Revoked'),
        ('blacklisted', 'Blacklisted'),
    ], string='Status', default='active', index=True, required=True)

    expires_at = fields.Datetime(
        string='Expires At',
        help='Leave empty for non-expiring API keys',
    )
    last_used_at = fields.Datetime(string='Last Used', readonly=True)
    revoked_at = fields.Datetime(string='Revoked At', readonly=True)
    revoked_reason = fields.Text(string='Revocation Reason')

    # ── OAuth / Refresh link ───────────────────────────────────────────────────
    refresh_token_id = fields.Many2one(
        'auth.token', string='Parent Refresh Token',
        ondelete='cascade',
        domain=[('token_type', '=', 'refresh')],
    )
    oauth_provider_id = fields.Many2one(
        'auth.oauth.provider', string='OAuth Provider',
    )

    # ── IP / Device ────────────────────────────────────────────────────────────
    issued_ip = fields.Char(string='Issued From IP')
    user_agent = fields.Char(string='User-Agent')

    # ── Computed ───────────────────────────────────────────────────────────────
    display_name = fields.Char(
        compute='_compute_display_name', store=True,
    )
    is_expired = fields.Boolean(
        compute='_compute_is_expired', string='Is Expired',
    )

    # ──────────────────────────────────────────────────────────────────────────
    # Compute Methods
    # ──────────────────────────────────────────────────────────────────────────

    @api.depends('name', 'token_type', 'user_id')
    def _compute_display_name(self):
        for rec in self:
            rec.display_name = f"[{rec.token_type.upper()}] {rec.name} ({rec.user_id.name})"

    @api.depends('expires_at', 'state')
    def _compute_is_expired(self):
        now = fields.Datetime.now()
        for rec in self:
            rec.is_expired = bool(
                rec.expires_at and rec.expires_at < now
            ) or rec.state == 'expired'

    # ──────────────────────────────────────────────────────────────────────────
    # Business Logic
    # ──────────────────────────────────────────────────────────────────────────

    @api.model
    def generate_access_token(self, user, scopes='read', ttl_minutes=60,
                               ip=None, user_agent=None, provider=None,
                               algorithm='HS256'):
        """
        Generate a signed JWT access token for ``user``.

        :param user:        res.users record
        :param scopes:      space-separated scope string
        :param ttl_minutes: expiry window in minutes
        :param ip:          client IP (for audit)
        :param user_agent:  HTTP User-Agent header value
        :param provider:    auth.oauth.provider record (optional)
        :param algorithm:   'HS256' or 'RS256'
        :returns: (raw_token_str, auth.token record)
        """
        secret = self.env['ir.config_parameter'].sudo().get_param(
            'auth_integration.jwt_secret',
            default=self.env['ir.config_parameter'].sudo().get_param(
                'database.secret', default='odoo-secret'
            ),
        )

        now = datetime.utcnow()
        expires = now + timedelta(minutes=ttl_minutes)
        jti = str(uuid.uuid4())

        payload = {
            'iss': 'odoo-auth-integration',
            'sub': str(user.id),
            'aud': 'odoo-api',
            'iat': int(now.timestamp()),
            'exp': int(expires.timestamp()),
            'jti': jti,
            'email': user.login,
            'name': user.name,
            'scopes': scopes,
        }

        raw_token = jwt.encode(payload, secret, algorithm=algorithm)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        token_record = self.create({
            'name': f"Access – {user.name} – {now.strftime('%Y-%m-%d %H:%M')}",
            'token_type': 'access',
            'algorithm': algorithm,
            'user_id': user.id,
            'jti': jti,
            'token_hash': token_hash,
            'scopes': scopes,
            'expires_at': expires,
            'state': 'active',
            'issued_ip': ip,
            'user_agent': user_agent,
            'oauth_provider_id': provider.id if provider else False,
        })

        _logger.info(
            'JWT access token issued | user=%s jti=%s expires=%s',
            user.login, jti, expires,
        )
        return raw_token, token_record

    @api.model
    def generate_refresh_token(self, user, access_token_rec=None,
                                ttl_days=30, ip=None, user_agent=None):
        """
        Generate a long-lived refresh token (opaque, stored as hash).

        :returns: (raw_refresh_str, auth.token record)
        """
        raw = secrets.token_urlsafe(64)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        now = datetime.utcnow()

        rec = self.create({
            'name': f"Refresh – {user.name} – {now.strftime('%Y-%m-%d')}",
            'token_type': 'refresh',
            'user_id': user.id,
            'jti': str(uuid.uuid4()),
            'token_hash': token_hash,
            'expires_at': now + timedelta(days=ttl_days),
            'state': 'active',
            'issued_ip': ip,
            'user_agent': user_agent,
            'refresh_token_id': access_token_rec.id if access_token_rec else False,
        })
        return raw, rec

    @api.model
    def generate_api_key(self, user, name, scopes='read'):
        """Generate a non-expiring scoped API key."""
        raw = f"aik_{secrets.token_urlsafe(40)}"
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        rec = self.create({
            'name': name,
            'token_type': 'api_key',
            'user_id': user.id,
            'jti': str(uuid.uuid4()),
            'token_hash': token_hash,
            'scopes': scopes,
            'state': 'active',
        })
        return raw, rec

    @api.model
    def verify_token(self, raw_token):
        """
        Verify a raw JWT string.

        :raises: ValidationError on failure
        :returns: (payload dict, auth.token record)
        """
        secret = self.env['ir.config_parameter'].sudo().get_param(
            'auth_integration.jwt_secret',
            default=self.env['ir.config_parameter'].sudo().get_param(
                'database.secret', default='odoo-secret'
            ),
        )

        try:
            payload = jwt.decode(
                raw_token, secret,
                algorithms=['HS256', 'RS256'],
                audience='odoo-api',
            )
        except jwt.ExpiredSignatureError:
            raise exceptions.ValidationError("Token has expired.")
        except jwt.InvalidTokenError as e:
            raise exceptions.ValidationError(f"Invalid token: {e}")

        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        token_rec = self.search([
            ('token_hash', '=', token_hash),
            ('state', '=', 'active'),
        ], limit=1)

        if not token_rec:
            raise exceptions.ValidationError(
                "Token not found or has been revoked."
            )

        token_rec.last_used_at = fields.Datetime.now()
        return payload, token_rec

    def action_revoke(self, reason='Manual revocation'):
        """Revoke this token (and cascade to child refresh tokens)."""
        for rec in self:
            rec.write({
                'state': 'revoked',
                'revoked_at': fields.Datetime.now(),
                'revoked_reason': reason,
            })
            # Cascade revoke child refresh tokens
            child_refresh = self.search([
                ('refresh_token_id', '=', rec.id),
                ('state', '=', 'active'),
            ])
            child_refresh.action_revoke(reason='Parent token revoked')
        _logger.warning('Tokens revoked: %s', self.mapped('jti'))

    def action_blacklist(self):
        """Add token to blacklist (immediate, irrevocable)."""
        for rec in self:
            rec.write({'state': 'blacklisted', 'revoked_at': fields.Datetime.now()})

    @api.model
    def _cron_expire_tokens(self):
        """Scheduled action: mark past-expiry tokens as expired."""
        expired = self.search([
            ('state', '=', 'active'),
            ('expires_at', '<', fields.Datetime.now()),
        ])
        if expired:
            expired.write({'state': 'expired'})
            _logger.info('Expired %d tokens via cron', len(expired))
