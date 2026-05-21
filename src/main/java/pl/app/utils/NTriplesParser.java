package pl.app.utils;

import org.apache.jena.riot.RDFParser;
import org.apache.jena.riot.system.StreamRDF;
import org.apache.jena.riot.system.StreamRDFBase;
import org.apache.jena.graph.Triple;
import pl.app.model.Edge;
import pl.app.model.GraphMetadata;
import org.apache.jena.graph.Node;
import pl.app.store.GraphStore;

import java.io.InputStream;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * Parser plików N-Triples (.nt).
 * Strategia mapowania:
 *   trójka z obiektem URI     -> krawędź subject → object
 *   trójka z obiektem literał -> atrybut węzła subject
 *   rdfs:label jako literał   -> dodatkowo ustawia Node.label
 *   blank node (_:b0)         -> zastępowany przez URI z UUID
 */
public class NTriplesParser {
    private static final Logger LOG = Logger.getLogger(NTriplesParser.class.getName());

    private static final String RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
    private static final String FOAF_NAME  = "http://xmlns.com/foaf/0.1/name";
    private static final String SKOS_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";

    private static final String RDF_TYPE   = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

    /**
     * Parsuje strumień N-Triples i zapisuje wynik do GraphStore.
     *
     * @param input    strumień danych (plik .nt)
     * @param filename nazwa pliku — używana jako ID i label metadanych
     * @param directed czy graf ma być skierowany
     * @return metadane załadowanego grafu
     */
    public GraphMetadata parse(InputStream input, String filename, boolean directed) {

        Map<String, URI> blankNodeMap = new HashMap<>();

        long[] nodeCount = {0};
        long[] edgeCount = {0};
        long[] skipped   = {0};

        GraphMetadata metadata = new GraphMetadata(filename, 0, 0, directed, filename);
        GraphStore.getInstance().initialize(directed, metadata);

        StreamRDF sink = new StreamRDFBase() {

            @Override
            public void triple(Triple triple) {
                try {
                    processTriple(triple, blankNodeMap, nodeCount, edgeCount, skipped);
                } catch (Exception e) {
                    skipped[0]++;
                    LOG.warning("Pominięto trójkę: " + triple + " — " + e.getMessage());
                }
            }
        };

        RDFParser.source(input)
                .lang(org.apache.jena.riot.RDFLanguages.NTRIPLES)
                .checking(false)
                .parse(sink);

        metadata.setNodeCount(nodeCount[0]);
        metadata.setEdgeCount(edgeCount[0]);

        LOG.info(String.format("Załadowano: %d węzłów, %d krawędzi, pominięto: %d trójek",
                nodeCount[0], edgeCount[0], skipped[0]));

        return metadata;
    }

    private void processTriple(Triple triple,
                               Map<String, URI> blankNodeMap,
                               long[] nodeCount,
                               long[] edgeCount,
                               long[] skipped) throws Exception {

        Node s = triple.getSubject();
        Node p = triple.getPredicate();
        Node o = triple.getObject();

        // Zamień subject na URI (obsługa blank node)
        URI subjectUri = resolveSubject(s, blankNodeMap);

        // Predykat — zawsze URI w N-Triples
        URI predicateUri = URI.create(p.getURI());

        // Czy węzeł subject istnieje w GraphStore
        pl.app.model.Node subjectNode = ensureNode(subjectUri, nodeCount);

        if (o.isURI()) {
            URI objectUri = URI.create(o.getURI());
            pl.app.model.Node objectNode = ensureNode(objectUri, nodeCount);

            // Etykieta krawędzi = skrócony predykat
            String edgeLabel = shortenUri(predicateUri.toString());

            // ID krawędzi = złożony klucz
            String edgeId = subjectUri + "|" + predicateUri + "|" + objectUri;

            Edge edge = new Edge(edgeId, subjectUri, objectUri, predicateUri, edgeLabel);
            GraphStore.getInstance().addEdge(edge);
            edgeCount[0]++;

            // Jeśli predykat to rdf:type -> zapisz typ jako atrybut subject
            if (RDF_TYPE.equals(predicateUri.toString())) {
                subjectNode.getAttributes().put("type", shortenUri(objectUri.toString()));
            }

        } else if (o.isLiteral()) {
            // == Obiekt literał -> atrybut węzła ==

            String value        = o.getLiteralLexicalForm();
            String predicateStr = predicateUri.toString();
            String attrKey      = shortenUri(predicateStr);

            subjectNode.getAttributes().put(attrKey, value);

            // Ustaw label jeśli to znany predykat etykietujący
            if (isLabelPredicate(predicateStr)) {
                // Ustaw label tylko jeśli jeszcze nie ustawiony przez rdfs:label
                boolean hasLabel = subjectNode.getLabel() != null
                        && !subjectNode.getLabel().equals(shortenUri(subjectUri.toString()));

                if (!hasLabel || RDFS_LABEL.equals(predicateStr)) {
                    subjectNode.setLabel(value);
                }
            }

        } else if (o.isBlank()) {
            // == Blank node jako obiekt -> krawędź do anonimowego węzła ==

            URI blankUri = resolveBlankNode(o.getBlankNodeLabel(), blankNodeMap);
            ensureNode(blankUri, nodeCount);

            String edgeId    = subjectUri + "|" + predicateUri + "|" + blankUri;
            String edgeLabel = shortenUri(predicateUri.toString());

            Edge edge = new Edge(edgeId, subjectUri, blankUri, predicateUri, edgeLabel);
            GraphStore.getInstance().addEdge(edge);
            edgeCount[0]++;
        }
    }

    // == Helpers ==
    /**
     * Zwraca URI dla węzła — obsługuje blank nodes.
     */
    private URI resolveSubject(Node node, Map<String, URI> blankNodeMap) {
        if (node.isURI()) {
            return URI.create(node.getURI());
        }
        // Blank node
        return resolveBlankNode(node.getBlankNodeLabel(), blankNodeMap);
    }

    /**
     * Zamienia etykietę blank node na stały URI z UUID.
     * Ten sam blank node ID zawsze dostaje ten sam UUID w ramach jednego importu.
     */
    private URI resolveBlankNode(String blankLabel, Map<String, URI> blankNodeMap) {
        return blankNodeMap.computeIfAbsent(
                blankLabel,
                k -> URI.create("urn:blank:" + UUID.randomUUID())
        );
    }

    /**
     * Zwraca węzeł z GraphStore — jeśli nie istnieje, tworzy go z domyślnym labelem.
     * Dzięki temu węzły które pojawiają się tylko jako obiekty też istnieją w grafie.
     */
    private pl.app.model.Node ensureNode(URI uri, long[] nodeCount) {
        GraphStore store = GraphStore.getInstance();
        pl.app.model.Node existing = store.getNode(uri.toString());

        if (existing == null) {
            Map<String, String> attrs = new HashMap<>();
            pl.app.model.Node newNode = new pl.app.model.Node(
                    uri,
                    shortenUri(uri.toString()),  // label = skrócone URI, do nadpisania przez rdfs:label
                    attrs
            );
            store.addNode(newNode);
            nodeCount[0]++;
            return newNode;
        }

        return existing;
    }

    /**
     * Skraca URI do czytelnej formy:
     *   http://xmlns.com/foaf/0.1/knows  ->  knows
     *   http://example.org/Alice         ->  Alice
     *   urn:blank:550e8400-...           ->  blank:550e...
     */
    private String shortenUri(String uri) {
        // Blank node URI
        if (uri.startsWith("urn:blank:")) {
            return "blank:" + uri.substring(10, Math.min(10 + 8, uri.length()));
        }

        // Fragment po '#'
        int hash = uri.lastIndexOf('#');
        if (hash >= 0 && hash < uri.length() - 1) {
            return uri.substring(hash + 1);
        }

        // Ostatni segment po '/'
        int slash = uri.lastIndexOf('/');
        if (slash >= 0 && slash < uri.length() - 1) {
            return uri.substring(slash + 1);
        }

        return uri;
    }

    private boolean isLabelPredicate(String predicateUri) {
        return RDFS_LABEL.equals(predicateUri)
                || FOAF_NAME.equals(predicateUri)
                || SKOS_LABEL.equals(predicateUri);
    }

}
