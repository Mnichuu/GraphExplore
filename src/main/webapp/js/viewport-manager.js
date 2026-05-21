/**
 * viewport-manager.js
 * Odpowiada za stronicowane ładowanie węzłów na podstawie
 * aktualnego viewportu Cytoscape (widoczny obszar + bufor).
 */

export class ViewportManager {

  #api    = null;   // ApiClient
  #renderer = null; // GraphRenderer

  #cursor   = null;
  #loading  = false;
  #done     = false;   // brak więcej danych na serwerze
  #version  = 0;       // wersja grafu — reset przy nowym imporcie
  #timer    = null;

  // Callbacks
  onLoadStart  = null;   // () => void
  onLoadEnd    = null;   // ({nodes, edges, total}) => void
  onError      = null;   // (err) => void

  /**
   * @param {import('./api-client.js').ApiClient}    api
   * @param {import('./graph-renderer.js').GraphRenderer} renderer
   */
  constructor(api, renderer) {
    this.#api = api;
    this.#renderer = renderer;

    // Reaguj na przesunięcie / zoom
    renderer.onViewport = () => this.#schedule(300);
  }

  // == Publiczne API =================================

  /**
   * Ładuje pierwszą stronę po imporcie / resecie.
   * Czyści canvas i zaczyna od nowa.
   */
  async reload() {
    this.#cursor  = null;
    this.#done    = false;
    this.#loading = false;
    this.#renderer.clear();
    await this.#loadPage();
  }

  // == Wewnętrzne =================================

  #schedule(delay = 250) {
    clearTimeout(this.#timer);
    if (this.#done) return;
    this.#timer = setTimeout(() => this.#loadPage(), delay);
  }

  async #loadPage() {
    if (this.#loading || this.#done) return;
    this.#loading = true;
    this.onLoadStart?.();

    try {
      const vp     = this.#renderer.getViewportBounds();
      const zoom   = this.#renderer.getZoom();
      const buffer = 300 / Math.max(zoom, 0.05); // bufor rośnie przy oddaniu

      const page = await this.#api.getNodes({
        cursor: this.#cursor,
        limit:  this.#pageSize(zoom),
        vx: vp.x - buffer,
        vy: vp.y - buffer,
        vw: vp.w + buffer * 2,
        vh: vp.h + buffer * 2,
        all: true,
      });

      // Wykryj reset serwera (nowy import)
      if (page.version && page.version !== this.#version && this.#version !== 0) {
        this.#version = page.version;
        this.#cursor  = null;
        this.#done    = false;
        this.#renderer.clear();
      }
      if (page.version) this.#version = page.version;

      // Wgraj do renderera
      this.#renderer.addElements(page.nodes ?? [], page.edges ?? [], page.topNodes);

      this.#cursor = page.nextCursor ?? null;
      this.#done   = !page.nextCursor;

      this.onLoadEnd?.({
        nodes: page.nodes?.length ?? 0,
        edges: page.edges?.length ?? 0,
      });

      // Jeśli jest więcej i viewport się nie ruszył — ładuj dalej z opóźnieniem
      if (!this.#done) {
        this.#schedule(600);
      }

    } catch (err) {
      this.onError?.(err);
    } finally {
      this.#loading = false;
    }
  }

  /** Limit na stronę zależy od poziomu przybliżenia */
  #pageSize(zoom) {
    if (zoom > 2)    return 200;   // bardzo blisko — mało węzłów
    if (zoom > 0.5)  return 500;
    if (zoom > 0.1)  return 1000;
    return 300;                    // bardzo daleko — ramka tłumaczy zagęszczenie
  }
}
