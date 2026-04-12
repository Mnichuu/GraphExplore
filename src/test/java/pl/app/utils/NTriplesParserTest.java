package pl.app.utils;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import pl.app.model.GraphMetadata;
import pl.app.model.Node;
import pl.app.store.GraphStore;

import java.io.InputStream;
import java.util.Collection;

import static org.junit.jupiter.api.Assertions.*;

class NTriplesParserTest {

    private static final String ALICE = "http://example.org/Alice";
    private static final String BOB   = "http://example.org/Bob";
    private static final String PERSON = "http://xmlns.com/foaf/0.1/Person";

    private static final String RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
    private static final String FOAF_KNOWS = "http://xmlns.com/foaf/0.1/knows";


    private static final String RDF_TYPE   = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

    private NTriplesParser parser;

    @BeforeEach
    void setUp() {
        parser = new NTriplesParser();
    }

    // == Metadane ==

    @Test
    void metadane_powinnyZawieracNazwePliku() {
        GraphMetadata meta = parse();
        assertEquals("test.nt", meta.getId());
    }

    @Test
    void metadane_grafPowinienBycSkierowany() {
        GraphMetadata meta = parse();
        assertTrue(meta.isDirected());
    }

    @Test
    void metadane_powinnyZwrocic4Wezly() {
        // Alice, Bob, foaf:Person, blank node
        GraphMetadata meta = parse();
        assertEquals(4, meta.getNodeCount());
    }

    @Test
    void metadane_powinnyZwrocic2Krawedzie() {
        // Alice->Bob (knows), Alice->Person (type)
        GraphMetadata meta = parse();
        assertEquals(2, meta.getEdgeCount());
    }

    // == Węzły - istnienie ==

    @Test
    void wezel_AlicePowinieniIstniec() {
        parse();
        assertNotNull(GraphStore.getInstance().getNode(ALICE));
    }

    @Test
    void wezel_BobPowinienIstniec() {
        parse();
        assertNotNull(GraphStore.getInstance().getNode(BOB));
    }

    @Test
    void wezel_PersonPowinienIstniecJakoObiektRdfType() {
        parse();
        assertNotNull(GraphStore.getInstance().getNode(PERSON),
                "foaf:Person jako obiekt URI powinien stać się węzłem");
    }

    @Test
    void wezel_BlankNodePowinienIstniec() {
        parse();
        long count = GraphStore.getInstance().getAllNodes().stream()
                .filter(n -> n.getId().toString().startsWith("urn:blank:"))
                .count();
        assertEquals(1, count);
    }

    // == Węzły - etykiety ==

    @Test
    void label_AlicePowinienByc_AliceKowalska() {
        parse();
        Node alice = GraphStore.getInstance().getNode(ALICE);
        assertEquals("Alice Kowalska", alice.getLabel());
    }

    @Test
    void label_BobPowinienByc_BobNowak() {
        parse();
        Node bob = GraphStore.getInstance().getNode(BOB);
        assertEquals("Bob Nowak", bob.getLabel());
    }

    @Test
    void label_BlankNodePowinienByc_Anonim() {
        // foaf:name "Anonim" -> parser ustawia label blank node
        parse();
        Node blank = GraphStore.getInstance().getAllNodes().stream()
                .filter(n -> n.getId().toString().startsWith("urn:blank:"))
                .findFirst()
                .orElseThrow();
        assertEquals("Anonim", blank.getLabel());
    }

    @Test
    void label_PersonPowinienByc_SkroconaNazwa() {
        // foaf:Person nie ma rdfs:label - label = fragment URI = "Person"
        parse();
        Node person = GraphStore.getInstance().getNode(PERSON);
        assertEquals("Person", person.getLabel());
    }

    // == Węzły - atrybuty ==

    @Test
    void atrybut_AlicePowinienMiecType_Person() {
        // rdf:type <foaf:Person> -> attributes["type"] = "Person"
        parse();
        Node alice = GraphStore.getInstance().getNode(ALICE);
        assertEquals("Person", alice.getAttributes().get("type"));
    }

    @Test
    void atrybut_BobNiePowinienMiecType() {
        parse();
        Node bob = GraphStore.getInstance().getNode(BOB);
        assertNull(bob.getAttributes().get("type"));
    }

    // == Krawędzie ==

    @Test
    void krawedz_Alice_Bob_PowinnaIstniec() {
        parse();
        // ID krawędzi = source|predicate|target
        String edgeId = ALICE
                + "|" + FOAF_KNOWS + "|"
                + BOB;
        assertNotNull(GraphStore.getInstance().getEdge(edgeId));
    }

    @Test
    void krawedz_Alice_Person_PowinnaIstniec() {
        parse();
        String edgeId = ALICE
                + "|" + RDF_TYPE + "|"
                + PERSON;
        assertNotNull(GraphStore.getInstance().getEdge(edgeId));
    }

    @Test
    void krawedz_NiePowinnaIstniecdlaLiteralu() {
        // rdfs:label "Alice Kowalska" to atrybut, nie krawędź
        parse();
        Collection<pl.app.model.Edge> edges = GraphStore.getInstance().getAllEdges();
        boolean hasLabelEdge = edges.stream()
                .anyMatch(e -> e.getPredicate().toString()
                        .equals(RDFS_LABEL));
        assertFalse(hasLabelEdge, "Literały nie powinny tworzyć krawędzi");
    }

    @Test
    void krawedz_LabelKrawedzi_AliceBob_PowinienByc_knows() {
        parse();
        String edgeId = ALICE + "|" + FOAF_KNOWS + "|" + BOB;
        pl.app.model.Edge edge = GraphStore.getInstance().getEdge(edgeId);
        assertNotNull(edge);
        assertEquals("knows", edge.getLabel());
    }

    // == Helper ==

    private GraphMetadata parse() {
        InputStream input = getClass().getResourceAsStream("/test.nt");
        assertNotNull(input, "Brak pliku test.nt w src/test/resources");
        return parser.parse(input, "test.nt", true);
    }
}