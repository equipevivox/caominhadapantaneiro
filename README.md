# Landing Page Cãominhada

Landing page estática criada a partir do briefing `Direção UX-UI _ Landing Page Cãominhada.md` e da referência visual enviada.

Site: [pantaneirocaominhada.vercel.app](https://pantaneirocaominhada.vercel.app)

## Visualização

Abra `index.html` diretamente no navegador ou execute um servidor local nesta pasta.

## Onde inserir as fotografias

Os pontos de imagem estão marcados no `index.html` com comentários e com a classe `photo-slot`:

- Hero: fotografia principal da Cãominhada.
- Timeline: fotografias de 2019, 2022, 2023, 2024 e 2025.
- CTA final: o asset `Elementos/dog_realistic.webp` já está inserido.

Para as fotos da timeline, substitua cada bloco `.photo-slot--timeline` por uma tag `<img>` dentro do respectivo `.polaroid`. Use `width="..."`, `height="..."`, `loading="lazy"` e um texto alternativo descritivo.

## Arquivos

- `index.html`: estrutura e conteúdo.
- `styles.css`: identidade visual, responsividade e animações.
- `script.js`: menu móvel, cabeçalho e animações de entrada.
- `Elementos/`: texturas decorativas fornecidas.
- `pantaneiro-logomarca.svg` e `caominhada-logomarca.svg`: marcas fornecidas.
