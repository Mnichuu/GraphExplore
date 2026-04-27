package pl.app.servlets;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import pl.app.model.Edge;
import pl.app.model.Node;
import pl.app.service.GraphService;
import pl.app.store.GraphStore;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@WebServlet("/api/nodes/top")
public class TopServlet extends HttpServlet {

    private final ObjectMapper jackson = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {

        resp.setContentType("application/json;charset=UTF-8");

        GraphStore store = GraphStore.getInstance();

        if (!store.isLoaded()) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            jackson.writeValue(resp.getWriter(), Map.of("error", "Brak załadowanego grafu"));
            return;
        }

        GraphService service = new GraphService();
        List<String> topNodes = service.getTopNodesByPageRank(req.getParameter("n") != null ? Integer.parseInt(req.getParameter("n")) : 10);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("topNodes", topNodes);


        resp.setStatus(HttpServletResponse.SC_OK);
        jackson.writeValue(resp.getWriter(), response);
    }
}
