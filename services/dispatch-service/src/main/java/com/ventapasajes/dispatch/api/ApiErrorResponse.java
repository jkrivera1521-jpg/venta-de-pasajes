package com.ventapasajes.dispatch.api;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

@Schema(name = "ApiErrorResponse", description = "Standard API error response.")
public record ApiErrorResponse(ApiError error) {

    public static ApiErrorResponse of(String code, String message) {
        return new ApiErrorResponse(new ApiError(code, message));
    }

    public record ApiError(String code, String message) {
    }
}
