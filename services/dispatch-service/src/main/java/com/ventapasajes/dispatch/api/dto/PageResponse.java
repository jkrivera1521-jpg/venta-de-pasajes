package com.ventapasajes.dispatch.api.dto;

import java.util.List;

public record PageResponse<T>(
        List<T> data,
        PageMeta meta) {
}
