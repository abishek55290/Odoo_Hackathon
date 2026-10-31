# -*- coding: utf-8 -*-
import pyotp
import qrcode
import base64
from io import BytesIO
from odoo import models, fields, api, exceptions
import logging

_logger = logging.getLogger(__name__)


class ResUsersExt(models.Model):
    """
    Extension of res.users with:
        - TOTP / MFA support (RFC 6238)
        - OAuth UID tracking
        - Active session / token stats
        - Failed login throttling
    """
    _inherit = 'res.users'

    # ── TOTP / MFA ────────────────────────────────────────────────────────────
    totp_enabled = fields.Boolean(string='2FA / TOTP Enabled', default=False)
    totp_secret = fields.Char(
        string='TOTP Secret', copy=False,
        groups='base.group_system',
        help='Base32 TOTP secret — never expose to non-admins',
    )
    totp_qr_code = fields.Binary(
        string='TOTP QR Code', compute='_compute_totp_qr', store=False,
    )
    totp_backup_codes = fields.Text(
        string='Backup Codes (JSON)', copy=False,
        groups='base.group_system',
    )

    # ── OAuth ─────────────────────────────────────────────────────────────────
    oauth_uid = fields.Char(
        string='OAuth Provider UID', copy=False, index=True,
        help='Subject identifier from the OAuth/OIDC provider',
    )
    oauth_provider_id = fields.Many2one(
        'auth.oauth.provider', string='Linked OAuth Provider',
    )
    oauth_access_token = fields.Char(
        string='Last OAuth Access Token', copy=False,
        groups='base.group_system',
    )

    # ── Session / Token Stats ─────────────────────────────────────────────────
    active_session_count = fields.Integer(
        string='Active Sessions', compute='_compute_active_sessions',
    )
    active_token_count = fields.Integer(
        string='Active Tokens', compute='_compute_active_tokens',
    )

    # ── Security ──────────────────────────────────────────────────────────────
    failed_login_count = fields.Integer(
        string='Failed Login Attempts', default=0, copy=False,
    )
    locked_until = fields.Datetime(
        string='Account Locked Until', copy=False,
    )
    last_login_ip = fields.Char(string='Last Login IP', readonly=True)
    last_login_at = fields.Datetime(string='Last Login At', readonly=True)

    # ──────────────────────────────────────────────────────────────────────────
    # Compute
    # ──────────────────────────────────────────────────────────────────────────

    def _compute_active_sessions(self):
        for user in self:
            user.active_session_count = self.env['auth.session'].search_count([
                ('user_id', '=', user.id),
                ('state', '=', 'active'),
            ])

    def _compute_active_tokens(self):
        for user in self:
            user.active_token_count = self.env['auth.token'].search_count([
                ('user_id', '=', user.id),
                ('state', '=', 'active'),
            ])

    @api.depends('totp_secret', 'login', 'totp_enabled')
    def _compute_totp_qr(self):
        for user in self:
            if user.totp_enabled and user.totp_secret:
                totp = pyotp.TOTP(user.totp_secret)
                uri = totp.provisioning_uri(
                    name=user.login,
                    issuer_name='Odoo Auth Integration',
                )
                qr = qrcode.make(uri)
                buf = BytesIO()
                qr.save(buf, format='PNG')
                user.totp_qr_code = base64.b64encode(buf.getvalue())
            else:
                user.totp_qr_code = False

    # ──────────────────────────────────────────────────────────────────────────
    # TOTP Actions
    # ──────────────────────────────────────────────────────────────────────────

    def action_enable_totp(self):
        """Generate a new TOTP secret and return QR code for enrollment."""
        self.ensure_one()
        secret = pyotp.random_base32()
        self.write({
            'totp_secret': secret,
            'totp_enabled': False,   # confirm with first OTP before enabling
        })
        return {
            'type':     'ir.actions.act_window',
            'name':     'Scan QR Code',
            'res_model': 'res.users',
            'res_id':   self.id,
            'view_mode': 'form',
            'target':   'new',
        }

    def action_verify_and_enable_totp(self, otp_code):
        """Verify the user-entered OTP before committing TOTP activation."""
        self.ensure_one()
        if not self.totp_secret:
            raise exceptions.ValidationError("Generate a TOTP secret first.")
        totp = pyotp.TOTP(self.totp_secret)
        if not totp.verify(otp_code, valid_window=1):
            raise exceptions.ValidationError(
                "Invalid OTP code. Please ensure your authenticator app is synced."
            )
        self.totp_enabled = True
        _logger.info('TOTP enabled for user %s', self.login)
        return True

    def action_disable_totp(self):
        """Disable TOTP and clear secrets."""
        self.ensure_one()
        self.write({
            'totp_enabled': False,
            'totp_secret': False,
            'totp_backup_codes': False,
        })

    def verify_totp(self, otp_code):
        """
        Verify OTP during login.
        :raises: ValidationError if OTP is invalid
        """
        self.ensure_one()
        if not self.totp_enabled:
            return True   # TOTP not required
        totp = pyotp.TOTP(self.totp_secret)
        if not totp.verify(otp_code, valid_window=1):
            raise exceptions.ValidationError("Invalid TOTP code.")
        return True

    # ──────────────────────────────────────────────────────────────────────────
    # Brute-Force Protection
    # ──────────────────────────────────────────────────────────────────────────

    def record_failed_login(self):
        """Increment failed counter; lock account after 5 failures."""
        from datetime import datetime, timedelta
        self.ensure_one()
        count = (self.failed_login_count or 0) + 1
        lock_until = False
        if count >= 5:
            lock_until = datetime.utcnow() + timedelta(minutes=15)
            _logger.warning(
                'Account %s locked until %s after %d failed attempts.',
                self.login, lock_until, count,
            )
        self.write({
            'failed_login_count': count,
            'locked_until': lock_until,
        })

    def reset_failed_login(self, ip=None):
        """Clear failure counter on successful login."""
        self.write({
            'failed_login_count': 0,
            'locked_until': False,
            'last_login_ip': ip,
            'last_login_at': fields.Datetime.now(),
        })

    def is_account_locked(self):
        """Return True if account is currently locked out."""
        if self.locked_until and self.locked_until > fields.Datetime.now():
            return True
        return False

    # ──────────────────────────────────────────────────────────────────────────
    # Convenience Actions
    # ──────────────────────────────────────────────────────────────────────────

    def action_view_sessions(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': f'Sessions – {self.name}',
            'res_model': 'auth.session',
            'view_mode': 'list,form',
            'domain': [('user_id', '=', self.id)],
        }

    def action_revoke_all_tokens(self):
        self.ensure_one()
        tokens = self.env['auth.token'].search([
            ('user_id', '=', self.id),
            ('state', '=', 'active'),
        ])
        tokens.action_revoke(reason='Bulk revocation by user/admin')
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Tokens Revoked',
                'message': f'{len(tokens)} token(s) revoked successfully.',
                'type': 'success',
            },
        }
