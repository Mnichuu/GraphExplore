package pl.app.service;

import org.jgrapht.alg.scoring.PageRank;
import pl.app.model.*;
import pl.app.store.GraphStore;
import java.util.*;
import java.util.stream.*;
import java.util.Comparator;

public class GraphService {

    /** Wyróżnione węzły wg PageRank (top N) */
    public List<String> getTopNodesByPageRank(int n) {
        var g = GraphStore.getInstance().getGraph();
        if (g == null) return List.of();
        var pr = new PageRank<>(g);
        return g.vertexSet().stream()
                .sorted((v1, v2) -> Double.compare(pr.getVertexScore((String) v2), pr.getVertexScore((String) v1))) // Sortowanie po PageRank
                .limit(n)  // Zastosowanie limitu N
                .map(v -> (String) v)  // Przekształcamy węzły na String
                .collect(Collectors.toList());
    }
}
