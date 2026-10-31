# -*- coding: utf-8 -*-
from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)


class AuthAuditLog(models.Model):
    """
    Immutable audit log for all authentication-related events.
    Useful for security compliance, forensics, and SIEM integration.
    """
    _name = 'auth.audit.log'
    _description = 'Authentication Audit Log'
    _order = 'create_date desc'
    _log_access = False  # We manage timestamps manually for immutability

    # ── Event Classification ───────────────────────────────────────────────────
    event_type = fields.Selection([
        # ── Login Events ─────
        ('login_success',  'Login Success'),
        ('login_fail',     'Login Failed'),
        ('logout',         'Logout'),
        ('session_expire', 'Session Expired'),
        ('session_terminate', 'Session Force-Terminated'),
        # ── Token Events ─────
        ('token_issue',    'Token Issued'),
        ('token_verify',   'Token Verified'),
        ('token_refresh',  'Token Refreshed'),
        ('token_revoke',   'Token Revoked'),
        ('token_expire',   'Token Expired'),
        ('token_blacklist', 'Token Blacklisted'),
        # ── OAuth Events ─────
        ('oauth_start',    'OAuth Flow Started'),
        ('oauth_callback', 'OAuth Callback Received'),
        ('oauth_success',  'OAuth Login Success'),
        ('oauth_fail',     'OAuth Login Failed'),
        # ── Security Events ──
        ('mfa_challenge',  'MFA Challenged'),
        ('mfa_success',    'MFA Verified'),
        ('mfa_fail',       'MFA Failed'),
        ('brute_force',    'Brute-Force Detected'),
        ('api_key_use',    'API Key Used'),
        ('password_reset', 'Password Reset Requested'),
        ('permission_denied', 'Permission Denied'),
    ], string='Event', required=True, index=True)

    severity = fields.Selection([
        ('info',    'Info'),
        ('warning', 'Warning'),
        ('error',   'Error'),
        ('critical', 'Critical'),
    ], string='Severity', default='info', required=True)

    # ── Actor ─────────────────────────────────────────────────────────────────
    user_id = fields.Many2one(
        'res.users', string='User', ondelete='set null', index=True,
    )
    user_login = fields.Char(
        string='User Login (snapshot)',
        help='Captured at log time so it persists even after user deletion',
    )

    # ── Related Resources ─────────────────────────────────────────────────────
    token_id = fields.Many2one('auth.token', string='Token', ondelete='set null')
    session_id_ref = fields.Many2one(
        'auth.session', string='Session', ondelete='set null',
    )
    oauth_provider_id = fields.Many2one(
        'auth.oauth.provider', string='OAuth Provider', ondelete='set null',
    )

    # ── Network / Client ──────────────────────────────────────────────────────
    ip_address = fields.Char(string='IP Address')
    user_agent = fields.Char(string='User-Agent')
    endpoint = fields.Char(string='Endpoint Called')
    http_method = fields.Char(string='HTTP Method')

    # ── Metadata ──────────────────────────────────────────────────────────────
    timestamp = fields.Datetime(
        string='Timestamp', default=fields.Datetime.now,
        readonly=True, required=True, index=True,
    )
    message = fields.Text(string='Details')
    extra_data = fields.Text(
        string='Extra Data (JSON)',
        help='Additional context in JSON format',
    )
    success = fields.Boolean(string='Success', default=True)

    # ──────────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────────

    @api.model
    def log_event(self, event_type, user=None, message=None, severity='info',
                  success=True, ip=None, user_agent=None, token=None,
                  session=None, provider=None, endpoint=None,
                  http_method=None, extra=None):
        """
        Convenience factory to create audit entries.

        Usage::

            self.env['auth.audit.log'].log_event(
                'login_success', user=self.env.user,
                ip=request.httprequest.remote_addr,
            )
        """
        self.create({
            'event_type':       event_type,
            'severity':         severity,
            'user_id':          user.id if user else False,
            'user_login':       user.login if user else None,
            'message':          message,
            'success':          success,
            'ip_address':       ip,
            'user_agent':       user_agent,
            'token_id':         token.id if token else False,
            'session_id_ref':   session.id if session else False,
            'oauth_provider_id': provider.id if provider else False,
            'endpoint':         endpoint,
            'http_method':      http_method,
            'extra_data':       extra,
        })

    # Prevent writes/deletes to maintain audit integrity
    def write(self, vals):
        raise models.AccessError("Audit logs are immutable.")

    def unlink(self):
        raise models.AccessError(
            "Audit logs cannot be deleted for compliance reasons."
        )
