package pl.app.servlets;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import pl.app.model.Edge;
import pl.app.model.Node;
import pl.app.store.GraphStore;

import java.io.IOException;
import java.util.*;

@WebServlet("/api/nodes")
public class NodesServlet extends HttpServlet {

    private final ObjectMapper jackson = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {

        resp.setContentType("application/json;charset=UTF-8");

        GraphStore store = GraphStore.getInstance();

        if (!store.isLoaded()) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            jackson.writeValue(resp.getWriter(),
                    Map.of("error", "Brak załadowanego grafu"));
            return;
        }

        String allParam = req.getParameter("all");

        boolean all = "1".equals(allParam) || "true".equalsIgnoreCase(allParam);

        if (all) {
            sendWholeGraph(store, resp);
        } else {
            sendHubNode(store, resp);
        }
    }

    // ======================================================
    // Zwraca jeden główny hub
    // ======================================================
    private void sendHubNode(GraphStore store, HttpServletResponse resp)
            throws IOException {

        var graph = store.getGraph();

        String hubId = graph.vertexSet().stream()
                .max(Comparator.comparingInt(graph::degreeOf))
                .orElse(null);

        if (hubId == null) {
            jackson.writeValue(resp.getWriter(),
                    Map.of(
                            "nodes", List.of(),
                            "edges", List.of(),
                            "nextCursor", null,
                            "version", 1
                    ));
            return;
        }

        Node hub = store.getNode(hubId);

        Map<String, Object> n = new LinkedHashMap<>();
        n.put("id", hubId);
        n.put("label", hub.getLabel());
        n.put("attributes", hub.getAttributes());
        n.put("weight", graph.degreeOf(hubId));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("nodes", List.of(n));
        response.put("edges", List.of());
        response.put("nextCursor", null);
        response.put("version", 1);

        resp.setStatus(HttpServletResponse.SC_OK);
        jackson.writeValue(resp.getWriter(), response);
    }

    // ======================================================
    // Zwraca cały graf
    // ======================================================
    private void sendWholeGraph(GraphStore store, HttpServletResponse resp)
            throws IOException {

        List<Map<String, Object>> nodes = new ArrayList<>();

        for (Node node : store.getAllNodes()) {
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("id", node.getId().toString());
            n.put("label", node.getLabel());
            n.put("attributes", node.getAttributes());
            n.put("weight",
                    store.getGraph().degreeOf(node.getId().toString()));

            nodes.add(n);
        }

        List<Map<String, Object>> edges = new ArrayList<>();

        for (Edge edge : store.getAllEdges()) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id", edge.getId());
            e.put("source", edge.getSource().toString());
            e.put("target", edge.getTarget().toString());
            e.put("label", edge.getLabel());
            e.put("directed", store.getMetadata().isDirected());

            edges.add(e);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("nodes", nodes);
        response.put("edges", edges);
        response.put("nextCursor", null);
        response.put("version", 1);

        resp.setStatus(HttpServletResponse.SC_OK);
        jackson.writeValue(resp.getWriter(), response);
    }
}
