package pl.app.model;

public class GraphMetadata {
    private String id;
    private int nodesCount;
    private int edgesCount;
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

    public int getNodesCount() {
        return nodesCount;
    }

    public void setNodesCount(int nodesCount) {
        this.nodesCount = nodesCount;
    }

    public int getEdgesCount() {
        return edgesCount;
    }

    public void setEdgesCount(int edgesCount) {
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
