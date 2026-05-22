package pl.app.servlets;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import pl.app.model.Node;
import pl.app.store.GraphStore;

import java.io.IOException;
import java.util.*;

@WebServlet("/api/nodes/neighbors")
public class NeighborhoodServlet extends HttpServlet {

    private final ObjectMapper jackson = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {

        resp.setContentType("application/json;charset=UTF-8");

        String nodeId = req.getParameter("id");
        if (nodeId == null || nodeId.isBlank()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            jackson.writeValue(resp.getWriter(), Map.of("error", "Brak parametru id"));
            return;
        }

        GraphStore store = GraphStore.getInstance();

        if (!store.isLoaded()) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            jackson.writeValue(resp.getWriter(), Map.of("error", "Brak załadowanego grafu"));
            return;
        }

        var graph = store.getGraph();

        if (!graph.containsVertex(nodeId)) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            jackson.writeValue(resp.getWriter(), Map.of("error", "Węzeł nie istnieje: " + nodeId));
            return;
        }
        
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        boolean directed = store.getMetadata().isDirected();

        for (String edgeId : graph.edgesOf(nodeId)) {
            String source = graph.getEdgeSource(edgeId);
            String target = graph.getEdgeTarget(edgeId);

            String neighborId = source.equals(nodeId) ? target : source;

            Node neighbor = store.getNode(neighborId);
            if (neighbor != null) {
                Map<String, Object> n = new LinkedHashMap<>();
                n.put("id",         neighbor.getId().toString());
                n.put("label",      neighbor.getLabel());
                n.put("attributes", neighbor.getAttributes());
                n.put("weight",     graph.degreeOf(neighborId));
                nodes.add(n);
            }

            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id",       edgeId);
            e.put("source",   source);
            e.put("target",   target);
            e.put("label",    store.getEdge(edgeId).getLabel());
            e.put("directed", directed);
            edges.add(e);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("nodes", nodes);
        response.put("edges", edges);

        resp.setStatus(HttpServletResponse.SC_OK);
        jackson.writeValue(resp.getWriter(), response);
    }
}
