package pl.app.model;

public class GraphMetadata {
    private String id;
    private long nodesCount;
    private long edgesCount;
    private boolean directed;
    private String label;

    public GraphMetadata(String id, int nodesCount, int edgesCount, boolean directed, String label) {
        this.id = id;
        this.nodesCount = nodesCount;
        this.edgesCount = edgesCount;
        this.directed = directed;
        this.label = label;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public long getNodeCount() {
        return nodesCount;
    }

    public void setNodeCount(long nodesCount) {
        this.nodesCount = nodesCount;
    }

    public long getEdgeCount() {
        return edgesCount;
    }

    public void setEdgeCount(long edgesCount) {
        this.edgesCount = edgesCount;
    }

    public boolean isDirected() {
        return directed;
    }

    public void setDirected(boolean directed) {
        this.directed = directed;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }
}
