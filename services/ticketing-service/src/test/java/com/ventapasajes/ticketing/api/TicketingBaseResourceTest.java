package com.ventapasajes.ticketing.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.hasItems;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TicketingBaseResourceTest {

    @Test
    void overviewReturnsManagedResourcesAndStatuses() {
        given()
                .when().get("/api/v1/ticketing")
                .then()
                .statusCode(200)
                .body("service", is("ticketing-service"))
                .body("domain", is("ticketing"))
                .body("resources.size()", is(6))
                .body("seat_statuses", hasItems("AVAILABLE", "RESERVED", "SOLD", "BLOCKED", "CANCELLED"))
                .body("reservation_statuses", hasItems("PENDING", "CONFIRMED", "EXPIRED", "CANCELLED",
                        "CONVERTED_TO_TICKET"))
                .body("ticket_statuses", hasItems("ISSUED", "VOIDED", "REFUNDED", "CHECKED_IN"));
    }

    @Test
    void resourcesEndpointReturnsTicketingResources() {
        given()
                .when().get("/api/v1/ticketing/resources")
                .then()
                .statusCode(200)
                .body("size()", is(6))
                .body("code", hasItems("passengers", "reservations", "departure_seats", "tickets",
                        "synced_departures", "outbox_events"));
    }

    @Test
    void statusEndpointsReturnCatalogValues() {
        given()
                .when().get("/api/v1/ticketing/seat-statuses")
                .then()
                .statusCode(200)
                .body("size()", is(5))
                .body("", hasItems("AVAILABLE", "RESERVED", "SOLD", "BLOCKED", "CANCELLED"));

        given()
                .when().get("/api/v1/ticketing/reservation-statuses")
                .then()
                .statusCode(200)
                .body("size()", is(5))
                .body("", hasItems("PENDING", "CONFIRMED", "EXPIRED", "CANCELLED", "CONVERTED_TO_TICKET"));

        given()
                .when().get("/api/v1/ticketing/ticket-statuses")
                .then()
                .statusCode(200)
                .body("size()", is(4))
                .body("", hasItems("ISSUED", "VOIDED", "REFUNDED", "CHECKED_IN"));
    }
}
