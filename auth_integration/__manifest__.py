# -*- coding: utf-8 -*-
{
    'name': 'Authentication & Integration',
    'version': '17.0.1.0.0',
    'summary': 'JWT, OAuth2 & Session Management for Odoo',
    'description': """
        Advanced Authentication & Integration Module
        =============================================
        Features:
        - JWT Token-based Authentication (HS256 / RS256)
        - OAuth2 Authorization Code Flow
        - Session Management & Invalidation
        - API Key Authentication
        - Multi-Factor Authentication (TOTP)
        - User Login / Logout Audit Logs
        - Token Blacklisting & Refresh Tokens
        - External Identity Provider Integration (Google, GitHub, etc.)
    """,
    'author': 'abishek55290',
    'website': 'https://github.com/abishek55290/Odoo_Hackathon',
    'category': 'Technical/Authentication',
    'license': 'LGPL-3',
    'depends': ['base', 'web', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'security/auth_security.xml',
        'data/auth_data.xml',
        'views/auth_token_views.xml',
        'views/auth_session_views.xml',
        'views/auth_oauth_views.xml',
        'views/auth_audit_views.xml',
        'views/auth_menus.xml',
        'wizards/auth_revoke_wizard_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'auth_integration/static/src/scss/auth_integration.scss',
            'auth_integration/static/src/js/auth_widget.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': True,
}
