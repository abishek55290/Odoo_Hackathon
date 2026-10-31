# -*- coding: utf-8 -*-
from odoo import models, fields, api


class AuthRevokeWizard(models.TransientModel):
    """
    Wizard to bulk-revoke tokens with a typed reason.
    Launched from the token list view.
    """
    _name = 'auth.revoke.wizard'
    _description = 'Revoke Tokens Wizard'

    reason = fields.Text(
        string='Revocation Reason',
        required=True,
        default='Security policy — bulk revocation',
        help='This reason will be stored on each revoked token for audit purposes.',
    )
    token_count = fields.Integer(
        string='Tokens to Revoke',
        compute='_compute_token_count',
    )

    @api.depends()
    def _compute_token_count(self):
        active_ids = self.env.context.get('active_ids', [])
        for rec in self:
            rec.token_count = len(active_ids)

    def action_confirm_revoke(self):
        self.ensure_one()
        active_ids = self.env.context.get('active_ids', [])
        tokens = self.env['auth.token'].browse(active_ids).filtered(
            lambda t: t.state == 'active'
        )
        tokens.action_revoke(reason=self.reason)
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'Tokens Revoked',
                'message': f'{len(tokens)} token(s) revoked successfully.',
                'type': 'success',
                'sticky': False,
            },
        }
