package com.ventapasajes.document.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.ventapasajes.document.api.dto.TicketDocumentData;

class TicketDocumentRenderingTest {

    @Test
    void rendersHtmlTemplateAndPdfBytes() {
        TicketDocumentData ticket = new TicketDocumentData(
                "79FFAF",
                "Marta Cliente",
                "CEDULA",
                "1919191919",
                new BigDecimal("25.50"),
                "USD",
                "BUS-D37",
                "Un piso",
                "Quito",
                "Cuenca",
                Instant.parse("2026-09-16T22:49:00Z"),
                "1",
                "Piso 1",
                Instant.parse("2026-09-16T14:49:00Z"));

        TicketHtmlTemplateRenderer htmlRenderer = new TicketHtmlTemplateRenderer();
        String html = htmlRenderer.render(ticket);
        assertTrue(html.contains("79FFAF"));
        assertTrue(html.contains("Marta Cliente"));

        TicketPdfRenderer pdfRenderer = new TicketPdfRenderer();
        byte[] pdf = pdfRenderer.render(ticket, html);
        assertTrue(pdf.length > 500);
        assertTrue(new String(pdf, 0, 4).startsWith("%PDF"));
    }
}
