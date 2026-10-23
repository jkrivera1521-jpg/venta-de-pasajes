package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Comment;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.Drawing;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

/** Converts legacy cell tags to the comment commands understood by JXLS 3. */
public final class LegacyJxlsTemplateAdapter {
    /* Some historical templates in the catalog use jt:forEach instead of jx:forEach. */
    private static final Pattern OPEN_TAG = Pattern.compile("<\\s*j[xt]:forEach\\b([^>]*)>", Pattern.CASE_INSENSITIVE);
    private static final Pattern CLOSE_TAG = Pattern.compile("<\\s*/\\s*j[xt]:forEach\\s*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXPRESSION = Pattern.compile("\\$\\{[^}]+}");
    private static final Pattern ATTRIBUTE = Pattern.compile("([A-Za-z]+)\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']");

    private LegacyJxlsTemplateAdapter() {
    }

    public static byte[] adapt(byte[] content) {
        if (content == null || content.length == 0) return content;
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            boolean changed = false;
            for (Sheet sheet : workbook) changed |= adaptSheet(workbook, sheet);
            if (!changed) return content;
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                workbook.write(output);
                return output.toByteArray();
            }
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo adaptar la plantilla JXLS legado.", error);
        }
    }

    private static boolean adaptSheet(Workbook workbook, Sheet sheet) {
        Deque<OpeningTag> openings = new ArrayDeque<>();
        ArrayList<LegacyRange> ranges = new ArrayList<>();
        Drawing<?> drawing = null;
        boolean changed = false;
        boolean hasExpressions = false;

        for (Row row : sheet) {
            for (Cell cell : row) {
                if (cell.getCellType() != CellType.STRING) continue;
                String value = cell.getStringCellValue();
                hasExpressions |= EXPRESSION.matcher(value).find();
                Matcher open = OPEN_TAG.matcher(value);
                while (open.find()) {
                    String items = attribute(open.group(1), "items");
                    String variable = attribute(open.group(1), "var");
                    if (items != null && variable != null) openings.push(new OpeningTag(row.getRowNum(), cell.getColumnIndex(), items, variable));
                    changed = true;
                }

                Matcher close = CLOSE_TAG.matcher(value);
                while (close.find() && !openings.isEmpty()) {
                    OpeningTag opening = openings.pop();
                    int bodyStart = opening.row() == row.getRowNum() ? opening.row() : opening.row() + 1;
                    int bodyEnd = opening.row() == row.getRowNum() ? row.getRowNum() : row.getRowNum() - 1;
                    ranges.add(new LegacyRange(opening, row.getRowNum(), bodyStart, bodyEnd, lastColumn(sheet, bodyStart, bodyEnd)));
                    changed = true;
                }

                if (hasLegacyTag(value)) {
                    String cleaned = CLOSE_TAG.matcher(OPEN_TAG.matcher(value).replaceAll("")).replaceAll("");
                    cell.setCellValue(cleaned);
                }
            }
        }

        for (LegacyRange range : ranges) {
            int bodyRow = Math.max(range.bodyStart(), Math.min(range.bodyEnd(), range.opening().row()));
            int bodyColumn = range.opening().column();
            Cell commandCell = sheet.getRow(bodyRow).getCell(bodyColumn, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK);
            String lastCell = columnName(range.lastColumn()) + (range.bodyEnd() + 1);
            String command = "jx:each(items=\"" + expression(range.opening().items()) + "\" var=\"" + range.opening().variable() + "\" lastCell=\"" + lastCell + "\")";
            if (drawing == null) drawing = sheet.createDrawingPatriarch();
            appendComment(workbook, drawing, commandCell, command);
        }

        if (hasExpressions || !ranges.isEmpty()) {
            if (drawing == null) drawing = sheet.createDrawingPatriarch();
            addAreaComment(workbook, sheet, drawing);
            changed = true;
        }
        return changed;
    }

    private static boolean hasLegacyTag(String value) {
        return OPEN_TAG.matcher(value).find() || CLOSE_TAG.matcher(value).find();
    }

    private static int lastColumn(Sheet sheet, int startRow, int endRow) {
        int lastColumn = 0;
        for (int rowIndex = Math.max(0, startRow); rowIndex <= Math.max(startRow, endRow); rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row != null && row.getLastCellNum() > 0) lastColumn = Math.max(lastColumn, row.getLastCellNum() - 1);
        }
        return lastColumn;
    }

    private static void addAreaComment(Workbook workbook, Sheet sheet, Drawing<?> drawing) {
        UsedRange range = usedRange(sheet);
        Cell anchor = areaAnchor(sheet, range);
        if (anchor == null || range == null) return;
        String area = "jx:area(lastCell=\"" + columnName(range.maxColumn()) + (range.maxRow() + 1) + "\")";
        appendComment(workbook, drawing, anchor, area);
    }

    private static UsedRange usedRange(Sheet sheet) {
        int minRow = Integer.MAX_VALUE;
        int minColumn = Integer.MAX_VALUE;
        int maxRow = -1;
        int maxColumn = -1;
        for (Row row : sheet) {
            for (Cell cell : row) {
                if (cell.getCellType() == CellType.BLANK) continue;
                minRow = Math.min(minRow, cell.getRowIndex());
                minColumn = Math.min(minColumn, cell.getColumnIndex());
                maxRow = Math.max(maxRow, cell.getRowIndex());
                maxColumn = Math.max(maxColumn, cell.getColumnIndex());
            }
        }
        return maxRow < 0 ? null : new UsedRange(minRow, minColumn, maxRow, maxColumn);
    }

    /** JXLS starts an area at the cell carrying the comment, so use the true left edge of the sheet. */
    private static Cell areaAnchor(Sheet sheet, UsedRange range) {
        if (range == null) return null;
        Cell anchor = null;
        for (Row row : sheet) {
            for (Cell cell : row) {
                if (cell.getCellType() == CellType.BLANK || cell.getColumnIndex() != range.minColumn()) continue;
                if (anchor == null || cell.getRowIndex() < anchor.getRowIndex()) anchor = cell;
            }
        }
        return anchor;
    }

    private static void appendComment(Workbook workbook, Drawing<?> drawing, Cell cell, String value) {
        Comment comment = cell.getCellComment();
        CreationHelper helper = workbook.getCreationHelper();
        if (comment == null) {
            var anchor = helper.createClientAnchor();
            anchor.setCol1(cell.getColumnIndex());
            anchor.setCol2(cell.getColumnIndex() + 3);
            anchor.setRow1(cell.getRowIndex());
            anchor.setRow2(cell.getRowIndex() + 3);
            comment = drawing.createCellComment(anchor);
            comment.setAuthor("report-service");
            cell.setCellComment(comment);
        }
        String current = comment.getString() == null ? "" : comment.getString().getString();
        if (!current.toLowerCase(Locale.ROOT).contains(value.substring(0, value.indexOf('(')).toLowerCase(Locale.ROOT))) {
            comment.setString(helper.createRichTextString(current.isBlank() ? value : current + "\n" + value));
        }
    }

    private static String attribute(String attributes, String name) {
        Matcher matcher = ATTRIBUTE.matcher(attributes == null ? "" : attributes);
        while (matcher.find()) if (matcher.group(1).equalsIgnoreCase(name)) return matcher.group(2).trim();
        return null;
    }

    private static String expression(String value) {
        String result = value.trim();
        if (result.startsWith("${") && result.endsWith("}")) result = result.substring(2, result.length() - 1).trim();
        return result;
    }

    private static String columnName(int zeroBasedColumn) {
        int value = Math.max(0, zeroBasedColumn) + 1;
        StringBuilder result = new StringBuilder();
        while (value > 0) {
            int remainder = (value - 1) % 26;
            result.append((char) ('A' + remainder));
            value = (value - 1) / 26;
        }
        return result.reverse().toString();
    }

    private record OpeningTag(int row, int column, String items, String variable) {
    }

    private record LegacyRange(OpeningTag opening, int closingRow, int bodyStart, int bodyEnd, int lastColumn) {
    }

    private record UsedRange(int minRow, int minColumn, int maxRow, int maxColumn) {
    }
}
