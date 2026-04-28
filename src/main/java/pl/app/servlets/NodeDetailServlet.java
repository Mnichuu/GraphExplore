package pl.app.servlets;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import pl.app.model.Edge;
import pl.app.model.Node;
import pl.app.store.GraphStore;

import java.io.*;
import java.util.*;

@WebServlet("/api/nodes/detail")
public class NodeDetailServlet extends HttpServlet {

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
        Node node = store.getNode(nodeId);

        if (node == null) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            jackson.writeValue(resp.getWriter(), Map.of("error", "Węzeł nie istnieje: " + nodeId));
            return;
        }

        // Krawędzie węzła
        List<Map<String, Object>> edges = new ArrayList<>();
        for (Edge edge : store.getAllEdges()) {
            if (edge.getSource().toString().equals(nodeId)
                    || edge.getTarget().toString().equals(nodeId)) {

                Map<String, Object> e = new LinkedHashMap<>();
                e.put("id",       edge.getId());
                e.put("source",   edge.getSource().toString());
                e.put("target",   edge.getTarget().toString());
                e.put("label",    edge.getLabel());
                e.put("directed", store.getMetadata().isDirected());
                edges.add(e);
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id",         node.getId().toString());
        response.put("label",      node.getLabel());
        response.put("attributes", node.getAttributes());
        response.put("degree",     store.getGraph().degreeOf(nodeId));
        response.put("edges",      edges);

        resp.setStatus(HttpServletResponse.SC_OK);
        jackson.writeValue(resp.getWriter(), response);
    }
}
