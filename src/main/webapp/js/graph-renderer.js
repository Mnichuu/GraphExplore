export class GraphRenderer {

  /** @type {cytoscape.Core} */
  #cy = null;

  /** Callback wywoływany po kliknięciu węzła: (nodeId) => void */
  onNodeClick = null;
  /** Callback wywoływany po kliknięciu tła: () => void */
  onCanvasClick = null;
  /** Callback wywoływany po zmianie zoom/pan: () => void */
  onViewport = null;

  /**
   * Inicjalizuje Cytoscape w podanym elemencie DOM.
   * @param {string|HTMLElement} container
   */
  init(container) {
    // Rejestruj layout fCoSE (jeśli załadowany)
    if (window.cytoscapeFcose) {
      cytoscape.use(window.cytoscapeFcose);
    }

    this.#cy = cytoscape({
      container: typeof container === 'string'
        ? document.getElementById(container)
        : container,

      elements: [],
      style: this.#buildStyle(),

      minZoom: 0.02,
      maxZoom: 30,
      wheelSensitivity: 0.25,

      // Wydajność dla dużych grafów
      textureOnViewport: true,
      pixelRatio: 'auto',
      hideEdgesOnViewport: false,
      hideLabelsOnViewport: false,
      motionBlur: false,
    });

    this.#bindEvents();
    return this;
  }

  /** Cytoscape instance (w razie potrzeby bezpośredniego dostępu) */
  get cy() { return this.#cy; }

  // == Dane =================================

  /**
   * Dodaje węzły i krawędzie; pomija już istniejące.
   * @param {NodeDTO[]} nodes
   * @param {EdgeDTO[]} edges
   * @param {string[]}  topNodeIds – wyróżnione węzły (PageRank)
   */
  addElements(nodes, edges, topNodeIds = []) {
    const topSet = new Set(topNodeIds);
    const newEls = [];

    for (const n of nodes) {
      if (this.#cy.getElementById(n.id).length > 0) continue;
      newEls.push({
        group: 'nodes',
        data: {
          id:          n.id,
          label:       n.label ?? n.id,
          type:        n.attributes?.type ?? '',
          weight:      n.weight ?? 1,
          highlighted: topSet.has(n.id),
          attrs:       n.attributes ?? {},
        },
        // Jeśli backend wysłał pozycję — użyj jej
        ...(n.x != null && n.y != null ? { position: { x: n.x, y: n.y } } : {}),
      });
    }

    for (const e of edges) {
      const key = e.id ?? `${e.source}→${e.target}`;
      if (this.#cy.getElementById(key).length > 0) continue;
      newEls.push({
        group: 'edges',
        data: {
          id:       key,
          source:   e.source,
          target:   e.target,
          label:    e.label ?? '',
          weight:   e.weight ?? 1,
          directed: e.directed ?? true,
        },
      });
    }

    if (newEls.length > 0) {
      this.#cy.add(newEls);
    }
  }

  /** Usuwa wszystkie elementy i resetuje stan */
  clear() {
    this.#cy.elements().remove();
  }

  /** Liczba węzłów / krawędzi aktualnie w canvasie */
  get elementCount() {
    return {
      nodes: this.#cy.nodes().length,
      edges: this.#cy.edges().length,
    };
  }

  /**
   * Dodaje sąsiadów wokół węzła centralnego w okręgu.
   * Węzeł centralny nie zmienia pozycji.
   * @param {string} centerId - ID klikniętego węzła
   * @param {Array}  nodes    - sąsiedzi do dodania
   * @param {Array}  edges    - krawędzie do dodania
   */
  addNeighbors(centerId, nodes, edges) {
    const center = this.#cy.getElementById(centerId);
    if (!center.length) return;

    const cx = center.position('x');
    const cy = center.position('y');

    // Promień okręgu zależy od liczby sąsiadów
    const radius  = Math.max(120, nodes.length * 25);
    const newEls  = [];
    let   added   = 0;

    for (const n of nodes) {
      if (this.#cy.getElementById(n.id).length > 0) continue;

      // Równomierne rozmieszczenie na okręgu
      const angle = (2 * Math.PI * added) / nodes.length;
      const x     = cx + radius * Math.cos(angle);
      const y     = cy + radius * Math.sin(angle);

      newEls.push({
        group: 'nodes',
        data: {
          id:     n.id,
          label:  n.label ?? n.id,
          type:   n.attributes?.type ?? '',
          weight: n.weight ?? 1,
          attrs:  n.attributes ?? {},
        },
        position: { x, y },
      });
      added++;
    }

    for (const e of edges) {
      const key = e.id ?? `${e.source}→${e.target}`;
      if (this.#cy.getElementById(key).length > 0) continue;
      newEls.push({
        group: 'edges',
        data: {
          id:       key,
          source:   e.source,
          target:   e.target,
          label:    e.label ?? '',
          weight:   e.weight ?? 1,
          directed: e.directed ?? true,
        },
      });
    }

    if (newEls.length > 0) {
      this.#cy.add(newEls);
    }
  }

  /** Ukrywa węzeł i jego krawędzie */
  hideNode(id) {
    const node = this.#cy.getElementById(id);
    if (!node.length) return;
    node.style('display', 'none');
    node.connectedEdges().style('display', 'none');
  }

  /** Ukrywa wszystkich sąsiadów węzła którzy nie mają innych połączeń na canvasie */
  hideNeighbors(id) {
    const node = this.#cy.getElementById(id);
    if (!node.length) return;

    node.neighborhood('node').forEach(neighbor => {
      // Ukryj sąsiada tylko jeśli jedyne jego połączenie na canvasie to ten węzeł
      const visibleConnections = neighbor.connectedEdges()
          .filter(e => e.style('display') !== 'none')
          .connectedNodes()
          .filter(n => n.id() !== neighbor.id() && n.id() !== id);

      if (visibleConnections.length === 0) {
        neighbor.style('display', 'none');
        neighbor.connectedEdges().style('display', 'none');
      }
    });
  }

  // == Layout =================================

  /**
   * Uruchamia layout na wskazanych lub wszystkich elementach.
   * @param {string} name        – fcose | cose | breadthfirst | circle | grid | concentric
   * @param {Object} [options]   – nadpisania domyślnych opcji
   */
  runLayout(name = 'fcose', options = {}) {
    const defaults = this.#layoutDefaults(name);
    const layoutOpts = { name, ...defaults, ...options };

    // fCoSE nie jest dostępny — fallback do cose
    if (name === 'fcose') {
      layoutOpts.name = 'cose';
    }

    this.#cy.layout(layoutOpts).run();
  }

  #layoutDefaults(name) {
    const shared = { animate: true, animationDuration: 500, fit: true, padding: 60 };
    switch (name) {
      case 'fcose':        return { ...shared, quality: 'default', randomize: false,
                                    repulsionStrength: 5500, nodeRepulsion: () => 4500,
                                    idealEdgeLength: () => 80 };
      case 'cose':         return { ...shared, nodeRepulsion: () => 3500, idealEdgeLength: 80 };
      case 'breadthfirst': return { ...shared, directed: true, spacingFactor: 1.4 };
      case 'concentric':   return { ...shared, spacingFactor: 1.5,
                                    concentric: n => n.data('weight'),
                                    levelWidth: () => 2 };
      default:             return shared;
    }
  }

  // == Styl dynamiczny =================================

  /** Zmienia rozmiar bazowy węzłów */
  setNodeSize(px) {
    this.#cy.nodes().style({
      'width':  n => `${px + Math.sqrt(n.data('weight') ?? 1) * 2}px`,
      'height': n => `${px + Math.sqrt(n.data('weight') ?? 1) * 2}px`,
    });
  }

  /**
   * Wyróżnia węzły o najwyższym stopniu (hub nodes).
   * @param {string[]} topNodeIds - lista ID węzłów do wyróżnienia
   */
  setTopNodes(topNodeIds) {
    const topSet = new Set(topNodeIds);

    this.#cy.nodes().forEach(node => {
      if (topSet.has(node.id())) {
        node.data('highlighted', true);
      } else {
        node.data('highlighted', false);
      }
    });
  }

  /** Widoczność etykiet: 'auto' | 'always' | 'never' */
  setLabelVisibility(mode) {
    this._labelMode = mode;
    const show = mode === 'always' || (mode === 'auto' && this.#cy.zoom() > 0.6);
    if (show) {
      this.#cy.nodes().style('label', node => node.data('label'));
    } else {
      this.#cy.nodes().style('label', '');
    }
  }
  /** Etykiety krawędzi włącz/wyłącz */
  setEdgeLabels(show) {
    if (show) {
      this.#cy.edges().style('label', edge => edge.data('label'));
    } else {
      this.#cy.edges().style('label', '');
    }
  }

  // == Zaznaczanie / filtrowanie =================================

  /** Zaznacza węzeł i jego 1-hop sąsiedztwo */
  selectNode(id) {
    this.#cy.elements().removeClass('selected neighbor faded');
    const node = this.#cy.getElementById(id);
    if (!node.length) return;

    const neighborhood = node.closedNeighborhood();
    node.addClass('selected');
    neighborhood.difference(node).addClass('neighbor');
    this.#cy.elements().difference(neighborhood).addClass('faded');
  }

  /** Czyści zaznaczenie */
  clearSelection() {
    this.#cy.elements().removeClass('selected neighbor faded');
  }

  /**
   * Filtruje węzły po etykiecie (string) i minimalnym stopniu.
   * @param {string} labelQuery
   * @param {number} minDegree
   * @param {boolean} hideOrphans
   */
  applyFilter(labelQuery, minDegree = 0, hideOrphans = false) {
    const q = labelQuery.toLowerCase().trim();

    this.#cy.nodes().forEach(n => {
      const label  = (n.data('label') ?? '').toLowerCase();
      const degree = n.degree();

      const matchLabel  = !q || label.includes(q);
      const matchDegree = degree >= minDegree;
      const matchOrphan = !hideOrphans || degree > 0;

      const visible = matchLabel && matchDegree && matchOrphan;
      n.style('display', visible ? 'element' : 'none');
    });

    // Ukryj krawędzie prowadzące do ukrytych węzłów
    this.#cy.edges().forEach(e => {
      const srcVisible = e.source().style('display') !== 'none';
      const tgtVisible = e.target().style('display') !== 'none';
      e.style('display', srcVisible && tgtVisible ? 'element' : 'none');
    });
  }

  /** Resetuje wszystkie filtry */
  resetFilter() {
    this.#cy.elements().style('display', 'element');
  }

  // == Viewport =================================

  fitView() {
    this.#cy.fit(undefined, 60);
  }

  zoomIn()  { this.#cy.zoom({ level: this.#cy.zoom() * 1.3, renderedPosition: this.#center() }); }
  zoomOut() { this.#cy.zoom({ level: this.#cy.zoom() / 1.3, renderedPosition: this.#center() }); }

  #center() {
    const w = this.#cy.width(), h = this.#cy.height();
    return { x: w / 2, y: h / 2 };
  }

  /** Zwraca bounding box viewportu w koordynatach grafu */
  getViewportBounds() {
    const ext = this.#cy.extent();
    return { x: ext.x1, y: ext.y1, w: ext.x2 - ext.x1, h: ext.y2 - ext.y1 };
  }

  getZoom() { return this.#cy.zoom(); }

  // == Eksport PNG =================================

  exportPng() {
    const dataUrl = this.#cy.png({ scale: 2, full: false, bg: 'white', quality: 1 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'graph-export.png';
    a.click();
  }

  // == Style Cytoscape =================================

  #buildStyle() {
    const textPrimary   = getComputedStyle(document.body).getPropertyValue('--text-primary').trim();
    const textSecondary = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
    const textMuted     = getComputedStyle(document.body).getPropertyValue('--text-muted').trim();

    const bgHover       = getComputedStyle(document.body).getPropertyValue('--bg-hover').trim();
    const bgActive      = getComputedStyle(document.body).getPropertyValue('--bg-active').trim();

    const borderMid     = getComputedStyle(document.body).getPropertyValue('--border-mid').trim();

    const accent        = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    const accentDim     = getComputedStyle(document.body).getPropertyValue('--accent-dim').trim();

    return [
      // ========================= NODES =========================
      {
        selector: 'node',
        style: {
          'width':  n => `${18 + Math.sqrt(n.data('weight') ?? 1) * 2}px`,
          'height': n => `${18 + Math.sqrt(n.data('weight') ?? 1) * 2}px`,
          'background-color': bgHover,
          'border-width': 1,
          'border-color': borderMid,
          'label': '',
          'color': textSecondary,
          'font-family': 'IBM Plex Mono, monospace',
          'font-size': 9,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 4,
          'text-wrap': 'ellipsis',
          'text-max-width': '80px',
          'transition-property': 'background-color, border-color, opacity',
          'transition-duration': '150ms',
        },
      },

      {
        selector: 'node[?highlighted]',
        style: {
          'background-color': bgActive,
          'border-color': accent,
          'border-width': 2,
        },
      },

      {
        selector: 'node.selected',
        style: {
          'background-color': accent,
          'border-color': textPrimary,
          'border-width': 2,
          'color': textPrimary,
          'label': 'data(label)',
        },
      },

      {
        selector: 'node.neighbor',
        style: {
          'background-color': accentDim,
          'border-color': accent,
          'label': 'data(label)',
        },
      },

      {
        selector: 'node.faded',
        style: { 'opacity': 0.12 },
      },

      // ========================= EDGES =========================
      {
        selector: 'edge',
        style: {
          'width': n => `${0.8 + Math.log1p(n.data('weight') ?? 1) * 0.4}px`,
          'line-color': textMuted,
          'target-arrow-color': textMuted,
          'target-arrow-shape': e => e.data('directed') ? 'triangle' : 'none',
          'arrow-scale': 0.6,
          'curve-style': 'bezier',
          'label': '',
          'color': textMuted,
          'font-family': 'IBM Plex Mono, monospace',
          'font-size': 8,
          'text-rotation': 'autorotate',
          'transition-property': 'line-color, opacity',
          'transition-duration': '150ms',
        },
      },

      {
        selector: 'edge.neighbor',
        style: {
          'line-color': accent,
          'target-arrow-color': accent,
          'width': 1.5,
        },
      },

      {
        selector: 'edge.faded',
        style: { 'opacity': 0.04 },
      },
    ];
  }

  // == Export =================================
  /**
   * Eksportuje pełny stan wizualizacji do pliku JSON.
   * Zawiera: węzły, krawędzie, pozycje, widoczność, zoom, pan.
   */
  exportState(filename = 'graph-export.json') {
    const state = {
      version:  1,
      exported: new Date().toISOString(),

      graph: this.#cy.json(),

      viewport: {
        zoom: this.#cy.zoom(),
        pan:  this.#cy.pan(),
      },
    };

    const blob = new Blob(
        [JSON.stringify(state, null, 2)],
        { type: 'application/json' }
    );

    const a = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // == Import =================================
  /**
   * Wczytuje stan wizualizacji z obiektu JSON (wcześniej wyeksportowanego).
   * Odtwarza pozycje węzłów, widoczność i viewport.
   */
  importState(stateJson) {
    const state = typeof stateJson === 'string'
        ? JSON.parse(stateJson)
        : stateJson;

    if (!state.graph) throw new Error('Nieprawidłowy format pliku eksportu');

    this.#cy.json(state.graph);

    if (state.viewport) {
      this.#cy.zoom(state.viewport.zoom);
      this.#cy.pan(state.viewport.pan);
    }
  }

  // == Eventy Cytoscape =================================

  #bindEvents() {
    const cy = this.#cy;

    cy.on('tap', 'node', evt => {
      const id = evt.target.id();
      this.selectNode(id);
      this.onNodeClick?.(id);
    });

    cy.on('tap', evt => {
      if (evt.target === cy) {
        this.clearSelection();
        this.onCanvasClick?.();
      }
    });

    cy.on('zoom pan', () => {
      if (this._labelMode === 'auto') {
        const show = cy.zoom() > 0.6;
        if (show) {
          cy.nodes().style('label', node => node.data('label'));
        } else {
          cy.nodes().style('label', '');
        }
      }
      this.onViewport?.();
    });

    cy.on('cxttap', 'node', (evt) => {
      const node    = evt.target;
      const id      = node.id();
      const pos     = evt.renderedPosition;
      const contextMenu = document.getElementById('context-menu');

      // Pokaż menu w miejscu kliknięcia
      contextMenu.style.left    = pos.x + 'px';
      contextMenu.style.top     = pos.y + 'px';
      contextMenu.style.display = 'block';
      contextMenu.dataset.nodeId = id;
    });
  }
}
