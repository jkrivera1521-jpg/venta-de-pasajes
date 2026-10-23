package com.ventapasajes.report.validation;

import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.persistence.entity.ReportTemplateParameter;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class ReportParameterValidator {
    @Inject ObjectMapper objectMapper;
    @ConfigProperty(name = "app.report.parameters.strict") boolean strict;

    public JsonNode validate(Map<String, Object> parameters, List<ReportTemplateParameter> schema) {
        JsonNode root = objectMapper.valueToTree(parameters == null ? Map.of() : parameters);
        Set<String> declaredRoots = new HashSet<>();
        for (ReportTemplateParameter parameter : schema) declaredRoots.add(canonicalPath(parameter.path).split("\\.", 2)[0]);
        if (strict && root.isObject()) root.fieldNames().forEachRemaining(name -> {
            if (!declaredRoots.contains(name)) throw new ReportServiceException(422, "UNKNOWN_PARAMETER", "Parametro no declarado: " + name);
        });
        for (ReportTemplateParameter parameter : schema) {
            String path = canonicalPath(parameter.path);
            JsonNode value = root.at("/" + path.replace(".", "/"));
            if (parameter.required && requiredValueMissing(root, path, value)) {
                throw new ReportServiceException(422, "REQUIRED_PARAMETER_MISSING", "Falta el parametro requerido: " + path);
            }
            if (!value.isMissingNode() && !value.isNull() && parameter.collection && !value.isArray()) {
                throw new ReportServiceException(422, "INVALID_PARAMETER_TYPE", "El parametro debe ser una lista: " + path);
            }
            if (!value.isMissingNode() && !value.isNull() && !compatible(parameter.dataType, value)) {
                throw new ReportServiceException(422, "INVALID_PARAMETER_TYPE", "El tipo del parametro no es compatible: " + path);
            }
        }
        return root;
    }

    private boolean requiredValueMissing(JsonNode root, String path, JsonNode value) {
        if (!value.isMissingNode() && !value.isNull()) return false;
        if (!path.contains(".")) return true;
        String rootName = path.substring(0, path.indexOf('.'));
        JsonNode parent = root.get(rootName);
        if (parent == null || parent.isNull()) return true;
        if (parent.isArray()) return false;
        String field = path.substring(path.lastIndexOf('.') + 1);
        return parent.isObject() && !parent.has(field);
    }

    private String canonicalPath(String path) {
        String value = path == null ? "" : path.trim();
        return value.startsWith("${") && value.endsWith("}") ? value.substring(2, value.length() - 1).trim() : value;
    }

    private boolean compatible(com.ventapasajes.report.domain.ParameterDataType type, JsonNode value) {
        return switch (type) {
            case UNKNOWN -> true;
            case STRING, DATE -> value.isTextual();
            case NUMBER -> value.isNumber();
            case BOOLEAN -> value.isBoolean();
            case ARRAY -> value.isArray();
            case OBJECT -> value.isObject();
        };
    }
}
