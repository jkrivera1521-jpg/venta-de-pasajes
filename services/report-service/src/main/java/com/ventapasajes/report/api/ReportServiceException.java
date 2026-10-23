package com.ventapasajes.report.api;

import jakarta.ws.rs.core.Response;

public class ReportServiceException extends RuntimeException {

    private final int status;
    private final String code;

    public ReportServiceException(Response.Status status, String code, String message) {
        super(message);
        this.status = status.getStatusCode();
        this.code = code;
    }

    public ReportServiceException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int status() {
        return status;
    }

    public String code() {
        return code;
    }
}
