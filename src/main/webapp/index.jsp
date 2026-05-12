<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Graph Explorer</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">

  <!-- Cytoscape.js -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.29.2/cytoscape.min.js"></script>
  <!-- fCoSE layout (force-directed, duże grafy) -->
  <script src="https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js"></script>
</head>
<body>

<!-- ═══════════════════════════════════════ TOP BAR ═══ -->
<header class="topbar">
  <div class="topbar-brand">
    <span class="brand-icon">⬡</span>
    <span class="brand-name">Graph Explorer</span>
  </div>

  <div class="topbar-stats" id="topbar-stats">
    <span class="stat-pill" id="stat-nodes">— węzłów</span>
    <span class="stat-pill" id="stat-edges">— krawędzi</span>
    <span class="stat-pill" id="stat-visible">— widocznych</span>
    <span class="stat-pill stat-format" id="stat-format">brak grafu</span>
  </div>

  <div class="topbar-actions">
    <div class="option-row">
      <label class="toggle-label">
        <input type="checkbox" id="opt-lightdarkmode">
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        Tryb ciemny/jasny
      </label>
    </div>
    <button class="btn-icon" id="btn-fit"          title="Dopasuj widok (F)">⊡</button>
    <button class="btn-icon" id="btn-export-state" title="Eksport stanu (.json)">↓</button>
    <button class="btn-icon" id="btn-import-state" title="Import stanu (.json)">↑</button>
    <button class="btn-icon" id="btn-screenshot"   title="Zapisz obraz PNG">⬡</button>
    <button class="btn-icon" id="btn-settings"     title="Ustawienia">⚙</button>
  </div>
</header>

<!-- ═══════════════════════════════════════ LAYOUT ═══ -->
<div class="workspace">

  <!-- ══════════════ LEWY PANEL ══════════════ -->
  <aside class="sidebar" id="sidebar">

    <!-- Import -->
    <section class="panel-section">
      <div class="section-header">
        <span class="section-title">Import grafu</span>
      </div>

      <div class="drop-zone" id="drop-zone">
        <div class="drop-icon">⬆</div>
        <div class="drop-label">Upuść plik lub kliknij</div>
        <div class="drop-sub">GraphML · Turtle · N-Triples · JSON-LD · RDF/XML</div>
        <input type="file" id="file-input" accept=".graphml,.ttl,.nt,.nq,.jsonld,.rdf,.owl,.json,.xml" hidden>
      </div>

      <div class="import-options" id="import-options">
        <div class="option-row">
          <label class="option-label">Format</label>
          <select class="select" id="format-select">
            <option value="">Auto-detect</option>
            <optgroup label="RDF">
              <option value="turtle">Turtle (.ttl)</option>
              <option value="ntriples">N-Triples (.nt)</option>
              <option value="nquads">N-Quads (.nq)</option>
              <option value="jsonld">JSON-LD (.jsonld)</option>
              <option value="rdfxml">RDF/XML (.rdf .owl)</option>
            </optgroup>
            <optgroup label="Grafy">
              <option value="graphml">GraphML (.graphml)</option>
              <option value="json">JSON Graph</option>
            </optgroup>
          </select>
        </div>

        <div class="option-row">
          <label class="toggle-label">
            <input type="checkbox" id="opt-directed" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Graf skierowany
          </label>
        </div>

        <div class="option-row">
          <label class="toggle-label">
            <input type="checkbox" id="opt-blanks" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Blank nodes
          </label>
        </div>

        <div class="option-row">
          <label class="toggle-label">
            <input type="checkbox" id="opt-literals" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Literały jako atrybuty
          </label>
        </div>

        <div class="option-row">
          <label class="toggle-label">
            <input type="checkbox" id="opt-all" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Załadować cały
          </label>
        </div>

        <button class="btn-primary" id="btn-import" disabled>
          <span class="btn-text">Importuj</span>
          <span class="btn-loader" hidden>●●●</span>
        </button>
      </div>

      <!-- Pasek postępu -->
      <div class="progress-bar-wrap" id="progress-wrap" hidden>
        <div class="progress-bar" id="progress-bar"></div>
        <div class="progress-label" id="progress-label">Ładowanie…</div>
      </div>
    </section>

    <div class="divider"></div>

    <!-- Filtrowanie -->
    <section class="panel-section">
      <div class="section-header collapsible" data-target="filter-body">
        <span class="section-title">Filtrowanie</span>
        <span class="collapse-icon">▾</span>
      </div>
      <div class="section-body" id="filter-body">

        <div class="search-wrap">
          <span class="search-icon">⌕</span>
          <input type="text" class="search-input" id="filter-label" placeholder="Szukaj po etykiecie…">
          <button class="clear-btn" id="filter-clear" hidden>✕</button>
        </div>

        <div class="option-row">
          <label class="option-label">Min. stopień</label>
          <input type="range" id="filter-degree" min="0" max="100" value="0" class="slider">
          <span class="slider-val" id="filter-degree-val">0</span>
        </div>

        <div class="option-row">
          <label class="toggle-label">
            <input type="checkbox" id="filter-orphans">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Ukryj izolowane
          </label>
        </div>

        <button class="btn-secondary" id="btn-filter-reset">Resetuj filtry</button>
      </div>
    </section>

    <div class="divider"></div>

    <!-- Layout -->
    <section class="panel-section">
      <div class="section-header collapsible" data-target="layout-body">
        <span class="section-title">Layout</span>
        <span class="collapse-icon">▾</span>
      </div>
      <div class="section-body" id="layout-body">
        <div class="layout-grid">
          <button class="layout-btn active" data-layout="fcose">fCoSE</button>
          <button class="layout-btn" data-layout="cose">CoSE</button>
          <button class="layout-btn" data-layout="breadthfirst">BFS</button>
          <button class="layout-btn" data-layout="circle">Okrąg</button>
          <button class="layout-btn" data-layout="grid">Siatka</button>
          <button class="layout-btn" data-layout="concentric">Koncentr.</button>
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <!-- Wygląd -->
    <section class="panel-section">
      <div class="section-header collapsible" data-target="style-body">
        <span class="section-title">Wygląd</span>
        <span class="collapse-icon">▾</span>
      </div>
      <div class="section-body" id="style-body">
        <div class="option-row">
          <label class="option-label">Rozmiar węzłów</label>
          <input type="range" id="style-node-size" min="4" max="60" value="18" class="slider">
          <span class="slider-val" id="style-node-size-val">18</span>
        </div>

        <div class="option-row">
          <label class="option-label">Etykiety węzłów</label>
          <select class="select" id="style-label-vis">
            <option value="auto">Auto (zoom)</option>
            <option value="always">Zawsze</option>
            <option value="never">Nigdy</option>
          </select>
        </div>

        <div class="option-row">
          <label class="toggle-label">
            <input type="checkbox" id="style-edge-labels">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Etykiety krawędzi
          </label>
        </div>

        <div class="option-row">
          <label class="toggle-label">
            <input type="checkbox" id="style-highlight-top" checked>
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            Wyróżnij ważne węzły
          </label>
        </div>
      </div>
    </section>

  </aside>

  <!-- ══════════════ CANVAS ══════════════ -->
  <main class="canvas-wrap">

    <!-- Nakładka pustego stanu -->
    <div class="empty-state" id="empty-state">
      <div class="empty-icon">⬡</div>
      <div class="empty-title">Brak załadowanego grafu</div>
      <div class="empty-sub">Zaimportuj plik z lewego panelu lub upuść go tutaj.</div>
    </div>

    <!-- Kontener Cytoscape -->
    <div id="cy"></div>

    <!-- Mini-mapa -->
    <div class="minimap-wrap" id="minimap-wrap" hidden>
      <canvas id="minimap" width="160" height="120"></canvas>
    </div>

    <!-- Kontrolki zoom -->
    <div class="zoom-controls">
      <button class="zoom-btn" id="zoom-in"  title="+">+</button>
      <span   class="zoom-level" id="zoom-level">100%</span>
      <button class="zoom-btn" id="zoom-out" title="−">−</button>
      <button class="zoom-btn" id="zoom-fit" title="Dopasuj">⊡</button>
    </div>

    <!-- Pasek stanu (dół) -->
    <div class="status-bar" id="status-bar">
      <span id="status-msg">Gotowy</span>
      <span class="status-sep">·</span>
      <span id="status-selected">Brak zaznaczenia</span>
    </div>
  </main>

  <!-- ══════════════ PRAWY PANEL (szczegóły) ══════════════ -->
  <aside class="detail-panel" id="detail-panel">
    <div class="detail-header">
      <span class="detail-title" id="detail-title">Szczegóły węzła</span>
      <button class="btn-icon close-btn" id="detail-close">✕</button>
    </div>

    <div class="detail-body" id="detail-body">
      <div class="detail-placeholder">Kliknij węzeł, aby zobaczyć szczegóły.</div>
    </div>

    <!-- Sekcja sąsiedztwa -->
    <div class="detail-section" id="neighbors-section" hidden>
      <div class="section-header collapsible" data-target="neighbors-body">
        <span class="section-title">Sąsiedztwo (1-hop)</span>
        <span class="collapse-icon">▾</span>
      </div>
      <div class="section-body" id="neighbors-body">
        <div class="neighbor-list" id="neighbor-list"></div>
      </div>
    </div>
  </aside>


</div><!-- /.workspace -->

<!-- ═══ TOAST ═══ -->
<div class="toast-container" id="toast-container"></div>

<script type="module" src="js/api-client.js"></script>
<script type="module" src="js/graph-renderer.js"></script>
<script type="module" src="js/viewport-manager.js"></script>
<script type="module" src="js/app.js"></script>
<script>
  window.APP_CONTEXT = '${pageContext.request.contextPath}';
</script>
<!-- Menu kontekstowe węzła -->
<div id="context-menu" style="display:none; position:fixed; z-index:500;">
  <button id="ctx-hide-node">Ukryj węzeł</button>
  <button id="ctx-hide-neighbors">Ukryj sąsiadów</button>
</div>
</body>
</html>
