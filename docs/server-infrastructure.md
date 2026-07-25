# Server Infrastructure

This document describes the current production server setup for Tale Treller Bot.

## Host

- Server hostname: `ika-vpn-eu`
- Project path: `/home/app/apps/tale-treller-bot`
- Project owner: `app`
- Public server IP: `207.154.220.245`
- OS family: Ubuntu Linux

## Domains

### Bot domain

`https://bot.taletreller.online`

Purpose:
- public base URL for the Node application;
- Trello OAuth start/callback/result endpoints;
- Node-side App API behind nginx proxy;
- value for `APP_BASE_URL` in production.

Production `.env` should keep:

```dotenv
NODE_ENV=production
APP_BASE_URL=https://bot.taletreller.online
APP_PORT=3000
```

Trello callback URL:

```text
https://bot.taletreller.online/auth/trello/callback
```

### Telegram Mini App domain

`https://app.taletreller.online/`

Purpose:
- Telegram Mini App / Menu Button URL;
- static Vue application served by nginx;
- App API proxy for relative frontend requests.

BotFather Mini App / Menu Button URL:

```text
https://app.taletreller.online/
```

DNS records:

```text
bot.taletreller.online A 207.154.220.245
app.taletreller.online A 207.154.220.245
```

## Runtime Topology

Production has two public nginx virtual hosts and one local Node process.

```text
Telegram bot polling
        |
        v
PM2 process: tg-trello-bot
        |
        v
node dist/index.js on 127.0.0.1:3000
        |
        +--> Trello OAuth: /auth/trello/*
        +--> App API: /api/app/*
        +--> DB migrations and PostgreSQL access
```

Public traffic:

```text
https://bot.taletreller.online/*
        |
        v
nginx proxy_pass http://127.0.0.1:3000
```

```text
https://app.taletreller.online/
        |
        v
nginx static files from /var/www/app.taletreller.online
```

```text
https://app.taletreller.online/api/app/*
        |
        v
nginx proxy_pass http://127.0.0.1:3000/api/app/*
```

## Static Mini App Files

Vite builds the Telegram Mini App into:

```text
/home/app/apps/tale-treller-bot/dist/public/app
```

Nginx serves the production copy from:

```text
/var/www/app.taletreller.online
```

Why the copy exists:
- nginx runs as `www-data`;
- files under `/home/app/...` may be unreadable because parent directories are private;
- `/var/www/...` is the conventional public static-file location.

The deploy script copies fresh build output into `/var/www/app.taletreller.online` and fixes ownership/permissions.

## Nginx

Main useful commands:

```bash
sudo /usr/sbin/nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
sudo /usr/sbin/nginx -T
```

Important config files:

```text
/etc/nginx/sites-enabled/bot.taletreller.online
/etc/nginx/sites-enabled/app.taletreller.online
```

The App vhost should:
- serve root `/` with SPA fallback to `index.html`;
- serve `/app/assets/*` from the static build assets;
- proxy `/api/app/*` to `http://127.0.0.1:3000`.

Useful checks:

```bash
curl -I https://app.taletreller.online/
curl -i https://app.taletreller.online/api/app/me
curl -I https://bot.taletreller.online/auth/trello/result
```

Expected:
- `https://app.taletreller.online/` returns `200` and HTML;
- `https://app.taletreller.online/api/app/me` returns `401` outside Telegram, because Telegram `initData` is missing;
- nginx config test returns `syntax is ok` and `test is successful`.

## TLS Certificates

Certificates are managed by Certbot.

Issue or renew a certificate for the App domain:

```bash
sudo certbot --nginx -d app.taletreller.online
```

Issue or renew a certificate for the bot domain:

```bash
sudo certbot --nginx -d bot.taletreller.online
```

Check certificates:

```bash
sudo certbot certificates
```

## PM2

The bot runs as a PM2 process named `tg-trello-bot`.

Common commands:

```bash
sudo -iu app pm2 status
sudo -iu app pm2 logs tg-trello-bot
sudo -iu app pm2 restart tg-trello-bot
sudo -iu app pm2 save
```

Manual start command:

```bash
sudo -iu app bash -lc 'cd /home/app/apps/tale-treller-bot && pm2 start npm --name tg-trello-bot -- start'
```

There should be only one live `node dist/index.js` for this bot. Multiple processes can conflict with Telegram polling.

Check:

```bash
ps aux | grep -E 'node|pm2|dist/index' | grep -v grep
```

## Deployment

Deployment is automated by `deploy.sh`.

Run from the server:

```bash
sudo -iu app bash -lc 'cd /home/app/apps/tale-treller-bot && ./deploy.sh'
```

The script:
1. fetches `origin/master`;
2. resets the working tree to `origin/master`;
3. installs dependencies including dev dependencies;
4. builds server and Mini App;
5. copies Mini App static files into `/var/www/app.taletreller.online`;
6. fixes nginx-readable ownership and permissions;
7. validates and reloads nginx;
8. prunes dev dependencies;
9. restarts or starts the PM2 process;
10. saves PM2 state.

Because the script writes to `/var/www` and reloads nginx, it needs sudo permission for:

```text
mkdir
rsync
chown
find
/usr/sbin/nginx -t
systemctl reload nginx
```

## Logs

Nginx logs:

```bash
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log
```

PM2 logs:

```bash
sudo -iu app pm2 logs tg-trello-bot
```

System logs:

```bash
sudo journalctl -u nginx --no-pager -n 100
sudo journalctl -u postgresql@14-main --no-pager -n 100
```

## Troubleshooting

### Domain does not resolve

Symptom:

```text
curl: (6) Could not resolve host: app.taletreller.online
```

Check:

```bash
getent hosts app.taletreller.online
getent hosts bot.taletreller.online
dig @1.1.1.1 +short app.taletreller.online
dig @8.8.8.8 +short app.taletreller.online
```

Fix DNS so the domain points to `207.154.220.245`.

### App returns 500

Check nginx errors:

```bash
sudo tail -n 80 /var/log/nginx/error.log
```

If the log contains `Permission denied` for `/home/app/...`, nginx is trying to serve files from the project directory. It should serve from:

```text
/var/www/app.taletreller.online
```

Run deploy again or copy static files manually:

```bash
sudo rsync -a --delete /home/app/apps/tale-treller-bot/dist/public/app/ /var/www/app.taletreller.online/
sudo chown -R www-data:www-data /var/www/app.taletreller.online
sudo find /var/www/app.taletreller.online -type d -exec chmod 755 {} \;
sudo find /var/www/app.taletreller.online -type f -exec chmod 644 {} \;
sudo /usr/sbin/nginx -t
sudo systemctl reload nginx
```

### API returns 401 outside Telegram

This is expected for protected App API endpoints:

```bash
curl -i https://app.taletreller.online/api/app/me
```

The App API requires Telegram Mini App `initData` in `X-Telegram-Init-Data`.

### `vue-tsc: not found`

The App build requires dev dependencies. Use:

```bash
sudo -iu app bash -lc 'cd /home/app/apps/tale-treller-bot && npm ci --include=dev && npm run build:app'
```

`deploy.sh` already handles this.

