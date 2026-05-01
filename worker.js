export default {
  async fetch(request, env) {
    const BOT_TOKEN = '1234567890:AAHkMpXv2nQrWsYd8bJtLfCeUo9GiN1KmZw'; // your bot token
    const SECRET = 'JtLfCeUo9GiN1KmZwAAHkMpXv2nQrWsYd8b'; // webhook secret
    const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
    const url = new URL(request.url);

    // 访问 /webhook 自动完成注册
    if (url.pathname === '/webhook') {
      const workerUrl = `${url.protocol}//${url.host}`;
      const res = await fetch(`${API}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: workerUrl + '/',
          secret_token: SECRET,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证 secret_token
    if (request.method === 'POST') {
      const incoming = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (incoming !== SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
    } else {
      return new Response('Telegram URL Bot is running ✅');
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const message = update?.message;
    if (!message?.text) {
      return new Response('OK');
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    let targetUrl;
    try {
      targetUrl = new URL(text);
      if (!['http:', 'https:'].includes(targetUrl.protocol)) throw new Error();
    } catch {
      await sendMessage(API, chatId, '❌ 请发送一个有效的 HTTP/HTTPS URL');
      return new Response('OK');
    }

    await sendMessage(API, chatId, `⏳ 正在下载：${targetUrl.href}`);

    let fetchRes;
    try {
      fetchRes = await fetch(targetUrl.href, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
    } catch (e) {
      await sendMessage(API, chatId, `❌ 访问失败：${e.message}`);
      return new Response('OK');
    }

    if (!fetchRes.ok) {
      await sendMessage(API, chatId, `❌ 服务器返回错误：HTTP ${fetchRes.status}`);
      return new Response('OK');
    }

    const contentType = fetchRes.headers.get('content-type') || 'application/octet-stream';
    const fileBuffer = await fetchRes.arrayBuffer();
    const fileSize = fileBuffer.byteLength;

    if (fileSize > 50 * 1024 * 1024) {
      await sendMessage(API, chatId, `❌ 文件太大 (${(fileSize / 1024 / 1024).toFixed(1)}MB)，Telegram 限制 50MB`);
      return new Response('OK');
    }

    const filename = targetUrl.pathname.split('/').pop() || 'file';
    const ext = guessExt(contentType, filename);
    const finalName = filename.includes('.') ? filename : `${filename}${ext}`;

    try {
      await sendDocument(API, chatId, fileBuffer, finalName, contentType);
    } catch (e) {
      await sendMessage(API, chatId, `❌ 发送文件失败：${e.message}`);
    }

    return new Response('OK');
  }
};

function guessExt(contentType, filename) {
  if (filename.includes('.')) return '';
  const map = {
    'text/html': '.html',
    'text/plain': '.txt',
    'application/json': '.json',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'audio/mpeg': '.mp3',
  };
  const base = contentType.split(';')[0].trim();
  return map[base] || '';
}

async function sendMessage(API, chatId, text) {
  return fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendDocument(API, chatId, buffer, filename, contentType) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('document', new Blob([buffer], { type: contentType }), filename);

  const res = await fetch(`${API}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res;
}
