package com.ventapasajes.report.engine;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;

import org.jfree.chart.ChartFactory;
import org.jfree.chart.ChartUtilities;
import org.jfree.chart.JFreeChart;
import org.jfree.chart.plot.CategoryPlot;
import org.jfree.chart.plot.PiePlot;
import org.jfree.chart.plot.Plot;
import org.jfree.chart.plot.PlotOrientation;
import org.jfree.chart.plot.RingPlot;
import org.jfree.chart.plot.SpiderWebPlot;
import org.jfree.data.category.DefaultCategoryDataset;
import org.jfree.data.general.DefaultPieDataset;
import org.jfree.data.xy.XYSeries;
import org.jfree.data.xy.XYSeriesCollection;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import com.fasterxml.jackson.databind.JsonNode;

/** Renders supported Word chart types as PNGs for the docx4j PDF exporter. */
final class ChartImageRenderer {
    private static final String CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
    private static final Color INK = new Color(31, 41, 55);
    private static final Color GRID = new Color(226, 232, 240);
    private static final DecimalFormat NUMBER = new DecimalFormat("0.##");

    byte[] render(byte[] chartXml, JsonNode definition, String chartKey) {
        try {
            Document chart = parse(chartXml);
            String type = chartType(chart);
            String title = chartTitle(chart);
            JsonNode categories = definition.path("categories");
            JsonNode series = definition.path("series");
            if (!categories.isArray() || !series.isArray() || series.isEmpty()) {
                throw new IllegalArgumentException("El grafico " + chartKey + " no tiene datos para PDF.");
            }

            JFreeChart rendered = switch (type) {
                case "pieChart" -> pie(title, categories, series, false);
                case "doughnutChart" -> pie(title, categories, series, true);
                case "scatterChart", "bubbleChart" -> scatter(title, categories, series);
                case "radarChart" -> radar(title, categories, series);
                case "barChart" -> bars(title, categories, series, chart);
                case "areaChart" -> area(title, categories, series);
                case "lineChart" -> line(title, categories, series);
                default -> line(title, categories, series);
            };
            style(rendered);
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                ChartUtilities.writeChartAsPNG(output, rendered, 900, 520, true, 0);
                return output.toByteArray();
            }
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo preparar " + chartKey + " para PDF.", error);
        }
    }

    private JFreeChart bars(String title, JsonNode categories, JsonNode series, Document chart) {
        DefaultCategoryDataset dataset = categoryDataset(categories, series);
        String direction = text(chart, "barDir", "col");
        String grouping = text(chart, "grouping", "clustered");
        PlotOrientation orientation = "bar".equals(direction) ? PlotOrientation.HORIZONTAL : PlotOrientation.VERTICAL;
        if ("stacked".equals(grouping) || "percentStacked".equals(grouping)) {
            return ChartFactory.createStackedBarChart(title, "Categoria", "Valor", dataset, orientation, true, true, false);
        }
        return ChartFactory.createBarChart(title, "Categoria", "Valor", dataset, orientation, true, true, false);
    }

    private JFreeChart area(String title, JsonNode categories, JsonNode series) {
        return ChartFactory.createAreaChart(title, "Categoria", "Valor", categoryDataset(categories, series),
                PlotOrientation.VERTICAL, true, true, false);
    }

    private JFreeChart line(String title, JsonNode categories, JsonNode series) {
        return ChartFactory.createLineChart(title, "Categoria", "Valor", categoryDataset(categories, series),
                PlotOrientation.VERTICAL, true, true, false);
    }

    private JFreeChart pie(String title, JsonNode categories, JsonNode series, boolean doughnut) {
        DefaultPieDataset dataset = new DefaultPieDataset();
        JsonNode values = series.get(0).path("values");
        for (int index = 0; index < categories.size() && index < values.size(); index++) {
            dataset.setValue(category(categories.get(index)), number(values.get(index)));
        }
        if (doughnut) return new JFreeChart(title, JFreeChart.DEFAULT_TITLE_FONT, new RingPlot(dataset), true);
        return ChartFactory.createPieChart(title, dataset, true, true, false);
    }

    private JFreeChart radar(String title, JsonNode categories, JsonNode series) {
        return new JFreeChart(title, JFreeChart.DEFAULT_TITLE_FONT,
                new SpiderWebPlot(categoryDataset(categories, series)), true);
    }

    private JFreeChart scatter(String title, JsonNode categories, JsonNode series) {
        XYSeriesCollection dataset = new XYSeriesCollection();
        for (JsonNode serie : series) {
            XYSeries points = new XYSeries(serie.path("name").asText("Serie"));
            JsonNode values = serie.path("values");
            for (int index = 0; index < values.size(); index++) points.add(index + 1, number(values.get(index)));
            dataset.addSeries(points);
        }
        return ChartFactory.createScatterPlot(title, "Categoria", "Valor", dataset, PlotOrientation.VERTICAL, true, true, false);
    }

    private DefaultCategoryDataset categoryDataset(JsonNode categories, JsonNode series) {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        for (JsonNode serie : series) {
            String name = serie.path("name").asText("Serie");
            JsonNode values = serie.path("values");
            for (int index = 0; index < categories.size() && index < values.size(); index++) {
                dataset.addValue(number(values.get(index)), name, category(categories.get(index)));
            }
        }
        return dataset;
    }

    private void style(JFreeChart chart) {
        chart.setBackgroundPaint(Color.WHITE);
        if (chart.getTitle() != null) {
            chart.getTitle().setPaint(INK);
            chart.getTitle().setFont(new Font("SansSerif", Font.BOLD, 18));
        }
        Plot plot = chart.getPlot();
        plot.setBackgroundPaint(Color.WHITE);
        plot.setOutlinePaint(new Color(203, 213, 225));
        plot.setNoDataMessage("Sin datos");
        if (plot instanceof CategoryPlot categoryPlot) {
            categoryPlot.setDomainGridlinePaint(GRID);
            categoryPlot.setRangeGridlinePaint(GRID);
            categoryPlot.getDomainAxis().setTickLabelPaint(INK);
            categoryPlot.getRangeAxis().setTickLabelPaint(INK);
        }
        if (plot instanceof PiePlot piePlot) piePlot.setLabelPaint(INK);
    }

    private String chartType(Document document) {
        String[] types = {"areaChart", "barChart", "lineChart", "pieChart", "doughnutChart", "scatterChart", "radarChart", "bubbleChart"};
        for (String type : types) if (document.getElementsByTagNameNS(CHART_NS, type).getLength() > 0) return type;
        return "lineChart";
    }

    private String chartTitle(Document document) {
        NodeList titles = document.getElementsByTagNameNS(CHART_NS, "title");
        if (titles.getLength() == 0) return "";
        NodeList texts = ((Element) titles.item(0)).getElementsByTagNameNS(CHART_NS, "t");
        if (texts.getLength() == 0 || texts.item(0).getTextContent().isBlank()) return "";
        return texts.item(0).getTextContent().trim();
    }

    private String text(Document document, String localName, String fallback) {
        NodeList values = document.getElementsByTagNameNS(CHART_NS, localName);
        if (values.getLength() == 0) return fallback;
        String value = ((Element) values.item(0)).getAttribute("val");
        return value.isBlank() ? fallback : value;
    }

    private String category(JsonNode value) {
        if (value.isNumber()) return NUMBER.format(value.asDouble());
        return value.asText();
    }

    private double number(JsonNode value) {
        if (!value.isNumber()) throw new IllegalArgumentException("Los valores de un grafico deben ser numericos.");
        return value.asDouble();
    }

    private Document parse(byte[] bytes) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new InputSource(new java.io.ByteArrayInputStream(bytes)));
    }
}
