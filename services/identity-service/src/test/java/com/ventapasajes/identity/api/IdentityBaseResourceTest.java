package com.ventapasajes.identity.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class IdentityBaseResourceTest {

    @Test
    void localLoginRejectsInvalidPayloadBeforeDatabaseAccess() {
        given()
                .contentType(ContentType.JSON)
                .body("{}")
                .when().post("/api/v1/identity/auth/local/login")
                .then()
                .statusCode(400)
                .body("error.code", is("VALIDATION_ERROR"));
    }

    @Test
    void usersEndpointRequiresBearerToken() {
        given()
                .when().get("/api/v1/identity/users")
                .then()
                .statusCode(401)
                .body("error.code", is("UNAUTHORIZED"));
    }

    @Test
    void permissionsEndpointRequiresBearerToken() {
        given()
                .when().get("/api/v1/identity/permissions")
                .then()
                .statusCode(401)
                .body("error.code", is("UNAUTHORIZED"));
    }

    @Test
    void logoutEndpointRequiresBearerToken() {
        given()
                .when().post("/api/v1/identity/auth/logout")
                .then()
                .statusCode(401)
                .body("error.code", is("UNAUTHORIZED"));
    }
}
