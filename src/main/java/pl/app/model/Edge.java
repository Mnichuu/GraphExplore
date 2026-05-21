package pl.app.model;

import java.net.URI;

public class Edge {
    private String id; // String edgeId = source.toString() + "|" + predicate.toString() + "|" + target.toString();
    private URI source;
    private URI target;
    private URI predicate;
    private String label;

    public Edge(String id, URI source, URI target, URI predicate, String label) {
        this.id = id;
        this.source = source;
        this.target = target;
        this.predicate = predicate;
        this.label = label;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public URI getSource() {
        return source;
    }

    public void setSource(URI source) {
        this.source = source;
    }

    public URI getTarget() {
        return target;
    }

    public void setTarget(URI target) {
        this.target = target;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) { this.label = label; }

    public URI getPredicate() {
        return predicate;
    }

    public void setPredicate(URI predicate) {
        this.predicate = predicate;
    }
}
