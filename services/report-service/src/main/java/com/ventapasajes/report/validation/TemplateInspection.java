package com.ventapasajes.report.validation;

import java.util.List;

import com.ventapasajes.report.domain.TemplateEngineType;
import com.ventapasajes.report.domain.TemplateFeature;

public record TemplateInspection(
        TemplateEngineType engine,
        List<TemplateFeature> features,
        String xmlRoot,
        List<String> warnings) {

    public boolean has(TemplateFeature feature) {
        return features != null && features.contains(feature);
    }

    public boolean isOpenDope() {
        return engine == TemplateEngineType.OPENDOPE || has(TemplateFeature.OPENDOPE);
    }
}
