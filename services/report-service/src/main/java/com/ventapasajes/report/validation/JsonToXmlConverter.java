package com.ventapasajes.report.validation;

import java.io.StringWriter;
import java.util.Iterator;
import java.util.Map;
import java.util.regex.Pattern;

import javax.xml.stream.XMLOutputFactory;
import javax.xml.stream.XMLStreamWriter;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.enterprise.context.ApplicationScoped;

/** Converts the validated report payload to the XML tree expected by OpenDoPE. */
@ApplicationScoped
public class JsonToXmlConverter {
    private static final Pattern XML_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_.-]*");
    private static final Limits DEFAULT_LIMITS = new Limits(32, 10_000, 1_000_000, 8_000_000);
    private final Limits limits;

    public JsonToXmlConverter() {
        this(DEFAULT_LIMITS);
    }

    JsonToXmlConverter(Limits limits) {
        this.limits = limits;
    }

    public String convert(JsonNode payload, String rootName) {
        String normalizedRoot = requireName(rootName == null || rootName.isBlank() ? "data" : rootName);
        JsonNode data = payload == null || payload.isNull() ? com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode() : payload;
        if (data.isObject() && data.size() == 1 && data.has(normalizedRoot)) data = data.get(normalizedRoot);
        try {
            StringWriter output = new StringWriter();
            XMLStreamWriter writer = XMLOutputFactory.newFactory().createXMLStreamWriter(output);
            writer.writeStartDocument("UTF-8", "1.0");
            writer.writeStartElement(normalizedRoot);
            ConversionState state = new ConversionState(output);
            writeValue(writer, data, state, 1);
            writer.writeEndElement();
            writer.writeEndDocument();
            writer.close();
            state.ensureXmlSize();
            return output.toString();
        } catch (Exception error) {
            if (error instanceof IllegalArgumentException illegalArgument) throw illegalArgument;
            throw new IllegalArgumentException("No se pudo convertir el payload JSON a XML.", error);
        }
    }

    private void writeValue(XMLStreamWriter writer, JsonNode value, ConversionState state, int depth) throws Exception {
        state.visit(depth);
        if (value == null || value.isNull()) return;
        if (value.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = value.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String name = requireName(field.getKey());
                JsonNode child = field.getValue();
                if (child != null && child.isArray()) {
                    writer.writeStartElement(name);
                    for (JsonNode item : child) {
                        writer.writeStartElement("item");
                        writeValue(writer, item, state, depth + 1);
                        writer.writeEndElement();
                    }
                    writer.writeEndElement();
                } else {
                    writer.writeStartElement(name);
                    writeValue(writer, child, state, depth + 1);
                    writer.writeEndElement();
                }
            }
        } else if (value.isArray()) {
            for (JsonNode item : value) {
                writer.writeStartElement("item");
                writeValue(writer, item, state, depth + 1);
                writer.writeEndElement();
            }
        } else if (value.isValueNode()) {
            String text = value.asText();
            state.addText(text.length());
            writer.writeCharacters(text);
        }
        state.ensureXmlSize();
    }

    private String requireName(String name) {
        if (name == null || !XML_NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("El nombre XML no es valido: " + name);
        }
        return name;
    }

    record Limits(int maxDepth, int maxNodes, int maxTextChars, int maxXmlChars) {
        Limits {
            if (maxDepth < 1 || maxNodes < 1 || maxTextChars < 1 || maxXmlChars < 1) {
                throw new IllegalArgumentException("Los limites del conversor XML deben ser positivos.");
            }
        }
    }

    private final class ConversionState {
        private final StringWriter output;
        private int nodes;
        private int textChars;

        private ConversionState(StringWriter output) {
            this.output = output;
        }

        private void visit(int depth) {
            if (depth > limits.maxDepth()) {
                throw new IllegalArgumentException("El payload JSON supera la profundidad maxima permitida.");
            }
            if (++nodes > limits.maxNodes()) {
                throw new IllegalArgumentException("El payload JSON supera la cantidad maxima de nodos permitida.");
            }
        }

        private void addText(int length) {
            if (length > limits.maxTextChars() - textChars) {
                throw new IllegalArgumentException("El payload JSON supera el tamano maximo de texto permitido.");
            }
            textChars += length;
        }

        private void ensureXmlSize() {
            if (output.getBuffer().length() > limits.maxXmlChars()) {
                throw new IllegalArgumentException("El XML generado supera el tamano maximo permitido.");
            }
        }
    }
}
