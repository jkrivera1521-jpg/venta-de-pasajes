package com.ventapasajes.dispatch.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ApiBadRequestMapperTest {

    @Test
    void malformedJsonBodyReturnsStandardErrorBody() {
        given()
                .contentType("application/json")
                .body("{")
                .when().post("/api/v1/dispatch/terminals")
                .then()
                .statusCode(400)
                .body("error.code", is("BAD_REQUEST"))
                .body("error.message", is("Request body or parameters are invalid."));
    }
}
