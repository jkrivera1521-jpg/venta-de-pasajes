package com.ventapasajes.dispatch.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class DispatchBaseResourceTest {

    @Test
    void overviewEndpointReturnsDispatchCatalog() {
        given()
                .when().get("/api/v1/dispatch")
                .then()
                .statusCode(200)
                .body("service", is("dispatch-service"))
                .body("database", is("dispatch_db"))
                .body("base_path", is("/api/v1/dispatch"))
                .body("resources.size()", is(6))
                .body("departure_statuses", hasItems("SCHEDULED", "CANCELLED", "CLOSED", "DEPARTED"))
                .body("seat_positions", hasItems("WINDOW", "AISLE", "MIDDLE", "DRIVER", "BLOCKED"));
    }

    @Test
    void resourcesEndpointReturnsPlannedResources() {
        given()
                .when().get("/api/v1/dispatch/resources")
                .then()
                .statusCode(200)
                .body("size()", is(6))
                .body("name", hasItems("terminals", "routes", "bus_types", "seat_layouts", "buses", "departures"))
                .body("path", hasItems(
                        "/api/v1/dispatch/terminals",
                        "/api/v1/dispatch/routes",
                        "/api/v1/dispatch/bus-types",
                        "/api/v1/dispatch/seat-layouts",
                        "/api/v1/dispatch/buses",
                        "/api/v1/dispatch/departures"));
    }

    @Test
    void enumEndpointsReturnDomainValues() {
        given()
                .when().get("/api/v1/dispatch/departure-statuses")
                .then()
                .statusCode(200)
                .body("$", hasItems("SCHEDULED", "CANCELLED", "CLOSED", "DEPARTED"));

        given()
                .when().get("/api/v1/dispatch/seat-positions")
                .then()
                .statusCode(200)
                .body("$", hasItems("WINDOW", "AISLE", "MIDDLE", "DRIVER", "BLOCKED"));
    }
}
