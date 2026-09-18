package com.ventapasajes.document.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

import com.ventapasajes.document.api.dto.TicketDocumentData;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class TicketPdfRenderer {

    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("America/Guayaquil"));

    public byte[] render(TicketDocumentData ticket, String templateHtml) {
        try (PDDocument document = new PDDocument();
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                float width = page.getMediaBox().getWidth();
                float top = page.getMediaBox().getHeight() - 70;
                drawTitle(content, "Venta Pasajes", 54, top);
                drawRight(content, "Boleto " + text(ticket.ticketNumber()), width - 54, top);

                drawLine(content, 54, top - 18, width - 54, top - 18);
                drawLabelValue(content, "Ruta", route(ticket), 54, top - 62);
                drawLabelValue(content, "Salida", date(ticket.departureAt()), 320, top - 62);
                drawLabelValue(content, "Pasajero", text(ticket.passengerName()), 54, top - 116);
                drawLabelValue(content, "Documento", documentLabel(ticket), 320, top - 116);
                drawLabelValue(content, "Bus", busLabel(ticket), 54, top - 170);
                drawLabelValue(content, "Asiento", text(ticket.seatNumber()), 320, top - 170);
                drawLabelValue(content, "Tarifa", amount(ticket.price()) + " " + text(ticket.currency()).toUpperCase(),
                        54, top - 224);
                drawLabelValue(content, "Emitido", date(ticket.soldAt()), 320, top - 224);

                drawLine(content, 54, top - 270, width - 54, top - 270);
                drawSmall(content, "Comprobante generado desde document-service.", 54, top - 296);
                drawSmall(content, "Plantilla HTML aplicada: " + templateHtml.length() + " bytes.", 54, top - 314);
            }

            document.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new WebApplicationException("Could not generate ticket PDF.", ex,
                    Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    private static void drawTitle(PDPageContentStream content, String value, float x, float y) throws IOException {
        content.beginText();
        content.setFont(PDType1Font.HELVETICA_BOLD, 22);
        content.newLineAtOffset(x, y);
        content.showText(value);
        content.endText();
    }

    private static void drawRight(PDPageContentStream content, String value, float rightX, float y) throws IOException {
        float textWidth = PDType1Font.HELVETICA_BOLD.getStringWidth(value) / 1000 * 14;
        content.beginText();
        content.setFont(PDType1Font.HELVETICA_BOLD, 14);
        content.newLineAtOffset(rightX - textWidth, y + 4);
        content.showText(value);
        content.endText();
    }

    private static void drawLabelValue(PDPageContentStream content, String label, String value, float x, float y)
            throws IOException {
        drawSmall(content, label.toUpperCase(), x, y);
        content.beginText();
        content.setFont(PDType1Font.HELVETICA_BOLD, 14);
        content.newLineAtOffset(x, y - 20);
        content.showText(limit(value, 34));
        content.endText();
    }

    private static void drawSmall(PDPageContentStream content, String value, float x, float y) throws IOException {
        content.beginText();
        content.setFont(PDType1Font.HELVETICA, 9);
        content.newLineAtOffset(x, y);
        content.showText(limit(value, 82));
        content.endText();
    }

    private static void drawLine(PDPageContentStream content, float startX, float startY, float endX, float endY)
            throws IOException {
        content.moveTo(startX, startY);
        content.lineTo(endX, endY);
        content.stroke();
    }

    private static String route(TicketDocumentData ticket) {
        return text(ticket.origin()) + " - " + text(ticket.destination());
    }

    private static String documentLabel(TicketDocumentData ticket) {
        String type = text(ticket.documentType());
        String number = text(ticket.documentNumber());
        return type.isBlank() ? number : type + " " + number;
    }

    private static String busLabel(TicketDocumentData ticket) {
        String busType = text(ticket.busType());
        String busCode = text(ticket.busCode());
        return busType.isBlank() ? busCode : busCode + " / " + busType;
    }

    private static String date(Instant instant) {
        return instant == null ? "-" : DISPLAY_DATE.format(instant);
    }

    private static String amount(BigDecimal amount) {
        return amount == null ? "0.00" : amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private static String text(String value) {
        return sanitize(value == null ? "-" : value.trim());
    }

    private static String sanitize(String value) {
        return value.replace('\n', ' ').replace('\r', ' ');
    }

    private static String limit(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 3) + "...";
    }
}
