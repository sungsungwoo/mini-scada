package com.example.miniscada.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorBody(boolean success, String errorCode, String message) {

    public static ErrorBody of(String errorCode, String message) {
        return new ErrorBody(false, errorCode, message);
    }
}
