package pl.app.store;

import org.jgrapht.Graph;
import org.jgrapht.graph.DirectedPseudograph;
import org.jgrapht.graph.Pseudograph;
import pl.app.model.Edge;
import pl.app.model.GraphMetadata;
import pl.app.model.Node;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Centralny magazyn grafu w pamięci.
 *
 * Trzyma dwie równoległe struktury:
 *  - mapy atrybutów (Node, Edge) — do serializacji i wyświetlania
 *  - graf JGraphT                — do zapytań strukturalnych (sąsiedztwo, algorytmy)
 */
public class GraphStore {
    private static final GraphStore INSTANCE = new GraphStore();
    private GraphStore() {}

    public static GraphStore getInstance() {
        return INSTANCE;
    }

    // <URI.toString(), Node>
    private final Map<String, Node> nodes = new LinkedHashMap<>();

    // <Edge.id, Edge>
    private final Map<String, Edge> edges = new LinkedHashMap<>();

    // Struktura grafu w JGraphT <wierzchołek = URI string, krawędź = Edge.id>
    private Graph<String, String> graph;
    private GraphMetadata metadata;

    // == Inicjalizacja ==
    /**
     * Przygotowuje pusty store na nowy graf.
     * Wywoływane na początku każdego importu — czyści poprzedni graf.
     *
     * @param directed czy graf jest skierowany
     * @param metadata metadane nowego grafu
     */
    public void initialize(boolean directed, GraphMetadata metadata) {
        nodes.clear();
        edges.clear();

        // DirectedPseudograph dla skierowanych, Pseudograph dla nieskierowanych
        // Pseudograph (zamiast SimpleGraph) bo RDF dopuszcza multi-krawędzie i pętle
        this.graph = directed
                ? new DirectedPseudograph<>(String.class)
                : new Pseudograph<>(String.class);
        this.metadata = metadata;
    }

    // == Dodawanie danych ==
    /**
     * Dodaje węzeł. Jeśli węzeł o tym ID już istnieje — aktualizuje go.
     */
    public void addNode(Node node) {
        String key = node.getId().toString();
        graph.addVertex(key);
        nodes.put(key, node);
    }

    /**
     * Dodaje krawędź. Oba węzły muszą już istnieć w GraphStore.
     * Jeśli krawędź o tym ID już istnieje — ignoruje.
     */
    public void addEdge(Edge edge) {
        String edgeId  = edge.getId();
        String sourceKey = edge.getSource().toString();
        String targetKey = edge.getTarget().toString();

        graph.addVertex(sourceKey);
        graph.addVertex(targetKey);

        if (!graph.containsEdge(edgeId)) {
            graph.addEdge(sourceKey, targetKey, edgeId);
        }

        edges.putIfAbsent(edgeId, edge);
    }

    // == Odczyt danych ==
    /**
     * Zwraca wszystkie węzły jako niemodyfikowalną kolekcję.
     * Etap 1: zwracamy wszystko.
     * Etap 2: zastąpione przez zapytania stronicowane.
     */
    public Collection<Node> getAllNodes() {
        return Collections.unmodifiableCollection(nodes.values());
    }

    /**
     * Zwraca wszystkie krawędzie jako niemodyfikowalną kolekcję.
     */
    public Collection<Edge> getAllEdges() {
        return Collections.unmodifiableCollection(edges.values());
    }

    /**
     * Zwraca pojedynczy węzeł po URI (jako String).
     * Zwraca null jeśli nie istnieje.
     */
    public Node getNode(String uriString) {
        return nodes.get(uriString);
    }

    /**
     * Zwraca pojedynczą krawędź po jej ID.
     */
    public Edge getEdge(String edgeId) {
        return edges.get(edgeId);
    }

    /**
     * Metadane aktualnie załadowanego grafu.
     * Null jeśli żaden graf nie był jeszcze importowany.
     */
    public GraphMetadata getMetadata() {
        return metadata;
    }

    /**
     * Bezpośredni dostęp do struktury JGraphT.
     */
    public Graph<String, String> getGraph() {
        return graph;
    }

    // == Stan ==
    /**
     * Czy jakiś graf jest aktualnie załadowany.
     */
    public boolean isLoaded() {
        return metadata != null && graph != null;
    }

    /**
     * Liczba węzłów w aktualnie załadowanym grafie.
     */
    public int getNodeCount() {
        return nodes.size();
    }

    /**
     * Liczba krawędzi w aktualnie załadowanym grafie.
     */
    public int getEdgeCount() {
        return edges.size();
    }
}
