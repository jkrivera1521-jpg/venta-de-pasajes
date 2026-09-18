package com.ventapasajes.identity.api;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

@Schema(name = "ApiErrorResponse", description = "Standard API error response.")
public record ApiErrorResponse(ApiError error) {

    public static ApiErrorResponse of(String code, String message) {
        return new ApiErrorResponse(new ApiError(code, message));
    }

    public static ApiErrorResponse notImplemented(String operation) {
        return new ApiErrorResponse(new ApiError(
                "NOT_IMPLEMENTED",
                "Operation is exposed as a base endpoint and will be implemented later: " + operation));
    }

    public record ApiError(String code, String message) {
    }
}
