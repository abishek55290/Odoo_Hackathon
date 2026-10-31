# -*- coding: utf-8 -*-
import uuid
from datetime import datetime, timedelta
from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class AuthSession(models.Model):
    """
    Server-side session tracking.
    Each login creates an AuthSession; logout / token revocation closes it.
    Enables:
        - Concurrent session limiting
        - Session invalidation on password change
        - Device / geolocation tracking
        - Force-logout from admin panel
    """
    _name = 'auth.session'
    _description = 'User Authentication Session'
    _order = 'create_date desc'

    # ── Identity ───────────────────────────────────────────────────────────────
    session_id = fields.Char(
        string='Session ID', required=True, index=True, copy=False,
        default=lambda self: str(uuid.uuid4()),
    )
    user_id = fields.Many2one(
        'res.users', string='User', required=True,
        ondelete='cascade', index=True,
    )
    token_id = fields.Many2one(
        'auth.token', string='Linked Token', ondelete='set null',
    )

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    state = fields.Selection([
        ('active',    'Active'),
        ('expired',   'Expired'),
        ('terminated', 'Terminated'),
    ], string='Status', default='active', index=True, required=True)

    login_at = fields.Datetime(
        string='Logged In At', default=fields.Datetime.now, readonly=True,
    )
    logout_at = fields.Datetime(string='Logged Out At', readonly=True)
    last_activity = fields.Datetime(
        string='Last Activity', default=fields.Datetime.now,
    )
    expires_at = fields.Datetime(string='Session Expires At')

    # ── Client Info ────────────────────────────────────────────────────────────
    ip_address = fields.Char(string='IP Address')
    user_agent = fields.Char(string='User-Agent / Browser')
    device_type = fields.Selection([
        ('desktop', 'Desktop'),
        ('mobile',  'Mobile'),
        ('tablet',  'Tablet'),
        ('api',     'API Client'),
        ('unknown', 'Unknown'),
    ], string='Device Type', default='unknown')
    device_fingerprint = fields.Char(string='Device Fingerprint (hash)')
    geolocation = fields.Char(string='Geolocation (City, Country)')

    # ── Auth Method ────────────────────────────────────────────────────────────
    auth_method = fields.Selection([
        ('password', 'Password'),
        ('oauth2',   'OAuth2'),
        ('jwt',      'JWT / API Key'),
        ('totp',     '2FA / TOTP'),
        ('saml',     'SAML SSO'),
    ], string='Authentication Method', default='password')
    mfa_verified = fields.Boolean(string='MFA Verified', default=False)

    # ── Computed ───────────────────────────────────────────────────────────────
    duration = fields.Char(
        string='Session Duration', compute='_compute_duration',
    )
    is_expired = fields.Boolean(
        string='Is Expired', compute='_compute_is_expired',
    )

    @api.depends('login_at', 'logout_at', 'last_activity')
    def _compute_duration(self):
        for rec in self:
            end = rec.logout_at or rec.last_activity or fields.Datetime.now()
            if rec.login_at:
                delta = end - rec.login_at
                total_secs = int(delta.total_seconds())
                hours, rem = divmod(total_secs, 3600)
                mins, secs = divmod(rem, 60)
                rec.duration = f"{hours:02d}h {mins:02d}m {secs:02d}s"
            else:
                rec.duration = '—'

    @api.depends('expires_at', 'state')
    def _compute_is_expired(self):
        now = fields.Datetime.now()
        for rec in self:
            rec.is_expired = (
                rec.state == 'expired' or
                bool(rec.expires_at and rec.expires_at < now)
            )

    # ──────────────────────────────────────────────────────────────────────────
    # Business Logic
    # ──────────────────────────────────────────────────────────────────────────

    @api.model
    def create_session(self, user, token_rec=None, ip=None, user_agent=None,
                       auth_method='password', mfa=False, ttl_hours=8):
        """
        Create and return a new active session for ``user``.
        """
        device_type = 'unknown'
        if user_agent:
            ua = user_agent.lower()
            if any(kw in ua for kw in ('mobile', 'android', 'iphone')):
                device_type = 'mobile'
            elif 'tablet' in ua or 'ipad' in ua:
                device_type = 'tablet'
            elif any(kw in ua for kw in ('curl', 'python', 'requests', 'postman')):
                device_type = 'api'
            else:
                device_type = 'desktop'

        session = self.create({
            'user_id': user.id,
            'token_id': token_rec.id if token_rec else False,
            'ip_address': ip,
            'user_agent': user_agent,
            'device_type': device_type,
            'auth_method': auth_method,
            'mfa_verified': mfa,
            'expires_at': datetime.utcnow() + timedelta(hours=ttl_hours),
            'state': 'active',
        })
        _logger.info(
            'Session created | user=%s session_id=%s ip=%s method=%s',
            user.login, session.session_id, ip, auth_method,
        )
        return session

    def action_terminate(self):
        """Force-terminate this session (admin action)."""
        for rec in self:
            rec.write({
                'state': 'terminated',
                'logout_at': fields.Datetime.now(),
            })
            if rec.token_id:
                rec.token_id.action_revoke(
                    reason=f"Session {rec.session_id} terminated by admin"
                )
        _logger.warning(
            'Sessions force-terminated: %s', self.mapped('session_id')
        )

    def action_logout(self):
        """Mark session as terminated on user-initiated logout."""
        for rec in self:
            rec.write({
                'state': 'terminated',
                'logout_at': fields.Datetime.now(),
            })

    def touch(self):
        """Update last_activity timestamp (call on each authenticated request)."""
        self.last_activity = fields.Datetime.now()

    @api.model
    def _cron_expire_sessions(self):
        """Scheduled: expire sessions past their TTL."""
        expired = self.search([
            ('state', '=', 'active'),
            ('expires_at', '<', fields.Datetime.now()),
        ])
        if expired:
            expired.write({'state': 'expired', 'logout_at': fields.Datetime.now()})
            _logger.info('Expired %d sessions via cron', len(expired))

    @api.model
    def get_active_sessions_count(self, user):
        """Return count of active sessions for a given user."""
        return self.search_count([
            ('user_id', '=', user.id),
            ('state', '=', 'active'),
        ])
