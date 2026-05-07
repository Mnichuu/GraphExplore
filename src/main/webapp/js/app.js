import { ApiClient }       from '/GraphExplore_war_exploded/js/api-client.js';
import { GraphRenderer }   from '/GraphExplore_war_exploded/js/graph-renderer.js';
import { ViewportManager } from '/GraphExplore_war_exploded/js/viewport-manager.js';

// == Instancje =================================
const api      = new ApiClient();
const renderer = new GraphRenderer();
const vpm      = new ViewportManager(api, renderer);

// == Stan aplikacji =================================
const state = {
  selectedFile:  null,
  graphLoaded:   false,
  nodeCount:     0,
  edgeCount:     0,
  activeLayout:  'fcose',
  labelMode:     'auto',
  edgeLabels:    false,
  highlightTop:  true,
};

// =================================
//   INICJALIZACJA
// =================================

document.addEventListener('DOMContentLoaded', () => {
  renderer.init('cy');
  bindViewportManager();
  bindImport();
  bindFilter();
  bindLayout();
  bindStyle();
  bindZoomControls();
  bindDetailPanel();
  bindCollapsibles();
  bindKeyboard();

  // Reaguj na kliknięcia węzłów
  renderer.onNodeClick = async (id) => {
    showNodeDetail(id);
    try {
      const neighborhood = await api.getNeighbors(id);

      renderer.addNeighbors(id, neighborhood.nodes, neighborhood.edges);

      const newCount = neighborhood.nodes.length;
      setStatus(`${newCount} nowych sąsiadów`);
      updateTopbarStats();
    } catch (e) {
      console.warn('Błąd ładowania sąsiedztwa:', e);
    }
  };
  renderer.onCanvasClick = () => closeDetailPanel();

  // Aktualizuj licznik zoom
  renderer.onViewport = () => {
    updateZoomLabel();
    vpm.onViewport?.();
  };

  toast('Tryb demo — zaimportuj plik lub podłącz backend', 'warn', 4000);
});

// =================================
//   VIEWPORT MANAGER callbacks
// =================================

function bindViewportManager() {
  vpm.onLoadStart = () => {
    setStatus('Ładowanie węzłów…');
  };

  vpm.onLoadEnd = ({ nodes, edges }) => {
    const c = renderer.elementCount;
    state.nodeCount = c.nodes;
    state.edgeCount = c.edges;
    updateTopbarStats();
    setStatus('Gotowy');

    // Po załadowaniu pierwszej partii — włącz layout
    if (c.nodes > 0 && !state.graphLoaded) {
      state.graphLoaded = true;
      document.getElementById('empty-state').classList.add('hidden');
      renderer.runLayout(state.activeLayout);
    }
  };

  vpm.onError = err => {
    console.error(err);
    setStatus('Błąd: ' + err.message, true);
  };
}

// =================================
//   IMPORT
// =================================

function bindImport() {
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const btnImport = document.getElementById('btn-import');

  // Klik na drop zone
  dropZone.addEventListener('click', () => fileInput.click());

  // Drag & drop
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  });

  // Wybór przez dialog
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) selectFile(fileInput.files[0]);
  });

  // Drag na cały canvas
  document.querySelector('.canvas-wrap').addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  document.querySelector('.canvas-wrap').addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  });

  // Przycisk importu
  btnImport.addEventListener('click', doImport);
}

function selectFile(file) {
  state.selectedFile = file;
  const label = document.querySelector('.drop-label');
  const sub   = document.querySelector('.drop-sub');
  label.textContent = file.name;
  sub.textContent   = formatSize(file.size);
  document.getElementById('btn-import').disabled = false;

  // Auto-detect formatu z rozszerzenia
  const ext = file.name.split('.').pop().toLowerCase();
  const formatMap = {
    ttl: 'turtle', nt: 'ntriples', nq: 'nquads',
    jsonld: 'jsonld', rdf: 'rdfxml', owl: 'rdfxml',
    graphml: 'graphml', xml: 'graphml', json: 'json',
  };
  const detected = formatMap[ext] ?? '';
  document.getElementById('format-select').value = detected;
}

async function doImport() {
  if (!state.selectedFile) return;

  const file     = state.selectedFile;
  const format   = document.getElementById('format-select').value;
  const directed = document.getElementById('opt-directed').checked;
  const blanks   = document.getElementById('opt-blanks').checked;
  const literals = document.getElementById('opt-literals').checked;
  const all = document.getElementById('opt-all').checked;
  const maxNodes = 500_000;

  const btn      = document.getElementById('btn-import');
  const btnText  = btn.querySelector('.btn-text');
  const btnLoad  = btn.querySelector('.btn-loader');
  const progress = document.getElementById('progress-wrap');
  const progBar  = document.getElementById('progress-bar');
  const progLbl  = document.getElementById('progress-label');

  // UI - stan ładowania
  btn.disabled = true;
  btnText.hidden = true;
  btnLoad.hidden = false;
  progress.hidden = false;
  progBar.style.width = '5%';
  progLbl.textContent = 'Wysyłanie pliku…';

  try {
    const isRdf = ['turtle','ntriples','nquads','jsonld','rdfxml',''].includes(format)
               && !['graphml','json'].includes(format);

    progBar.style.width = '30%';
    progLbl.textContent = 'Parsowanie…';

    let meta;
    if (isRdf) {
      meta = await api.importRdf(file, { lang: format, directed, blankNodes: blanks, literals, all, maxNodes });
    } else {
      meta = await api.importGraph(file, { format, directed });
    }

    progBar.style.width = '70%';
    progLbl.textContent = 'Budowanie grafu…';

    // Aktualizuj topbar
    document.getElementById('stat-format').textContent = format || detectFormatLabel(file.name);
    document.getElementById('stat-nodes').textContent  = fmtNum(meta.nodeCount) + ' węzłów';
    document.getElementById('stat-edges').textContent  = fmtNum(meta.edgeCount) + ' krawędzi';

    // Pobierz top węzły (PageRank) do wyróżnienia
    let topNodes = [];
    if (state.highlightTop) {
      try { topNodes = await api.getTopNodes(20); } catch (_) {}
    }

    progBar.style.width = '90%';
    progLbl.textContent = 'Renderowanie…';

    // Reset renderera i załaduj dane
    state.graphLoaded = false;
    renderer.clear();
    document.getElementById('empty-state').classList.remove('hidden');

    await vpm.reload();

    progBar.style.width = '100%';
    progLbl.textContent = 'Gotowe!';

    toast(`Załadowano ${fmtNum(meta.nodeCount)} węzłów, ${fmtNum(meta.edgeCount)} krawędzi`, 'ok');

    setTimeout(() => { progress.hidden = true; progBar.style.width = '0%'; }, 1500);

    if (meta.extraInfo?.source) {
      toast(meta.extraInfo.source, 'warn', 5000);
    }

  } catch (err) {
    toast('Błąd importu: ' + err.message, 'err');
    progLbl.textContent = 'Błąd: ' + err.message;
    progBar.style.background = 'var(--accent-err)';
  } finally {
    btn.disabled = false;
    btnText.hidden = false;
    btnLoad.hidden = true;
  }
}

// =================================
//   FILTROWANIE
// =================================

function bindFilter() {
  const labelInput = document.getElementById('filter-label');
  const clearBtn   = document.getElementById('filter-clear');
  const degSlider  = document.getElementById('filter-degree');
  const degVal     = document.getElementById('filter-degree-val');
  const orphanChk  = document.getElementById('filter-orphans');
  const resetBtn   = document.getElementById('btn-filter-reset');

  function applyFilters() {
    renderer.applyFilter(
      labelInput.value,
      parseInt(degSlider.value),
      orphanChk.checked,
    );
    updateVisibleCount();
  }

  labelInput.addEventListener('input', () => {
    clearBtn.hidden = !labelInput.value;
    applyFilters();
  });

  clearBtn.addEventListener('click', () => {
    labelInput.value = '';
    clearBtn.hidden = true;
    applyFilters();
  });

  degSlider.addEventListener('input', () => {
    degVal.textContent = degSlider.value;
    applyFilters();
  });

  orphanChk.addEventListener('change', applyFilters);

  resetBtn.addEventListener('click', () => {
    labelInput.value   = '';
    degSlider.value    = 0;
    degVal.textContent = '0';
    orphanChk.checked  = false;
    clearBtn.hidden    = true;
    renderer.resetFilter();
    updateVisibleCount();
  });
}

// =================================
//   LAYOUT
// =================================

function bindLayout() {
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeLayout = btn.dataset.layout;
      if (state.graphLoaded) renderer.runLayout(state.activeLayout);
    });
  });
}

// =================================
//   STYL / WYGLĄD
// =================================

function bindStyle() {
  const sizeSlider = document.getElementById('style-node-size');
  sizeSlider.addEventListener('input', () => {
    document.getElementById('style-node-size-val').textContent = sizeSlider.value;
    renderer.setNodeSize(parseInt(sizeSlider.value));
  });

  document.getElementById('style-label-vis').addEventListener('change', e => {
    state.labelMode = e.target.value;
    renderer.setLabelVisibility(e.target.value);
  });

  document.getElementById('style-edge-labels').addEventListener('change', e => {
    state.edgeLabels = e.target.checked;
    renderer.setEdgeLabels(e.target.checked);
  });

  document.getElementById('style-highlight-top').addEventListener('change', e => {
    state.highlightTop = e.target.checked;
  });

  // Topbar
  document.getElementById('btn-fit').addEventListener('click', () => renderer.fitView());
  document.getElementById('btn-screenshot').addEventListener('click', () => renderer.exportPng());

  const toggle = document.getElementById('opt-lightdarkmode');
  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  });
}

// =================================
//   ZOOM CONTROLS
// =================================

function bindZoomControls() {
  document.getElementById('zoom-in') .addEventListener('click', () => renderer.zoomIn());
  document.getElementById('zoom-out').addEventListener('click', () => renderer.zoomOut());
  document.getElementById('zoom-fit').addEventListener('click', () => renderer.fitView());

  // Aktualizuj poziom
  renderer.onViewport = () => updateZoomLabel();
}

function updateZoomLabel() {
  const pct = Math.round(renderer.getZoom() * 100);
  document.getElementById('zoom-level').textContent = pct + '%';
}

// =================================
//   PANEL SZCZEGÓŁÓW WĘZŁA
// =================================

function bindDetailPanel() {
  document.getElementById('detail-close').addEventListener('click', closeDetailPanel);
}

async function showNodeDetail(id) {
  const panel = document.getElementById('detail-panel');
  const body  = document.getElementById('detail-body');
  const title = document.getElementById('detail-title');
  const contextMenu = document.getElementById('context-menu');

  panel.classList.add('open');
  title.textContent = 'Ładowanie…';
  body.innerHTML = '<div class="detail-placeholder">Pobieranie danych…</div>';

  try {
    const detail = await api.getNodeDetail(id);

    title.textContent = detail.label ?? shortenId(detail.id);
    body.innerHTML = buildNodeDetailHTML(detail);

    // Sąsiedztwo
    const neighborsSection = document.getElementById('neighbors-section');
    const neighborList     = document.getElementById('neighbor-list');
    if (detail.edges?.length > 0) {
      neighborsSection.hidden = false;
      neighborList.innerHTML  = detail.edges.slice(0, 30).map(e => {
        const isOut = e.source === detail.id;
        const other = isOut ? e.target : e.source;
        return `
          <div class="neighbor-item" data-id="${other}" title="${other}">
            <span class="neighbor-dir">${isOut ? '→' : '←'}</span>
            <span class="neighbor-label">${shortenId(other)}</span>
            <span class="neighbor-pred">${shortenId(e.label ?? '')}</span>
          </div>`;
      }).join('');

      // Klik sąsiada → zaznacz go
      neighborList.querySelectorAll('.neighbor-item').forEach(el => {
        el.addEventListener('click', () => {
          const nid = el.dataset.id;
          renderer.selectNode(nid);
          showNodeDetail(nid);
        });
      });
    } else {
      neighborsSection.hidden = true;
    }

    // Status bar
    document.getElementById('status-selected').textContent =
      `${detail.label ?? id}  ·  stopień: ${detail.degree}`;

  } catch (err) {
    body.innerHTML = `<div class="detail-placeholder" style="color:var(--accent-err)">Błąd: ${err.message}</div>`;
  }
}

function closeDetailPanel() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('neighbors-section').hidden = true;
  document.getElementById('status-selected').textContent = 'Brak zaznaczenia';
  renderer.clearSelection();
}

function buildNodeDetailHTML(detail) {
  const attrRows = Object.entries(detail.attributes ?? {})
    .filter(([k]) => k !== 'label')
    .map(([k, v]) => `
      <tr>
        <td class="attr-key">${escHtml(k)}</td>
        <td class="attr-val">${escHtml(String(v))}</td>
      </tr>`)
    .join('');

  return `
    <div class="node-id">${escHtml(detail.id)}</div>
    ${detail.attributes?.type
      ? `<span class="node-badge">${escHtml(detail.attributes.type)}</span>`
      : ''}

    <div class="detail-stat-row">
      <span class="detail-stat-key">Stopień</span>
      <span class="detail-stat-value">${detail.degree ?? '?'}</span>
    </div>
    <div class="detail-stat-row">
      <span class="detail-stat-key">Sąsiedzi</span>
      <span class="detail-stat-value">${detail.edges?.length ?? 0}</span>
    </div>

    ${attrRows ? `
    <table class="attrs-table" style="margin-top:14px">
      <thead><tr><th>Atrybut</th><th>Wartość</th></tr></thead>
      <tbody>${attrRows}</tbody>
    </table>` : ''}
  `;
}

// =================================
//   COLLAPSIBLE SECTIONS
// =================================

function bindCollapsibles() {
  document.querySelectorAll('.section-header.collapsible').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.target;
      const body     = document.getElementById(targetId);
      if (!body) return;
      const collapsed = body.classList.toggle('hidden');
      header.classList.toggle('collapsed', collapsed);
    });
  });
}

// =================================
//   PRAWY PRZYCISK
// =================================

// Menu kontekstowe — prawy klik na węźle
const contextMenu = document.getElementById('context-menu');

// Klik poza menu — ukryj je
document.addEventListener('click', () => {
  contextMenu.style.display = 'none';
});

// Akcje menu
document.getElementById('ctx-hide-node').addEventListener('click', () => {
  const id = contextMenu.dataset.nodeId;
  renderer.hideNode(id);
  contextMenu.style.display = 'none';
  updateTopbarStats();
});

document.getElementById('ctx-hide-neighbors').addEventListener('click', () => {
  const id = contextMenu.dataset.nodeId;
  renderer.hideNeighbors(id);
  contextMenu.style.display = 'none';
  updateTopbarStats();
});

// =================================
//   KLAWIATURA
// =================================

function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'f': case 'F': renderer.fitView();   break;
      case 'Escape':      closeDetailPanel();    break;
      case '+': case '=': renderer.zoomIn();    break;
      case '-':           renderer.zoomOut();   break;
    }
  });
}

// =================================
//   TOAST NOTIFICATIONS
// =================================

/**
 * @param {string} msg
 * @param {'ok'|'err'|'warn'|'info'} type
 * @param {number} duration ms
 */
function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-dot"></span><span>${escHtml(msg)}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// =================================
//   UI HELPERS
// =================================

function updateTopbarStats() {
  const c = renderer.elementCount;
  state.nodeCount = c.nodes;
  state.edgeCount = c.edges;
  document.getElementById('stat-nodes').textContent   = fmtNum(state.nodeCount) + ' węzłów';
  document.getElementById('stat-edges').textContent   = fmtNum(state.edgeCount) + ' krawędzi';
  updateVisibleCount();
}

function updateVisibleCount() {
  const visible = renderer.cy?.nodes(':visible').length ?? 0;
  document.getElementById('stat-visible').textContent = fmtNum(visible) + ' widocznych';
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.style.color = isError ? 'var(--accent-err)' : '';
}

function detectFormatLabel(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { ttl: 'Turtle', nt: 'N-Triples', nq: 'N-Quads',
                jsonld: 'JSON-LD', rdf: 'RDF/XML', owl: 'OWL',
                graphml: 'GraphML', json: 'JSON' };
  return map[ext] ?? ext.toUpperCase();
}

function shortenId(uri) {
  if (!uri) return '';
  const hash  = uri.lastIndexOf('#');
  const slash = uri.lastIndexOf('/');
  const pos   = Math.max(hash, slash);
  if (pos >= 0 && pos < uri.length - 1) return uri.substring(pos + 1);
  return uri.length > 40 ? uri.substring(0, 38) + '…' : uri;
}

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString('pl-PL');
}

function formatSize(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
