import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const original = Uint8Array.from([255, 216, 255, 224, 1, 2, 3, 255, 217]);
const photo = () => ({
  body: new ReadableStream({ start(controller) { controller.enqueue(original); controller.close(); } }),
  httpEtag: '"original-etag"',
  writeHttpMetadata(headers) { headers.set('Content-Type', 'application/octet-stream'); },
});
const request = (path, method = 'GET') => new Request(`https://gallery.example${path}`, { method });

test('listagem preserva o formato, filtra imagens e percorre as páginas do R2', async () => {
  const calls = [];
  const response = await worker.fetch(request('/'), { MY_BUCKET: {
    async list(options) {
      calls.push(options);
      return options.cursor
        ? { objects: [{ key: 'pasta/foto cão.jpg' }], truncated: false }
        : { objects: [{ key: '0S7A4346.jpg' }, { key: 'readme.txt' }], truncated: true, cursor: 'next' };
    },
  } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(await response.json(), [
    { nome: '0S7A4346.jpg', url: 'https://imagens.pantaneiroclinicavet.com.br/0S7A4346.jpg' },
    { nome: 'pasta/foto cão.jpg', url: 'https://imagens.pantaneiroclinicavet.com.br/pasta/foto%20c%C3%A3o.jpg' },
  ]);
  assert.deepEqual(calls, [{ limit: 1000 }, { limit: 1000, cursor: 'next' }]);
});

test('download transmite os bytes originais, com CORS e nome de anexo seguro', async () => {
  const key = 'pasta/foto cão.jpg';
  const response = await worker.fetch(request(`/baixar?foto=${encodeURIComponent(key)}`), { MY_BUCKET: {
    async get(received) { assert.equal(received, key); return photo(); },
  } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('ETag'), '"original-etag"');
  assert.match(response.headers.get('Content-Disposition'), /^attachment;/);
  assert.match(response.headers.get('Content-Disposition'), /filename\*=UTF-8''foto%20c%C3%A3o.jpg/);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), original);
});

test('HEAD consulta metadados sem baixar o corpo do R2', async () => {
  const response = await worker.fetch(request('/baixar?foto=test.png', 'HEAD'), { MY_BUCKET: {
    async head(key) { assert.equal(key, 'test.png'); return photo(); },
  } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(await response.text(), '');
});

test('OPTIONS e métodos não permitidos', async () => {
  const options = await worker.fetch(request('/baixar', 'OPTIONS'), {});
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('Access-Control-Allow-Origin'), '*');
  const post = await worker.fetch(request('/baixar', 'POST'), {});
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD, OPTIONS');
});

test('erros de rota, nome inválido e foto ausente retornam JSON com CORS', async () => {
  for (const [path, status] of [
    ['/outra', 404], ['/baixar', 400], ['/baixar?foto=segredo.txt', 400],
    ['/baixar?foto=teste%0A.jpg', 400], ['/baixar?foto=ausente.jpg', 404],
  ]) {
    const response = await worker.fetch(request(path), { MY_BUCKET: { async get() { return null; } } });
    assert.equal(response.status, status, path);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(typeof (await response.json()).erro, 'string');
  }
});
