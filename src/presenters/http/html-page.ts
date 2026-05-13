export function renderHtml(title: string, message: string): string {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #f7f7f5; color: #1f2937; }
      .card { max-width: 640px; margin: 40px auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
      h1 { margin: 0 0 12px; font-size: 22px; }
      p { line-height: 1.5; margin: 0 0 16px; }
      .hint { color: #6b7280; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p class="hint">Вернитесь в Telegram-бот и продолжайте работу.</p>
    </div>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  if (!value) return ''
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}
