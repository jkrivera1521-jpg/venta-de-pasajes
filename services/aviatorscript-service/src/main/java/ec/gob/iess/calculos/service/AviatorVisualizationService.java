package ec.gob.iess.calculos.service;

import ec.gob.iess.calculos.dto.AviatorSourceRange;
import ec.gob.iess.calculos.dto.AviatorVisualizationBranch;
import ec.gob.iess.calculos.dto.AviatorVisualizationDiagnostic;
import ec.gob.iess.calculos.dto.AviatorVisualizationEdge;
import ec.gob.iess.calculos.dto.AviatorVisualizationNode;
import ec.gob.iess.calculos.dto.AviatorVisualizationResponse;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Analiza la estructura de un programa AviatorScript sin compilarlo ni ejecutarlo.
 * El parser es deliberadamente acotado: produce un CFG para las instrucciones
 * que el editor visual puede representar y devuelve diagnosticos accionables.
 */
@ApplicationScoped
public class AviatorVisualizationService {

    private static final int MAX_SOURCE_LENGTH = 10_000;
    private static final int MAX_TOKENS = 4_096;
    private static final int MAX_NESTING = 80;
    private static final Set<String> KEYWORDS = Set.of(
            "if", "elsif", "else", "for", "in", "while", "let", "continue", "break", "throw", "return",
            "true", "false", "nil", "null", "and", "or", "not");

    public AviatorVisualizationResponse analyze(String source, boolean includeSourceMapping) {
        List<AviatorVisualizationDiagnostic> diagnostics = new ArrayList<>();
        if (source == null || source.isBlank()) {
            diagnostics.add(error("Escribe una formula AviatorScript para analizarla.", 1, 1));
            return response(false, List.of(), List.of(), diagnostics);
        }
        if (source.length() > MAX_SOURCE_LENGTH) {
            diagnostics.add(error("El codigo supera el limite de " + MAX_SOURCE_LENGTH + " caracteres.", 1, 1));
            return response(false, List.of(), List.of(), diagnostics);
        }

        List<Token> tokens = new Lexer(source, diagnostics).lex();
        if (tokens.size() > MAX_TOKENS) {
            diagnostics.add(error("El codigo supera el limite de " + MAX_TOKENS + " tokens.", tokens.get(Math.min(MAX_TOKENS, tokens.size() - 1)).line(), 1));
            return response(false, List.of(), List.of(), diagnostics);
        }

        List<Statement> statements = List.of();
        try {
            statements = new Parser(tokens).parseProgram();
        } catch (ParseFailure failure) {
            diagnostics.add(error(failure.getMessage(), failure.token().line(), failure.token().column()));
        }

        FlowAnalyzer analyzer = new FlowAnalyzer(source, includeSourceMapping);
        analyzer.build(statements);
        diagnostics.addAll(analyzer.diagnostics());
        return response(diagnostics.stream().noneMatch(item -> "error".equals(item.severity())), analyzer.nodes(), analyzer.edges(), diagnostics);
    }

    private static AviatorVisualizationDiagnostic error(String message, int line, int column) {
        return new AviatorVisualizationDiagnostic("error", message, line, column);
    }

    private static AviatorVisualizationResponse response(boolean valid, List<AviatorVisualizationNode> nodes,
                                                          List<AviatorVisualizationEdge> edges,
                                                          List<AviatorVisualizationDiagnostic> diagnostics) {
        return new AviatorVisualizationResponse(valid, nodes, edges, diagnostics);
    }

    private enum TokenKind { IDENTIFIER, NUMBER, STRING, OPERATOR, SYMBOL, COMMENT, EOF }

    private record Token(TokenKind kind, String text, int start, int end, int line, int column) {
    }

    private static final class Lexer {
        private static final List<String> OPERATORS = Arrays.asList(
                ">>>", "===", "!==", "**", "<<", ">>", "&&", "||", "==", "!=", ">=", "<=", "=~", "=>", "+=", "-=", "*=", "/=", ">", "<", "=", "+", "-", "*", "/", "%", "!", "?", ":");
        private final String source;
        private final List<AviatorVisualizationDiagnostic> diagnostics;
        private final List<Token> tokens = new ArrayList<>();
        private int index;
        private int line = 1;
        private int column = 1;

        private Lexer(String source, List<AviatorVisualizationDiagnostic> diagnostics) {
            this.source = source;
            this.diagnostics = diagnostics;
        }

        private List<Token> lex() {
            while (index < source.length()) {
                char current = source.charAt(index);
                if (Character.isWhitespace(current)) {
                    advance(current);
                    continue;
                }
                if ((current == '#' && peek(1) == '#') || (current == '/' && peek(1) == '/')) {
                    lexComment();
                } else if (current == '"' || current == '\'') {
                    lexString(current);
                } else if (Character.isLetter(current) || current == '_' || current == '$') {
                    lexIdentifier();
                } else if (Character.isDigit(current) || (current == '.' && Character.isDigit(peek(1)))) {
                    lexNumber();
                } else if (!lexOperator()) {
                    Token token = token(TokenKind.SYMBOL, String.valueOf(current), index, index + 1, line, column);
                    tokens.add(token);
                    advance(current);
                }
            }
            tokens.add(new Token(TokenKind.EOF, "", source.length(), source.length(), line, column));
            return tokens;
        }

        private void lexComment() {
            int start = index;
            int startLine = line;
            int startColumn = column;
            while (index < source.length() && source.charAt(index) != '\n') advance(source.charAt(index));
            tokens.add(token(TokenKind.COMMENT, source.substring(start, index), start, index, startLine, startColumn));
        }

        private void lexString(char quote) {
            int start = index;
            int startLine = line;
            int startColumn = column;
            advance(quote);
            boolean closed = false;
            while (index < source.length()) {
                char current = source.charAt(index);
                if (current == '\\') {
                    advance(current);
                    if (index < source.length()) advance(source.charAt(index));
                } else if (current == quote) {
                    advance(current);
                    closed = true;
                    break;
                } else {
                    advance(current);
                }
            }
            if (!closed) diagnostics.add(error("Cadena sin cerrar.", startLine, startColumn));
            tokens.add(token(TokenKind.STRING, source.substring(start, index), start, index, startLine, startColumn));
        }

        private void lexIdentifier() {
            int start = index;
            int startLine = line;
            int startColumn = column;
            while (index < source.length()) {
                char current = source.charAt(index);
                if (Character.isLetterOrDigit(current) || current == '_' || current == '$' || current == '.') advance(current);
                else break;
            }
            tokens.add(token(TokenKind.IDENTIFIER, source.substring(start, index), start, index, startLine, startColumn));
        }

        private void lexNumber() {
            int start = index;
            int startLine = line;
            int startColumn = column;
            while (index < source.length() && (Character.isDigit(source.charAt(index)) || source.charAt(index) == '.')) advance(source.charAt(index));
            tokens.add(token(TokenKind.NUMBER, source.substring(start, index), start, index, startLine, startColumn));
        }

        private boolean lexOperator() {
            for (String operator : OPERATORS) {
                if (!source.startsWith(operator, index)) continue;
                int start = index;
                int startLine = line;
                int startColumn = column;
                for (int offset = 0; offset < operator.length(); offset++) advance(source.charAt(index));
                tokens.add(token(TokenKind.OPERATOR, operator, start, index, startLine, startColumn));
                return true;
            }
            return false;
        }

        private char peek(int offset) {
            int position = index + offset;
            return position < source.length() ? source.charAt(position) : '\0';
        }

        private void advance(char current) {
            index++;
            if (current == '\n') {
                line++;
                column = 1;
            } else {
                column++;
            }
        }

        private Token token(TokenKind kind, String text, int start, int end, int line, int column) {
            return new Token(kind, text, start, end, line, column);
        }
    }

    private enum StatementKind { SECTION, DECLARATION, ASSIGNMENT, IF, FOR, WHILE, CONTINUE, BREAK, THROW, RETURN, EXPRESSION }

    private static final class Statement {
        private final StatementKind kind;
        private final Token start;
        private Token end;
        private String name = "";
        private String expression = "";
        private String condition = "";
        private String title = "";
        private String item = "";
        private final List<Statement> body = new ArrayList<>();
        private final List<Branch> elseIf = new ArrayList<>();
        private final List<Statement> otherwise = new ArrayList<>();

        private Statement(StatementKind kind, Token start) {
            this.kind = kind;
            this.start = start;
            this.end = start;
        }
    }

    private static final class Branch {
        private final Token start;
        private Token end;
        private final String condition;
        private final List<Statement> body = new ArrayList<>();

        private Branch(Token start, String condition) {
            this.start = start;
            this.end = start;
            this.condition = condition;
        }
    }

    private static final class ParseFailure extends RuntimeException {
        private final Token token;

        private ParseFailure(String message, Token token) {
            super(message);
            this.token = token;
        }

        private Token token() {
            return token;
        }
    }

    private static final class Parser {
        private final List<Token> tokens;
        private int position;
        private int nesting;

        private Parser(List<Token> tokens) {
            this.tokens = tokens;
        }

        private List<Statement> parseProgram() {
            return parseStatements(false);
        }

        private List<Statement> parseStatements(boolean insideBlock) {
            List<Statement> result = new ArrayList<>();
            while (!is(TokenKind.EOF) && !(insideBlock && is("}"))) {
                if (is(TokenKind.COMMENT)) {
                    Token comment = consume();
                    if (comment.text().startsWith("##")) {
                        Statement section = new Statement(StatementKind.SECTION, comment);
                        section.title = comment.text().substring(2).trim();
                        section.end = comment;
                        result.add(section);
                    }
                    continue;
                }
                if (is(";")) {
                    consume();
                    continue;
                }
                result.add(parseStatement());
            }
            if (insideBlock) expect("}", "Se esperaba cerrar el bloque con '}'.");
            return result;
        }

        private Statement parseStatement() {
            if (is("if")) return parseIf();
            if (is("for")) return parseFor();
            if (is("while")) return parseWhile();
            if (is("let")) return parseDeclaration();
            if (is("continue")) return parseSimple(StatementKind.CONTINUE);
            if (is("break")) return parseSimple(StatementKind.BREAK);
            if (is("throw")) return parseSimple(StatementKind.THROW);
            if (is("return")) return parseSimple(StatementKind.RETURN);
            if (current().kind() == TokenKind.IDENTIFIER && (look(1).text().equals("=") || look(1).text().endsWith("="))) return parseAssignment();
            return parseExpressionStatement();
        }

        private Statement parseDeclaration() {
            Token start = consume();
            Token name = expectKind(TokenKind.IDENTIFIER, "Se esperaba el nombre de la variable despues de 'let'.");
            expect("=", "Se esperaba '=' en la declaracion.");
            Statement statement = new Statement(StatementKind.DECLARATION, start);
            statement.name = name.text();
            statement.expression = collectExpression();
            statement.end = previous();
            return statement;
        }

        private Statement parseAssignment() {
            Token start = consume();
            Token equals = consume();
            Statement statement = new Statement(StatementKind.ASSIGNMENT, start);
            statement.name = start.text();
            statement.expression = collectExpression();
            statement.end = previous().end() >= equals.end() ? previous() : equals;
            return statement;
        }

        private Statement parseSimple(StatementKind kind) {
            Token start = consume();
            Statement statement = new Statement(kind, start);
            statement.expression = collectExpression();
            statement.end = previous();
            return statement;
        }

        private Statement parseExpressionStatement() {
            Token start = consume();
            Statement statement = new Statement(StatementKind.EXPRESSION, start);
            statement.expression = collectExpression(start);
            statement.end = previous();
            return statement;
        }

        private Statement parseIf() {
            Token start = consume();
            Statement statement = new Statement(StatementKind.IF, start);
            statement.condition = collectCondition();
            requireBlock(statement.body);
            while (is("elsif")) {
                Token branchStart = consume();
                Branch branch = new Branch(branchStart, collectCondition());
                requireBlock(branch.body);
                branch.end = previous();
                statement.elseIf.add(branch);
            }
            if (is("else")) {
                consume();
                requireBlock(statement.otherwise);
            }
            statement.end = previous();
            return statement;
        }

        private Statement parseFor() {
            Token start = consume();
            Token item = expectKind(TokenKind.IDENTIFIER, "Se esperaba la variable del ciclo.");
            expect("in", "Se esperaba 'in' en el ciclo.");
            Statement statement = new Statement(StatementKind.FOR, start);
            statement.item = item.text();
            statement.expression = collectUntilBlock();
            requireBlock(statement.body);
            statement.end = previous();
            return statement;
        }

        private Statement parseWhile() {
            Token start = consume();
            Statement statement = new Statement(StatementKind.WHILE, start);
            statement.condition = collectConditionOrBlock();
            requireBlock(statement.body);
            statement.end = previous();
            return statement;
        }

        private void requireBlock(List<Statement> destination) {
            expect("{", "Se esperaba '{' para iniciar el bloque.");
            if (++nesting > MAX_NESTING) throw new ParseFailure("La profundidad de bloques supera el limite permitido.", previous());
            destination.addAll(parseStatements(true));
            nesting--;
        }

        private String collectCondition() {
            if (is("(")) {
                consume();
                return collectBalanced(")");
            }
            return collectUntilBlock();
        }

        private String collectConditionOrBlock() {
            return collectCondition();
        }

        private String collectUntilBlock() {
            return collectTokens(true);
        }

        private String collectExpression() {
            return collectTokens(false);
        }

        private String collectExpression(Token first) {
            return joinTokens(first, collectTokens(false));
        }

        private String collectBalanced(String closing) {
            List<Token> collected = new ArrayList<>();
            int depth = 1;
            while (!is(TokenKind.EOF)) {
                Token token = consume();
                if (token.text().equals("(")) depth++;
                if (token.text().equals(closing)) {
                    depth--;
                    if (depth == 0) return joinTokens(collected);
                }
                collected.add(token);
            }
            throw new ParseFailure("Se esperaba cerrar la condicion con '" + closing + "'.", current());
        }

        private String collectTokens(boolean stopAtBlock) {
            List<Token> collected = new ArrayList<>();
            int parentheses = 0;
            int brackets = 0;
            int braces = 0;
            while (!is(TokenKind.EOF)) {
                Token token = current();
                if (parentheses == 0 && brackets == 0 && braces == 0 && (token.text().equals(";") || token.text().equals("}"))) {
                    if (token.text().equals(";")) consume();
                    break;
                }
                if (stopAtBlock && parentheses == 0 && brackets == 0 && braces == 0 && token.text().equals("{")) break;
                consume();
                if (token.text().equals("(")) parentheses++;
                if (token.text().equals(")")) parentheses--;
                if (token.text().equals("[")) brackets++;
                if (token.text().equals("]")) brackets--;
                if (token.text().equals("{")) braces++;
                if (token.text().equals("}")) braces--;
                collected.add(token);
            }
            return joinTokens(collected);
        }

        private String joinTokens(Token first, String rest) {
            return (first.text() + (rest.isBlank() ? "" : " " + rest)).trim();
        }

        private String joinTokens(List<Token> values) {
            return values.stream().map(Token::text).collect(Collectors.joining(" ")).trim();
        }

        private Token expectKind(TokenKind kind, String message) {
            if (current().kind() != kind) throw new ParseFailure(message, current());
            return consume();
        }

        private Token expect(String expected, String message) {
            if (!is(expected)) throw new ParseFailure(message, current());
            return consume();
        }

        private boolean is(String text) {
            return current().text().equals(text);
        }

        private boolean is(TokenKind kind) {
            return current().kind() == kind;
        }

        private Token current() {
            return tokens.get(Math.min(position, tokens.size() - 1));
        }

        private Token look(int offset) {
            return tokens.get(Math.min(position + offset, tokens.size() - 1));
        }

        private Token consume() {
            Token value = current();
            position = Math.min(position + 1, tokens.size() - 1);
            return value;
        }

        private Token previous() {
            return tokens.get(Math.max(0, position - 1));
        }
    }

    private record Fragment(String entry, List<String> normal, List<String> breaks, List<String> continues, List<String> terminals) {
        private static Fragment empty() {
            return new Fragment(null, new ArrayList<>(), new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
        }
    }

    private static final class NodeDraft {
        private final String id;
        private final String type;
        private final String label;
        private final String instruction;
        private final String sourceCode;
        private final AviatorSourceRange source;
        private final List<String> referencedVariables;
        private final List<String> assignedVariables;
        private final List<AviatorVisualizationBranch> branches = new ArrayList<>();
        private final boolean synthetic;

        private NodeDraft(String id, String type, String label, String instruction, String sourceCode,
                          AviatorSourceRange source, List<String> referencedVariables, List<String> assignedVariables,
                          boolean synthetic) {
            this.id = id;
            this.type = type;
            this.label = label;
            this.instruction = instruction;
            this.sourceCode = sourceCode;
            this.source = source;
            this.referencedVariables = referencedVariables;
            this.assignedVariables = assignedVariables;
            this.synthetic = synthetic;
        }
    }

    private record EdgeDraft(String id, String source, String target, String label) {
    }

    private static final class FlowAnalyzer {
        private final String source;
        private final boolean includeSource;
        private final List<NodeDraft> nodeDrafts = new ArrayList<>();
        private final List<EdgeDraft> edgeDrafts = new ArrayList<>();
        private final List<AviatorVisualizationDiagnostic> diagnostics = new ArrayList<>();
        private int nodeCounter;
        private int edgeCounter;

        private FlowAnalyzer(String source, boolean includeSource) {
            this.source = source;
            this.includeSource = includeSource;
        }

        private void build(List<Statement> statements) {
            NodeDraft start = addNode("start", "Inicio", "Inicio del proceso", null, true);
            NodeDraft end = addNode("end", "Fin", "Finalizacion normal", null, true);
            Fragment sequence = buildSequence(statements);
            if (sequence.entry() == null) {
                addEdge(start.id, end.id, "vacio");
            } else {
                addEdge(start.id, sequence.entry(), "inicio");
                sequence.normal().forEach(exit -> addEdge(exit, end.id, "fin"));
            }
            sequence.terminals().forEach(exit -> addEdge(exit, end.id, "fin"));
            finalizeGraph();
        }

        private Fragment buildSequence(List<Statement> statements) {
            String entry = null;
            List<String> previous = new ArrayList<>();
            List<String> breaks = new ArrayList<>();
            List<String> continues = new ArrayList<>();
            List<String> terminals = new ArrayList<>();
            for (Statement statement : statements) {
                Fragment current = buildStatement(statement);
                if (entry == null) entry = current.entry();
                for (String exit : previous) if (current.entry() != null) addEdge(exit, current.entry(), "siguiente");
                previous = new ArrayList<>(current.normal());
                breaks.addAll(current.breaks());
                continues.addAll(current.continues());
                terminals.addAll(current.terminals());
            }
            return new Fragment(entry, previous, breaks, continues, terminals);
        }

        private Fragment buildStatement(Statement statement) {
            if (statement.kind == StatementKind.IF) return buildIf(statement);
            if (statement.kind == StatementKind.FOR || statement.kind == StatementKind.WHILE) return buildLoop(statement);

            String type = switch (statement.kind) {
                case THROW -> "exception";
                case RETURN -> "return";
                case EXPRESSION -> statement.expression.startsWith("seq.") ? "function" : "process";
                default -> "process";
            };
            NodeDraft node = addNode(type, label(statement), instruction(statement), statement, false);
            if (statement.kind == StatementKind.THROW || statement.kind == StatementKind.RETURN) return new Fragment(node.id, List.of(), List.of(), List.of(), List.of(node.id));
            if (statement.kind == StatementKind.BREAK) return new Fragment(node.id, List.of(), List.of(node.id), List.of(), List.of());
            if (statement.kind == StatementKind.CONTINUE) return new Fragment(node.id, List.of(), List.of(), List.of(node.id), List.of());
            return new Fragment(node.id, List.of(node.id), List.of(), List.of(), List.of());
        }

        private Fragment buildIf(Statement statement) {
            NodeDraft decision = addNode("decision", "SI " + compact(statement.condition), "Decision", statement, false);
            NodeDraft merge = addNode("process", "Continuacion de la decision", "Punto de convergencia", statement, true);
            Fragment thenFragment = buildSequence(statement.body);
            addBranch(decision, "true", thenFragment.entry() == null ? merge.id : thenFragment.entry());
            addEdge(decision.id, thenFragment.entry() == null ? merge.id : thenFragment.entry(), "true");
            thenFragment.normal().forEach(exit -> addEdge(exit, merge.id, "siguiente"));
            List<String> terminals = new ArrayList<>(thenFragment.terminals());
            List<String> breaks = new ArrayList<>(thenFragment.breaks());
            List<String> continues = new ArrayList<>(thenFragment.continues());

            NodeDraft lastDecision = decision;
            for (Branch branch : statement.elseIf) {
                NodeDraft branchNode = addNode("decision", "SI NO " + compact(branch.condition), "Rama alternativa", branchAsStatement(branch), false);
                addBranch(lastDecision, "false", branchNode.id);
                addEdge(lastDecision.id, branchNode.id, "false");
                Fragment body = buildSequence(branch.body);
                addBranch(branchNode, "true", body.entry() == null ? merge.id : body.entry());
                addEdge(branchNode.id, body.entry() == null ? merge.id : body.entry(), "true");
                body.normal().forEach(exit -> addEdge(exit, merge.id, "siguiente"));
                terminals.addAll(body.terminals());
                breaks.addAll(body.breaks());
                continues.addAll(body.continues());
                lastDecision = branchNode;
            }
            if (!statement.otherwise.isEmpty()) {
                Fragment otherwise = buildSequence(statement.otherwise);
                String target = otherwise.entry() == null ? merge.id : otherwise.entry();
                addBranch(lastDecision, "false", target);
                addEdge(lastDecision.id, target, "false");
                otherwise.normal().forEach(exit -> addEdge(exit, merge.id, "siguiente"));
                terminals.addAll(otherwise.terminals());
                breaks.addAll(otherwise.breaks());
                continues.addAll(otherwise.continues());
            } else {
                addBranch(lastDecision, "false", merge.id);
                addEdge(lastDecision.id, merge.id, "false");
            }
            return new Fragment(decision.id, List.of(merge.id), breaks, continues, terminals);
        }

        private Fragment buildLoop(Statement statement) {
            String title = statement.kind == StatementKind.FOR
                    ? "PARA CADA " + statement.item + " EN " + compact(statement.expression)
                    : "MIENTRAS " + compact(statement.condition);
            NodeDraft loop = addNode("iteration", title, statement.kind == StatementKind.FOR ? "Iteracion" : "Ciclo while", statement, false);
            NodeDraft merge = addNode("process", "Salida del ciclo", "Punto de convergencia", statement, true);
            Fragment body = buildSequence(statement.body);
            addEdge(loop.id, body.entry() == null ? merge.id : body.entry(), "cuerpo");
            addEdge(loop.id, merge.id, "salir");
            body.normal().forEach(exit -> addEdge(exit, loop.id, "siguiente"));
            body.continues().forEach(exit -> addEdge(exit, loop.id, "continuar"));
            body.breaks().forEach(exit -> addEdge(exit, merge.id, "salir"));
            return new Fragment(loop.id, List.of(merge.id), List.of(), List.of(), body.terminals());
        }

        private Statement branchAsStatement(Branch branch) {
            Statement statement = new Statement(StatementKind.IF, branch.start);
            statement.condition = branch.condition;
            statement.body.addAll(branch.body);
            statement.end = branch.end;
            return statement;
        }

        private void addBranch(NodeDraft node, String label, String target) {
            node.branches.removeIf(branch -> branch.label().equals(label));
            node.branches.add(new AviatorVisualizationBranch(label, target));
        }

        private NodeDraft addNode(String type, String label, String instruction, Statement statement, boolean synthetic) {
            String id = "flow-" + (++nodeCounter);
            Token start = statement == null ? new Token(TokenKind.SYMBOL, "", 0, 0, 1, 1) : statement.start;
            Token end = statement == null ? start : statement.end;
            AviatorSourceRange range = includeSource ? new AviatorSourceRange(start.line(), start.column(), end.line(), Math.max(start.column(), end.column())) : new AviatorSourceRange(0, 0, 0, 0);
            String sourceCode = includeSource && statement != null ? safeSource(start.start(), end.end()) : "";
            List<String> references = statement == null ? List.of() : variables(statement.kind == StatementKind.IF ? statement.condition : statement.kind == StatementKind.FOR ? statement.expression : statement.expression);
            List<String> assigned = statement == null || statement.name.isBlank() ? List.of() : List.of(statement.name);
            NodeDraft node = new NodeDraft(id, type, compact(label), instruction, sourceCode, range, references, assigned, synthetic);
            nodeDrafts.add(node);
            return node;
        }

        private void addEdge(String sourceId, String targetId, String label) {
            if (sourceId == null || targetId == null || edgeDrafts.stream().anyMatch(edge -> edge.source().equals(sourceId) && edge.target().equals(targetId) && java.util.Objects.equals(edge.label(), label))) return;
            edgeDrafts.add(new EdgeDraft("flow-edge-" + (++edgeCounter), sourceId, targetId, label));
        }

        private List<String> variables(String expression) {
            if (expression == null || expression.isBlank()) return List.of();
            List<Token> tokens = new Lexer(expression, new ArrayList<>()).lex();
            Set<String> values = new LinkedHashSet<>();
            for (int index = 0; index < tokens.size() - 1; index++) {
                Token token = tokens.get(index);
                if (token.kind() != TokenKind.IDENTIFIER || KEYWORDS.contains(token.text())) continue;
                if (tokens.get(index + 1).text().equals("(")) continue;
                values.add(token.text());
            }
            return List.copyOf(values);
        }

        private String label(Statement statement) {
            return switch (statement.kind) {
                case SECTION -> statement.title;
                case DECLARATION -> "DECLARAR " + statement.name;
                case ASSIGNMENT -> "ASIGNAR " + statement.name;
                case CONTINUE -> "CONTINUAR";
                case BREAK -> "SALIR DEL CICLO";
                case THROW -> "LANZAR ERROR " + compact(statement.expression);
                case RETURN -> "DEVOLVER " + compact(statement.expression);
                case EXPRESSION -> compact(statement.expression);
                case IF -> "SI " + compact(statement.condition);
                case FOR -> "PARA CADA " + statement.item;
                case WHILE -> "MIENTRAS " + compact(statement.condition);
            };
        }

        private String instruction(Statement statement) {
            return switch (statement.kind) {
                case SECTION -> "Seccion";
                case DECLARATION -> "Declaracion";
                case ASSIGNMENT -> "Asignacion";
                case CONTINUE -> "Continuar";
                case BREAK -> "Romper ciclo";
                case THROW -> "Error";
                case RETURN -> "Retorno";
                case EXPRESSION -> "Funcion";
                case IF -> "Decision";
                case FOR, WHILE -> "Iteracion";
            };
        }

        private String safeSource(int start, int end) {
            int from = Math.max(0, Math.min(start, source.length()));
            int to = Math.max(from, Math.min(end, source.length()));
            return source.substring(from, to).trim();
        }

        private String compact(String text) {
            if (text == null) return "";
            String value = text.replaceAll("\\s+", " ").trim();
            return value.length() > 120 ? value.substring(0, 117) + "..." : value;
        }

        private void finalizeGraph() {
            Map<String, List<String>> previous = new LinkedHashMap<>();
            Map<String, List<String>> next = new LinkedHashMap<>();
            nodeDrafts.forEach(node -> { previous.put(node.id, new ArrayList<>()); next.put(node.id, new ArrayList<>()); });
            edgeDrafts.forEach(edge -> {
                next.getOrDefault(edge.source(), new ArrayList<>()).add(edge.target());
                previous.getOrDefault(edge.target(), new ArrayList<>()).add(edge.source());
            });
            nodes = nodeDrafts.stream().map(node -> new AviatorVisualizationNode(
                    node.id, node.type, node.label, node.instruction, node.sourceCode, node.source,
                    node.referencedVariables, node.assignedVariables, List.copyOf(node.branches),
                    List.copyOf(previous.getOrDefault(node.id, List.of())), List.copyOf(next.getOrDefault(node.id, List.of())), node.synthetic)).toList();
            edges = edgeDrafts.stream().map(edge -> new AviatorVisualizationEdge(edge.id(), edge.source(), edge.target(), edge.label())).toList();
        }

        private List<AviatorVisualizationNode> nodes = List.of();
        private List<AviatorVisualizationEdge> edges = List.of();

        private List<AviatorVisualizationNode> nodes() { return nodes; }
        private List<AviatorVisualizationEdge> edges() { return edges; }
        private List<AviatorVisualizationDiagnostic> diagnostics() { return diagnostics; }
    }
}
