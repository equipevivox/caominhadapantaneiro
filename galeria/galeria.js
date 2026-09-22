/**
 * Galeria de Fotos — Cãominhada Pet Shop Pantaneiro
 * Consome a API do Cloudflare Workers conectado ao Bucket R2
 */

(function () {
  'use strict';

  const API_URL = 'https://galeria-api-pantaneiro.equipeinvictusdigital.workers.dev/';
  const GALLERY_URL = new URL('.', document.currentScript.src);
  const PAGE_SIZE = 28;
  const localPhotos = window.__BACKUP_PHOTOS__ || [];
  const localByName = new Map(localPhotos.map(photo => [photo.nome, photo]));
  let layoutFrame;
  let previousFocus;

  // Estado da Aplicação
  const state = {
    allPhotos: [],
    filteredPhotos: [],
    renderedCount: 0,
    activeLightboxIndex: -1,
    isLoading: false,
  };

  // Elementos do DOM
  const elements = {
    grid: document.getElementById('photos-grid'),
    loadMoreWrapper: document.getElementById('load-more-wrapper'),
    btnLoadMore: document.getElementById('btn-load-more'),
    siteHeader: document.querySelector('.site-header'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text'),

    // Lightbox
    lightbox: document.getElementById('lightbox-modal'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxCounter: document.getElementById('lightbox-counter'),
    lightboxPhotoName: document.getElementById('lightbox-photo-name'),
    lightboxBtnClose: document.getElementById('lightbox-btn-close'),
    lightboxBtnPrev: document.getElementById('lightbox-btn-prev'),
    lightboxBtnNext: document.getElementById('lightbox-btn-next'),
    lightboxBtnDownload: document.getElementById('lightbox-btn-download'),
    lightboxBtnShare: document.getElementById('lightbox-btn-share'),
  };

  /**
   * Inicialização da Galeria
   */
  async function init() {
    setupHeaderScroll();
    setupEventListeners();
    let lastWidth = 0;
    new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width === lastWidth) return;
      lastWidth = width;
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(layoutGallery);
    }).observe(elements.grid);
    await fetchPhotos();
  }

  /**
   * Efeito de scroll no cabeçalho
   */
  function setupHeaderScroll() {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        elements.siteHeader.classList.add('is-scrolled');
      } else {
        elements.siteHeader.classList.remove('is-scrolled');
      }
    }, { passive: true });
  }

  /**
   * Busca as fotos na API Cloudflare Worker
   */
  async function fetchPhotos() {
    state.isLoading = true;
    if (localPhotos.length) {
      state.allPhotos = localPhotos;
      renderGallery();
    } else {
      renderLoadingState();
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const photos = data.filter(photo => photo && typeof photo.nome === 'string' && /^https?:\/\//.test(photo.url));
        if (!photos.length) throw new Error('Nenhuma foto válida retornada');
        const unchanged = photos.length === state.allPhotos.length && photos.every((photo, index) =>
          photo.nome === state.allPhotos[index].nome && photo.url === state.allPhotos[index].url);
        if (!unchanged && state.activeLightboxIndex === -1) {
          state.allPhotos = photos.map(photo => {
            const local = localByName.get(photo.nome);
            return local?.url === photo.url ? { ...local, ...photo } : photo;
          });
          renderGallery();
        }
      } else {
        throw new Error('Nenhuma foto retornada');
      }
    } catch (err) {
      console.warn('API indisponível; mantendo o catálogo local da galeria.', err);
    } finally {
      clearTimeout(timeout);
      state.isLoading = false;
      if (!state.allPhotos.length) {
        elements.grid.innerHTML = '<div class="state-container"><h2 class="state-title">Não foi possível carregar as fotos</h2><p>Recarregue a página para tentar novamente.</p></div>';

      }
    }
  }

  /**
   * Renderiza estado de carregamento inicial
   */
  function renderLoadingState() {
    elements.grid.innerHTML = `
      <div class="state-container">
        <div class="spinner"></div>
        <h2 class="state-title">Carregando fotos...</h2>
        <p class="state-desc">Buscando os registros da Cãominhada direto da nuvem.</p>
      </div>
    `;
    elements.loadMoreWrapper.style.display = 'none';
  }

  /** Exibe o catálogo na ordem original. */
  function renderGallery() {
    state.filteredPhotos = state.allPhotos;
    state.renderedCount = 0;
    elements.grid.replaceChildren();
    renderNextBatch();
  }

  /**
   * Renderiza o próximo lote de fotos sob demanda.
   */
  function renderNextBatch() {
    const total = state.filteredPhotos.length;
    const start = state.renderedCount;
    const end = Math.min(start + PAGE_SIZE, total);

    if (start >= total) {
      elements.loadMoreWrapper.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();

    for (let i = start; i < end; i++) {
      const photo = state.filteredPhotos[i];
      fragment.appendChild(createPhotoTile(photo, i));
    }

    elements.grid.appendChild(fragment);
    state.renderedCount = end;
    layoutGallery();


    // Exibe ou esconde o botão "Carregar mais"
    if (state.renderedCount < total) {
      elements.loadMoreWrapper.style.display = 'block';
      elements.btnLoadMore.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Carregar mais fotos (${total - state.renderedCount} restantes)
      `;
    } else {
      elements.loadMoreWrapper.style.display = 'none';
    }
  }

  /** Miniaturas locais; originais são usados apenas ao ampliar ou baixar. */
  function createPhotoTile(photo, index) {
    const tile = document.createElement('article');
    tile.className = 'photo-tile';
    tile.dataset.index = index;
    const photoNumber = index + 1;
    tile.innerHTML = `
      <button type="button" class="photo-open" aria-label="Ampliar foto ${photoNumber}">
        <img class="photo-img" alt="Foto da Cãominhada Pantaneiro — ${photoNumber}"
          loading="lazy" decoding="async" width="${photo.width || 1500}" height="${photo.height || 1000}" />
        <span class="photo-error" hidden>Foto indisponível. Toque para abrir o original.</span>
      </button>
      <button type="button" class="photo-download" title="Baixar foto original" aria-label="Baixar foto ${photoNumber}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" />
        </svg>
      </button>`;
    const img = tile.querySelector('img');
    img.addEventListener('load', () => {
      img.classList.add('is-loaded');
      tile.querySelector('.photo-error').hidden = true;
      // Fotos novas da API também conservam sua proporção real.
      if (!photo.width && img.naturalWidth) {
        photo.width = img.naturalWidth;
        photo.height = img.naturalHeight;
        cancelAnimationFrame(layoutFrame);
        layoutFrame = requestAnimationFrame(layoutGallery);
      }
    });
    img.addEventListener('error', () => {
      if (img.getAttribute('src') !== photo.url) {
        img.removeAttribute('srcset');
        img.src = photo.url;
      } else {
        tile.querySelector('.photo-error').hidden = false;
      }
    });
    if (photo.thumbnail && photo.preview) {
      const ratio = Math.min(1, photo.width / photo.height);
      const thumbnail = new URL(photo.thumbnail, GALLERY_URL).href;
      const preview = new URL(photo.preview, GALLERY_URL).href;
      img.srcset = `${thumbnail} ${Math.round(480 * ratio)}w, ${preview} ${Math.round(960 * ratio)}w`;
      img.sizes = '(max-width: 640px) 100vw, 34vw';
    }
    img.src = photo.thumbnail ? new URL(photo.thumbnail, GALLERY_URL).href : photo.url;
    return tile;
  }

  /** Fileiras justificadas calculadas a partir das dimensões, sem esperar as imagens. */
  function layoutGallery() {
    const tiles = [...elements.grid.querySelectorAll('.photo-tile')];
    if (!tiles.length) return;
    const width = elements.grid.clientWidth;
    if (!width) return;
    const mobile = window.matchMedia('(max-width: 640px)').matches;
    const gap = 5;
    const targetHeight = Math.min(440, width / 4.5);
    const rows = document.createDocumentFragment();
    let row = [];
    let ratioSum = 0;
    function appendRow(last = false) {
      if (!row.length) return;
      // No celular, inclusive uma vertical sem par preenche a fileira inteira.
      const height = Math.min((width - gap * (row.length - 1)) / ratioSum, last && !mobile ? targetHeight : Infinity);
      const container = document.createElement('div');
      container.className = 'photo-row';
      container.style.height = `${height}px`;
      for (const {tile, ratio} of row) {
        tile.style.width = `${height * ratio}px`;
        tile.querySelector('img').sizes = `${Math.ceil(height * ratio)}px`;
        container.appendChild(tile);
      }
      rows.appendChild(container);
      row = [];
      ratioSum = 0;
    }
    for (const tile of tiles) {
      const photo = state.filteredPhotos[Number(tile.dataset.index)];
      const ratio = photo.width && photo.height ? photo.width / photo.height : 1.5;
      if (mobile) {
        // Horizontais ocupam uma fileira; verticais consecutivas ficam em pares.
        if (ratio >= 1) appendRow();
        row.push({tile, ratio});
        ratioSum += ratio;
        if (ratio >= 1 || row.length === 2) appendRow();
        continue;
      }
      const currentHeight = (width - gap * (row.length - 1)) / ratioSum;
      const nextHeight = (width - gap * row.length) / (ratioSum + ratio);
      if (row.length && nextHeight < targetHeight && Math.abs(currentHeight - targetHeight) < Math.abs(nextHeight - targetHeight)) {
        appendRow();
      }
      row.push({tile, ratio});
      ratioSum += ratio;
      if ((width - gap * (row.length - 1)) / ratioSum <= targetHeight) appendRow();
    }
    appendRow(true);
    elements.grid.replaceChildren(rows);
  }

  /**
   * Configura listeners de eventos gerais
   */
  function setupEventListeners() {
    elements.grid.addEventListener('click', event => {
      const tile = event.target.closest('.photo-tile');
      if (!tile) return;
      const index = Number(tile.dataset.index);
      if (event.target.closest('.photo-download')) {
        downloadPhoto(state.filteredPhotos[index], event.target.closest('.photo-download'));
      } else if (event.target.closest('.photo-open')) {
        openLightbox(index);
      }
    });
    // Botão carregar mais
    elements.btnLoadMore.addEventListener('click', () => {
      renderNextBatch();
    });

    // Lightbox controles
    elements.lightboxBtnClose.addEventListener('click', closeLightbox);
    elements.lightboxBtnPrev.addEventListener('click', () => navigateLightbox(-1));
    elements.lightboxBtnNext.addEventListener('click', () => navigateLightbox(1));

    elements.lightbox.addEventListener('click', (e) => {
      if (e.target === elements.lightbox || e.target.classList.contains('lightbox-body')) {
        closeLightbox();
      }
    });

    // Teclado (Navegação & Esc)
    window.addEventListener('keydown', (e) => {
      if (!elements.lightbox.classList.contains('is-open')) return;

      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'Tab') {
        const buttons = [...elements.lightbox.querySelectorAll('button')];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        navigateLightbox(1);
      }
    });

    // Ações do Lightbox
    elements.lightboxBtnDownload.addEventListener('click', () => {
      const photo = state.filteredPhotos[state.activeLightboxIndex];
      if (photo) downloadPhoto(photo, elements.lightboxBtnDownload);
    });

    elements.lightboxBtnShare.addEventListener('click', () => {
      const photo = state.filteredPhotos[state.activeLightboxIndex];
      if (photo) copyPhotoUrl(photo);
    });

    // Gestos de toque (Touch swipe) para Mobile no Lightbox
    let touchStartX = 0;
    let touchEndX = 0;

    elements.lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    elements.lightbox.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          navigateLightbox(-1); // Swipe direita -> Anterior
        } else {
          navigateLightbox(1);  // Swipe esquerda -> Próximo
        }
      }
    }
  }

  /**
   * Abre o Lightbox na foto especificada
   */
  function openLightbox(index) {
    if (index < 0 || index >= state.filteredPhotos.length) return;
    const wasOpen = elements.lightbox.classList.contains('is-open');
    if (!wasOpen) previousFocus = document.activeElement;

    state.activeLightboxIndex = index;
    const photo = state.filteredPhotos[index];

    elements.lightboxImg.classList.remove('is-loaded');
    elements.lightboxImg.alt = `Foto ${index + 1} da Cãominhada`;

    elements.lightboxPhotoName.textContent = '6º CÃOMINHADA';
    elements.lightboxCounter.textContent = `${index + 1} de ${state.filteredPhotos.length}`;

    elements.lightboxImg.onload = () => {
      elements.lightboxImg.classList.add('is-loaded');
    };
    elements.lightboxImg.onerror = () => showToast('Não foi possível carregar esta foto. Tente novamente.');
    elements.lightboxImg.src = photo.url;
    if (elements.lightboxImg.complete && elements.lightboxImg.naturalWidth) {
      elements.lightboxImg.classList.add('is-loaded');
    }

    elements.lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    for (const selector of ['main', '.site-header', '.site-footer']) {
      document.querySelector(selector).inert = true;
    }
    if (!wasOpen) elements.lightboxBtnClose.focus();
  }

  /**
   * Navega entre as fotos no Lightbox
   */
  function navigateLightbox(direction) {
    const total = state.filteredPhotos.length;
    if (total <= 1) return;

    let nextIndex = state.activeLightboxIndex + direction;

    if (nextIndex < 0) {
      nextIndex = total - 1; // Volta para o final
    } else if (nextIndex >= total) {
      nextIndex = 0; // Vai para o começo
    }

    openLightbox(nextIndex);
  }

  /**
   * Fecha o Lightbox
   */
  function closeLightbox() {
    elements.lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    state.activeLightboxIndex = -1;
    elements.lightboxImg.removeAttribute('src');
    for (const selector of ['main', '.site-header', '.site-footer']) {
      document.querySelector(selector).inert = false;
    }
    previousFocus?.focus({ preventScroll: true });
  }

  /**
   * Baixa a imagem diretamente no dispositivo do usuário
   */
  async function downloadPhoto(photo, button) {
    if (button?.disabled) return;
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }
    showToast('Preparando a foto original para baixar...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      if (!photo.nome) {
        throw new Error('Nome de foto inválido');
      }
      const downloadUrl = new URL('baixar', API_URL);
      downloadUrl.searchParams.set('foto', photo.nome);
      const res = await fetch(downloadUrl, {
        signal: controller.signal,
        credentials: 'omit',
      });
      if (!res.ok || !res.headers.get('Content-Type')?.toLowerCase().startsWith('image/')) {
        throw new Error('Não foi possível obter o arquivo');
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error('Arquivo vazio');
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = photo.nome.split('/').pop() || 'caominhada-foto.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      showToast('Foto pronta! Download iniciado.');
    } catch (e) {
      showToast('Não foi possível baixar a foto. Toque em baixar para tentar novamente.');
    } finally {
      clearTimeout(timeout);
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }

  /**
   * Copia o link direto da foto para o clipboard
   */
  async function copyPhotoUrl(photo) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(photo.url);
      } else {
        const temp = document.createElement('input');
        temp.value = photo.url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      showToast('Link da foto copiado para a área de transferência!');
    } catch (err) {
      showToast('Não foi possível copiar o link.');
    }
  }

  /**
   * Exibe notificação Toast animada
   */
  let toastTimer;
  function showToast(message) {
    if (!elements.toast || !elements.toastText) return;

    elements.toastText.textContent = message;
    elements.toast.classList.add('is-visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toast.classList.remove('is-visible');
    }, 3200);
  }

  // Executa após DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
