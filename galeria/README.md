# Galeria

Página estática independente; seus estilos, scripts e miniaturas ficam nesta pasta.

- `dados-fotos.js`: catálogo local para exibir as fotos imediatamente. A API é consultada em segundo plano, com limite de seis segundos.
- `miniaturas/`: WebP em dois tamanhos (lado maior de 480 e 960 px). O navegador escolhe a versão conforme o espaço e a densidade da tela.
- Os JPGs remotos continuam sendo usados ao ampliar, baixar ou copiar o link.
- Fotos novas retornadas pela API sem miniatura local usam o original como alternativa.

Para atualizar as miniaturas, inclua os registros `nome` e `url` no catálogo e execute `python galeria/gerar-miniaturas.py` a partir da raiz do projeto. Requer Python, Pillow e `curl.exe`. O script preserva os originais remotos, reutiliza miniaturas já geradas e atualiza as dimensões no catálogo.

Publique a pasta `galeria` completa, incluindo `miniaturas`, junto com os arquivos do site.

O download direto usa `https://galeria-api-pantaneiro.equipeinvictusdigital.workers.dev/baixar?foto=0S7A4346.jpg`. O Worker transmite o original do R2 com CORS e `Content-Disposition: attachment`. A página obtém o arquivo e inicia o download sem navegar para o link.

Para ativar, substitua o código do Worker existente pelo conteúdo de `galeria/cloudflare-worker.js`, mantenha o vínculo R2 com o nome `MY_BUCKET` e publique o Worker. A rota `/` mantém a listagem usada pela galeria; `/baixar?foto=...` adiciona o download. Publique o Worker antes da versão atualizada da página.

Depois disso, publique os arquivos da galeria normalmente no Coolify com Build Pack Static. Não é necessário configurar Nginx, Vercel ou um servidor de download em Python. A mesma página funciona em um servidor estático local, como o Live Server na porta 5500.

Referências: [R2 no Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/) e [CORS no Workers](https://developers.cloudflare.com/workers/examples/cors-header-proxy/).
