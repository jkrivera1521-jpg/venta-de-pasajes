package com.ventapasajes.report.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import jakarta.enterprise.context.control.ActivateRequestContext;

class ReportJobWorkerTest {

    @Test
    void processActivatesRequestContextForAsyncWork() throws NoSuchMethodException {
        assertNotNull(
                ReportJobWorker.class.getMethod("process", UUID.class).getAnnotation(ActivateRequestContext.class),
                "El worker asincrono debe activar el contexto CDI antes de consultar Hibernate");
    }
}
