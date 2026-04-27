package pl.app.servlets;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;
import pl.app.model.GraphMetadata;
import pl.app.utils.NTriplesParser;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

@WebServlet(name = "ImportServlet", value = "/api/import/rdf")
@MultipartConfig(
        maxFileSize    = 500L * 1024 * 1024,   // 500 MB — max rozmiar pliku
        maxRequestSize = 505L * 1024 * 1024    // 505 MB — max rozmiar całego żądania
)
public class ImportServlet extends HttpServlet {
    private final ObjectMapper jackson = new ObjectMapper();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        resp.setContentType("application/json;charset=UTF-8");

        try {
            Part filePart = req.getPart("file");
            if (filePart == null || filePart.getSize() == 0) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Brak pliku w żądaniu");
                return;
            }

            String filename = extractFilename(filePart);
            InputStream fileStream = filePart.getInputStream();

            boolean directed = !"false".equalsIgnoreCase(req.getParameter("directed"));

            String lang = req.getParameter("lang");
            String blankNodes = req.getParameter("blankNodes");
            String literals = req.getParameter("literals");
            String maxNodes = req.getParameter("maxNodes");

            NTriplesParser parser = new NTriplesParser();
            GraphMetadata metadata = parser.parse(fileStream, filename, directed);

            resp.setStatus(HttpServletResponse.SC_OK);
            jackson.writeValue(resp.getWriter(), metadata);

        } catch (IOException e) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    /**
     * Wyciąga nazwę pliku z nagłówka Content-Disposition.
     * Jeśli nie uda się odczytać — zwraca "unknown.nt".
     * Nagłówek wygląda tak:
     * Content-Disposition: form-data; name="file"; filename="moj-graf.nt"
     */
    private String extractFilename(Part part) {
        String contentDisposition = part.getHeader("content-disposition");
        if (contentDisposition == null) return "unknown.nt";

        for (String token : contentDisposition.split(";")) {
            token = token.trim();
            if (token.startsWith("filename")) {
                return token.substring(token.indexOf('=') + 1)
                        .trim()
                        .replace("\"", "");
            }
        }
        return "unknown.nt";
    }

    /**
     * Wysyła odpowiedź błędu jako JSON.
     * Frontend zawsze dostaje JSON — nigdy surowy tekst błędu.
     */
    private void sendError(HttpServletResponse resp, int status, String message)
            throws IOException {
        resp.setStatus(status);
        jackson.writeValue(resp.getWriter(),
                Map.of("error", message != null ? message : "Nieznany błąd")
        );
    }
}
