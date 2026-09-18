package com.ventapasajes.document.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

import com.ventapasajes.document.api.dto.TicketDocumentData;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TicketHtmlTemplateRenderer {

    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("America/Guayaquil"));

    public String render(TicketDocumentData ticket) {
        String html = loadTemplate();
        for (Map.Entry<String, String> replacement : replacements(ticket).entrySet()) {
            html = html.replace("{{" + replacement.getKey() + "}}", escapeHtml(replacement.getValue()));
        }
        return html;
    }

    private Map<String, String> replacements(TicketDocumentData ticket) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("ticket_number", value(ticket.ticketNumber()));
        values.put("route_name", routeName(ticket));
        values.put("departure_at", format(ticket.departureAt()));
        values.put("passenger_name", value(ticket.passengerName()));
        values.put("document_number", documentLabel(ticket));
        values.put("bus_code", value(ticket.busCode()));
        values.put("seat_number", value(ticket.seatNumber()));
        values.put("price", amount(ticket.price()));
        values.put("currency", value(ticket.currency()).toUpperCase());
        values.put("sold_at", format(ticket.soldAt()));
        return values;
    }

    private String loadTemplate() {
        try (InputStream input = Thread.currentThread().getContextClassLoader()
                .getResourceAsStream("templates/ticket.html")) {
            if (input == null) {
                throw new IllegalStateException("Ticket HTML template was not found.");
            }
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new UncheckedIOException("Could not read ticket HTML template.", ex);
        }
    }

    private static String routeName(TicketDocumentData ticket) {
        String origin = value(ticket.origin());
        String destination = value(ticket.destination());
        if (origin.isBlank() && destination.isBlank()) {
            return "-";
        }
        return origin + " - " + destination;
    }

    private static String documentLabel(TicketDocumentData ticket) {
        String type = value(ticket.documentType());
        String number = value(ticket.documentNumber());
        return type.isBlank() ? number : type + " " + number;
    }

    private static String format(Instant instant) {
        return instant == null ? "-" : DISPLAY_DATE.format(instant);
    }

    private static String amount(BigDecimal amount) {
        return amount == null ? "0.00" : amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private static String value(String value) {
        return value == null ? "" : value.trim();
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
