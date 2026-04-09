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
    if (name === 'fcose' && !this.#cy.layoutRegistered('fcose')) {
      layoutOpts.name = 'cose';
    }

    this.#cy.layout(layoutOpts).run();
  }

  #layoutDefaults(name) {
    const shared = { animate: true, animationDuration: 500, fit: true, padding: 60 };
    switch (name) {
      case 'fcose':        return { ...shared, quality: 'default', randomize: false,
                                    repulsionStrength: 4500, nodeRepulsion: () => 4500,
                                    idealEdgeLength: () => 80 };
      case 'cose':         return { ...shared, nodeRepulsion: () => 4500, idealEdgeLength: 80 };
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

  /** Widoczność etykiet: 'auto' | 'always' | 'never' */
  setLabelVisibility(mode) {
    const z = this.#cy.zoom();
    const show = mode === 'always' || (mode === 'auto' && z > 0.6);
    this.#cy.nodes().style('label', show ? 'data(label)' : '');
    this._labelMode = mode;
  }

  /** Etykiety krawędzi włącz/wyłącz */
  setEdgeLabels(show) {
    this.#cy.edges().style('label', show ? 'data(label)' : '');
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
    const dataUrl = this.#cy.png({ scale: 2, full: false, bg: '#080a0d' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'graph-export.png';
    a.click();
  }

  // == Style Cytoscape =================================

  #buildStyle() {
    return [
      // ================================= Węzły =================================
      {
        selector: 'node',
        style: {
          'width':            n => `${18 + Math.sqrt(n.data('weight') ?? 1) * 2}px`,
          'height':           n => `${18 + Math.sqrt(n.data('weight') ?? 1) * 2}px`,
          'background-color': '#1c2230',
          'border-width':     1,
          'border-color':     'rgba(255,255,255,0.15)',
          'label':            '',   // domyślnie bez etykiet (auto przy zoom)
          'color':            '#8892a0',
          'font-family':      'IBM Plex Mono, monospace',
          'font-size':        9,
          'text-valign':      'bottom',
          'text-halign':      'center',
          'text-margin-y':    4,
          'text-wrap':        'ellipsis',
          'text-max-width':   '80px',
          'transition-property': 'background-color, border-color, opacity',
          'transition-duration': '150ms',
        },
      },
      // Wyróżnione (PageRank top)
      {
        selector: 'node[?highlighted]',
        style: {
          'background-color': '#0e2a3a',
          'border-color':     '#00c8ff',
          'border-width':     2,
        },
      },
      // Zaznaczony
      {
        selector: 'node.selected',
        style: {
          'background-color': '#00c8ff',
          'border-color':     '#ffffff',
          'border-width':     2,
          'color':            '#ffffff',
          'label':            'data(label)',
        },
      },
      // Sąsiad zaznaczonego
      {
        selector: 'node.neighbor',
        style: {
          'background-color': '#1e3a4a',
          'border-color':     'rgba(0,200,255,0.5)',
          'label':            'data(label)',
        },
      },
      // Wyszarzony
      {
        selector: 'node.faded',
        style: { 'opacity': 0.12 },
      },

      // ================================= Krawędzie =================================
      {
        selector: 'edge',
        style: {
          'width':               n => `${0.8 + Math.log1p(n.data('weight') ?? 1) * 0.4}px`,
          'line-color':          'rgba(255,255,255,0.08)',
          'target-arrow-color':  'rgba(255,255,255,0.08)',
          'target-arrow-shape':  e => e.data('directed') ? 'triangle' : 'none',
          'arrow-scale':         0.6,
          'curve-style':         'bezier',
          'label':               '',
          'color':               '#4a5568',
          'font-family':         'IBM Plex Mono, monospace',
          'font-size':           8,
          'text-rotation':       'autorotate',
          'transition-property': 'line-color, opacity',
          'transition-duration': '150ms',
        },
      },
      // Krawędź sąsiada zaznaczonego
      {
        selector: 'edge.neighbor',
        style: {
          'line-color':         'rgba(0,200,255,0.4)',
          'target-arrow-color': 'rgba(0,200,255,0.4)',
          'width':              1.5,
        },
      },
      {
        selector: 'edge.faded',
        style: { 'opacity': 0.04 },
      },
    ];
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
      // Auto-etykiety przy dużym zbliżeniu
      if (this._labelMode === 'auto') {
        const show = cy.zoom() > 0.6;
        cy.nodes().style('label', show ? 'data(label)' : '');
      }
      this.onViewport?.();
    });
  }
}
