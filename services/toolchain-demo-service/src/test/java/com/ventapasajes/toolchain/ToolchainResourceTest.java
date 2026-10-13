package com.ventapasajes.toolchain;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ToolchainResourceTest {

    @Test
    void healthEndpointReturnsOk() {
        given()
                .when().get("/api/v1/toolchain/health")
                .then()
                .statusCode(200)
                .body("status", is("ok"))
                .body("service", is("toolchain-demo-service"))
                .body("runtime", is("quarkus"));
    }
}
