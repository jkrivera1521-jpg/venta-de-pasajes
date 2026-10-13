package com.ventapasajes.dispatch.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class DispatchHealthResourceTest {

    @Test
    void healthEndpointReturnsOk() {
        given()
                .when().get("/api/v1/dispatch/health")
                .then()
                .statusCode(200)
                .body("status", is("ok"))
                .body("service", is("dispatch-service"))
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
                .body(containsString("Dispatch Service API"))
                .body(containsString("/api/v1/dispatch/terminals"))
                .body(containsString("/api/v1/dispatch/routes"))
                .body(containsString("/api/v1/dispatch/bus-types"))
                .body(containsString("/api/v1/dispatch/seat-layouts"))
                .body(containsString("/api/v1/dispatch/buses"))
                .body(containsString("/api/v1/dispatch/departures"));
    }
}
