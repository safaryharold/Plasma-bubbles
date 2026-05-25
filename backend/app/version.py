"""Single source of truth for the running build's semver string.

Bumped manually with every release. Referenced by:
  - /api/health           (server.py)
  - /api/public/meta      (routes_public.py)
  - Export-for-paper caption footer
"""
__version__ = "1.6.0"
