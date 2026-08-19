# -*- coding: utf-8 -*-
"""Emit a page shell with the one correct module order.

Dependency order matters and is easy to get wrong by hand:
  store -> seed -> models -> session -> icons -> app -> layout
Layout mounts the header the moment it runs, so it sits right after the slot.
"""
HEAD = '''<!DOCTYPE html>
<html lang="ar" dir="rtl" data-page="{page}" data-title-key="{title_key}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f7f8fd">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
<script src="assets/js/config.js"></script>
<script src="assets/js/core/theme.js"></script>
<script src="assets/js/core/i18n.js"></script>
</head>
<body class="page">
<a class="skip-link" href="#main" data-i18n="a11y.skip">تخطي إلى المحتوى</a>

<div data-slot="header"></div>
<script src="assets/js/core/store.js"></script>
<script src="assets/js/data/seed.js"></script>
<script src="assets/js/data/models.js"></script>
<script src="assets/js/core/session.js"></script>
<script src="assets/js/core/supabase.js"></script>
<script src="assets/js/core/signal.js"></script>
<script src="assets/js/core/rtc.js"></script>
<script src="assets/js/ui/icons.js"></script>
<script src="assets/js/core/app.js"></script>
<script src="assets/js/ui/layout.js"></script>
'''

FOOT = '''
<div data-slot="footer"></div>

<script src="assets/js/ui/components.js"></script>
<script src="assets/js/pages/{script}.js"></script>
</body>
</html>
'''

def shell(page, title_key, title, desc, body, script=None):
    return (HEAD.format(page=page, title_key=title_key, title=title, desc=desc)
            + body
            + FOOT.format(script=script or page))
