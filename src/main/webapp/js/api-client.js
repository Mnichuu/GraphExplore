const BASE = window.APP_CONTEXT ?? '';   // ten sam origin co serwlet Tomcat

export class ApiClient {

  // ── Import ──────────────────────────────────────────

  /**
   * Importuje plik RDF.
   * @param {File} file
   * @param {Object} opts – {lang, directed, blankNodes, literals, maxNodes}
   * @returns {Promise<GraphMetadata>}
   */
  async importRdf(file, opts = {}) {
    const fd = new FormData();
    fd.append('file', file);

    const params = new URLSearchParams({
      lang:       opts.lang       ?? '',
      directed:   opts.directed   ?? true,
      blankNodes: opts.blankNodes ?? true,
      literals:   opts.literals   ?? true,
      maxNodes:   opts.maxNodes   ?? 500_000,
    });

    return this._post(`/api/import/rdf?${params}`, fd);
  }

  /**
   * Importuje plik GraphML lub JSON.
   * @param {File} file
   * @param {Object} opts – {format, directed}
   */
  async importGraph(file, opts = {}) {
    const fd = new FormData();
    fd.append('file', file);

    const params = new URLSearchParams({
      format:   opts.format   ?? '',
      directed: opts.directed ?? true,
    });

    return this._post(`/api/import?${params}`, fd);
  }

  // ── Graf i metadane ─────────────────────────────────

  /** Metadane aktualnie załadowanego grafu */
  async getGraphMeta() {
    return this._get('/api/graph');
  }

  /** Statystyki grafu (stopnie, gęstość, itp.) */
  async getStats() {
    return this._get('/api/stats');
  }

  // ── Węzły i krawędzie ───────────────────────────────

  /**
   * Strona węzłów widocznych w viewporcie.
   * @param {Object} pageReq – {cursor, limit, vx, vy, vw, vh, filter}
   */
  async getNodes(pageReq = {}) {
    const p = new URLSearchParams({
      cursor: pageReq.cursor  ?? '',
      limit:  pageReq.limit   ?? 500,
      vx:     pageReq.vx      ?? 0,
      vy:     pageReq.vy      ?? 0,
      vw:     pageReq.vw      ?? 0,
      vh:     pageReq.vh      ?? 0,
      filter: pageReq.filter  ?? '',
    });
    return this._get(`/api/nodes?${p}`);
  }

  /**
   * Szczegóły węzła + 1-hop sąsiedztwo.
   * @param {string} id
   */
  async getNodeDetail(id) {
    return this._get(`/api/nodes/${encodeURIComponent(id)}`);
  }

  /**
   * Krawędzie węzła.
   * @param {string} id
   */
  async getEdges(id) {
    return this._get(`/api/edges/${encodeURIComponent(id)}`);
  }

  /** Top-N węzłów wg PageRank */
  async getTopNodes(n = 20) {
    return this._get(`/api/nodes/top?n=${n}`);
  }

  // ── Klastry ─────────────────────────────────────────

  async getClusters() {
    return this._get('/api/clusters');
  }

  // ── Eksport ─────────────────────────────────────────

  /** Zwraca URL do pobrania eksportu */
  getExportUrl(format = 'graphml') {
    return `${BASE}/api/export?format=${format}`;
  }

  // ── HTTP helpers ─────────────────────────────────────

  async _get(path) {
    try {
      const res = await fetch(BASE + path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      console.warn('[ApiClient] GET failed, returning mock:', path, err.message);
      return this._mock(path, 'GET');
    }
  }

  async _post(path, body) {
    try {
      const res = await fetch(BASE + path, { method: 'POST', body });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (err) {
      console.warn('[ApiClient] POST failed, returning mock:', path, err.message);
      return this._mock(path, 'POST');
    }
  }

  // ── Demo / mock data (gdy brak backendu) ─────────────

  _mock(path, method) {
    if (path.startsWith('/api/import') && method === 'POST') {
      return DEMO_META;
    }
    if (path.startsWith('/api/graph')) return DEMO_META;
    if (path.startsWith('/api/stats')) return DEMO_STATS;
    if (path.startsWith('/api/nodes/top')) return DEMO_TOP_NODES;
    if (path.match(/\/api\/nodes\/(.+)/)) {
      const id = decodeURIComponent(path.split('/api/nodes/')[1].split('?')[0]);
      return DEMO_NODE_DETAIL(id);
    }
    if (path.startsWith('/api/nodes')) return DEMO_NODES_PAGE;
    return {};
  }
}

// ═══════════════════════════════════════════
//   DANE DEMO — aktywne gdy backend offline
// ═══════════════════════════════════════════

const DEMO_META = {
  id: 'demo-graph',
  nodeCount: 42,
  edgeCount: 78,
  directed: true,
  attributeKeys: ['label', 'type', 'description'],
  extraInfo: {
    triples: 312,
    prefixes: { foaf: 'http://xmlns.com/foaf/0.1/', ex: 'http://example.org/' },
    source: 'DEMO MODE — backend offline'
  }
};

const DEMO_STATS = {
  avgDegree: 3.71,
  density: 0.089,
  maxDegree: 12,
  minDegree: 1,
  diameter: 6,
  components: 2,
};

// Generuj siatkę węzłów demo
function makeDemoNodes(n = 42) {
  const types = ['foaf:Person', 'foaf:Organization', 'schema:Place', 'ex:Event'];
  const nodes = [];
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `ex:node${i}`,
      label: `Węzeł ${i}`,
      attributes: {
        type: types[i % types.length],
        description: `Demo węzeł numer ${i}`,
      },
      x: (Math.random() - 0.5) * 1200,
      y: (Math.random() - 0.5) * 900,
      weight: Math.random() * 10 + 1,
    });
  }
  return nodes;
}

function makeDemoEdges(nodes) {
  const edges = [];
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const targets = new Set();
    const degree = Math.floor(Math.random() * 4) + 1;
    for (let d = 0; d < degree; d++) {
      const t = Math.floor(Math.random() * n);
      if (t !== i && !targets.has(t)) {
        targets.add(t);
        edges.push({
          id:       `e${i}-${t}`,
          source:   nodes[i].id,
          target:   nodes[t].id,
          label:    'ex:relatedTo',
          directed: true,
          weight:   1.0,
        });
      }
    }
  }
  return edges;
}

const _demoNodes = makeDemoNodes(42);
const _demoEdges = makeDemoEdges(_demoNodes);

const DEMO_NODES_PAGE = {
  nodes: _demoNodes,
  edges: _demoEdges,
  nextCursor: null,
  version: 1,
};

const DEMO_TOP_NODES = _demoNodes
  .slice()
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 10)
  .map(n => n.id);

function DEMO_NODE_DETAIL(id) {
  const node = _demoNodes.find(n => n.id === id) ?? _demoNodes[0];
  return {
    id: node.id,
    label: node.label,
    attributes: { ...node.attributes, weight: node.weight.toFixed(2) },
    degree: Math.floor(Math.random() * 10) + 1,
    edges: _demoEdges.filter(e => e.source === node.id || e.target === node.id).slice(0, 10),
  };
}
