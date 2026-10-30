package com.ventapasajes.report.validation;

import java.net.URI;
import java.util.Set;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Cleaner;
import org.jsoup.safety.Safelist;

import jakarta.enterprise.context.ApplicationScoped;

/** Validates the deliberately small XHTML subset accepted by rich-text parameters. */
@ApplicationScoped
public class RichTextSanitizer {
    private static final int MAX_LENGTH = 256_000;
    private static final int MAX_DEPTH = 32;
    private static final Set<String> TAGS = Set.of("p", "br", "strong", "em", "u", "ul", "ol", "li", "a");
    private static final Pattern CONTROL_ATTRIBUTE = Pattern.compile("(?i)^on[a-z]+");
    private static final Safelist SAFE_LIST = Safelist.none()
            .addTags("p", "br", "strong", "em", "u", "ul", "ol", "li", "a")
            .addAttributes("a", "href")
            .addProtocols("a", "href", "http", "https", "mailto");

    public String sanitize(String html) {
        if (html == null || html.isBlank()) return "";
        if (html.length() > MAX_LENGTH) throw invalid("El texto enriquecido supera el tamano maximo permitido.");

        Document document = Jsoup.parseBodyFragment(html, "");
        validate(document.body(), 0);
        return new Cleaner(SAFE_LIST).clean(document).body().html();
    }

    private void validate(Element element, int depth) {
        if (depth > MAX_DEPTH) throw invalid("El texto enriquecido supera la profundidad maxima permitida.");
        for (Element child : element.children()) {
            if (!TAGS.contains(child.tagName())) throw invalid("Etiqueta XHTML no permitida: " + child.tagName());
            child.attributes().forEach(attribute -> {
                if (!(child.tagName().equals("a") && attribute.getKey().equals("href"))
                        || CONTROL_ATTRIBUTE.matcher(attribute.getKey()).find()) {
                    throw invalid("Atributo XHTML no permitido: " + attribute.getKey());
                }
            });
            if (child.tagName().equals("a")) validateHref(child.attr("href"));
            validate(child, depth + 1);
        }
    }

    private void validateHref(String value) {
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (scheme == null || !Set.of("http", "https", "mailto").contains(scheme.toLowerCase())) {
                throw invalid("El protocolo del enlace no esta permitido.");
            }
        } catch (IllegalArgumentException error) {
            throw invalid("El enlace XHTML no es valido.");
        }
    }

    private IllegalArgumentException invalid(String message) {
        return new IllegalArgumentException(message);
    }
}
