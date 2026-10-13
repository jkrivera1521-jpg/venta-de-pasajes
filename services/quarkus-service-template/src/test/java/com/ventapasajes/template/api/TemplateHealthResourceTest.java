package com.ventapasajes.template.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TemplateHealthResourceTest {

    @Test
    void healthEndpointReturnsOk() {
        given()
                .when().get("/api/v1/template/health")
                .then()
                .statusCode(200)
                .body("status", is("ok"))
                .body("service", is("quarkus-service-template"))
                .body("runtime", is("quarkus"));
    }

    @Test
    void smallryeHealthEndpointsAreAvailable() {
        given()
                .when().get("/q/health/live")
                .then()
                .statusCode(200)
                .body("status", is("UP"));

        given()
                .when().get("/q/health/ready")
                .then()
                .statusCode(200)
                .body("status", is("UP"));
    }

    @Test
    void openApiDocumentIsAvailable() {
        given()
                .when().get("/q/openapi")
                .then()
                .statusCode(200)
                .body(containsString("quarkus-service-template API"));
    }
}
