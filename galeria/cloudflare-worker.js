// Cole este arquivo no Worker galeria-api-pantaneiro e mantenha o binding MY_BUCKET.
const IMAGE_ORIGIN = 'https://imagens.pantaneiroclinicavet.com.br/';
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif|svg)$/i;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type, ETag',
};

function json(data, status = 200, head = false) {
  return new Response(head ? null : JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function attachmentName(key) {
  const name = key.split('/').pop();
  const ascii = name.replace(/[^A-Za-z0-9._-]/g, '_');
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      const response = json({ erro: 'Método não permitido.' }, 405);
      response.headers.set('Allow', CORS['Access-Control-Allow-Methods']);
      return response;
    }

    const url = new URL(request.url);
    const head = request.method === 'HEAD';
    try {
      if (url.pathname === '/baixar') {
        const key = url.searchParams.get('foto');
        if (!key || !IMAGE_EXTENSION.test(key) || /[\x00-\x1f\x7f]/.test(key)) {
          return json({ erro: 'Informe o nome de uma foto válida.' }, 400, head);
        }
        const object = head ? await env.MY_BUCKET.head(key) : await env.MY_BUCKET.get(key);
        if (!object) return json({ erro: 'Foto não encontrada.' }, 404, head);

        const headers = new Headers(CORS);
        object.writeHttpMetadata(headers);
        const extension = key.split('.').pop().toLowerCase();
        const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml' };
        headers.set('Content-Type', types[extension]);
        headers.set('Content-Disposition', attachmentName(key));
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('Cache-Control', 'public, max-age=3600');
        headers.set('ETag', object.httpEtag);
        // O corpo é transmitido diretamente do R2, sem carregar toda a foto na memória.
        return new Response(head ? null : object.body, { headers });
      }

      if (url.pathname !== '/') return json({ erro: 'Rota não encontrada.' }, 404, head);

      const fotos = [];
      let cursor;
      do {
        const listing = await env.MY_BUCKET.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
        for (const object of listing.objects) {
          if (IMAGE_EXTENSION.test(object.key)) {
            fotos.push({
              nome: object.key,
              url: IMAGE_ORIGIN + object.key.split('/').map(encodeURIComponent).join('/'),
            });
          }
        }
        cursor = listing.truncated ? listing.cursor : undefined;
      } while (cursor);
      return json(fotos, 200, head);
    } catch (error) {
      console.error('Falha na galeria R2:', error);
      return json({ erro: 'Não foi possível acessar as fotos. Tente novamente.' }, 500, head);
    }
  },
};
