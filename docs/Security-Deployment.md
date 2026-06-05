# Security Deployment Checklist

This project is a static React/Vite single-page app. Host only the generated
`frontend/dist` directory. Do not expose the repository root, source files,
`package-lock.json`, documentation folders, or `.git`.

## Build

```bash
cd frontend
npm ci
npm audit --omit=dev
npm run build
```

Copy only:

```text
frontend/dist/
```

Do not run these commands as public services on the university server:

```bash
npm run dev
npm run preview
vitest --ui
```

## Nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name example.university.edu;

    root /var/www/life-safety-laboratories;
    index index.html;

    location ~ /\.(?!well-known) {
        deny all;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
}
```

The `style-src 'unsafe-inline'` directive is currently needed because MUI/Emotion
injects runtime styles. Tightening it requires nonce-based Emotion setup.

## Operational Notes

- Keep HTTPS enabled.
- Serve static files from a non-privileged web server user.
- Re-run `npm audit --omit=dev` before each deployment.
- If the build happens on the server, also run full `npm audit`.
- If lesson formulas or JSON content ever come from users, CMS, or uploaded
  files, keep HTML escaping in `FormulaBlock` and validate the content source.
