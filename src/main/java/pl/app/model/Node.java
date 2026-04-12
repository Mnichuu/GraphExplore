package pl.app.model;

import java.net.URI;
import java.util.Map;

public class Node {
    private URI id;
    private String label;
    private Map<String,String> attributes;

    public Node(URI id, String label, Map<String, String> attributes) {
        this.id = id;
        this.label = label;
        this.attributes = attributes;
    }

    public URI getId() {
        return id;
    }

    public void setId(URI id) {
        this.id = id;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Map<String, String> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, String> attributes) {
        this.attributes = attributes;
    }
}
