package com.ventapasajes.identity.api;

import java.net.URI;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.identity.api.dto.AuthorizedIdentityCreateRequest;
import com.ventapasajes.identity.api.dto.GoogleTokenExchangeRequest;
import com.ventapasajes.identity.api.dto.LocalLoginRequest;
import com.ventapasajes.identity.api.dto.PasswordForgotRequest;
import com.ventapasajes.identity.api.dto.PasswordResetRequest;
import com.ventapasajes.identity.api.dto.ReplaceUserRolesRequest;
import com.ventapasajes.identity.api.dto.RoleCreateRequest;
import com.ventapasajes.identity.api.dto.UserCreateRequest;
import com.ventapasajes.identity.api.dto.UserUpdateRequest;
import com.ventapasajes.identity.auth.RequestIdentity;
import com.ventapasajes.identity.auth.RequiresPermission;
import com.ventapasajes.identity.service.IdentityApplicationService;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/v1/identity")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "identity-base")
public class IdentityBaseResource {

    @Inject
    IdentityApplicationService identityService;

    @Inject
    RequestIdentity requestIdentity;

    @POST
    @Path("/auth/local/login")
    @Operation(summary = "Authenticate with local username and password.")
    @APIResponse(responseCode = "200", description = "Authenticated with an internal JWT.")
    public Response localLogin(LocalLoginRequest request, @HeaderParam("User-Agent") String userAgent) {
        return Response.ok(identityService.localLogin(request, userAgent)).build();
    }

    @POST
    @Path("/auth/google/exchange")
    @Operation(summary = "Validate a Google ID token and exchange it for an internal JWT.")
    @APIResponse(responseCode = "200", description = "Google account validated and exchanged.")
    public Response googleExchange(GoogleTokenExchangeRequest request) {
        return Response.ok(identityService.googleExchange(request)).build();
    }

    @POST
    @Path("/auth/logout")
    @Consumes(MediaType.WILDCARD)
    @RequiresPermission
    @Operation(summary = "Logout from the current JWT session.")
    @APIResponse(responseCode = "204", description = "Logout accepted.")
    public Response logout() {
        return Response.noContent().build();
    }

    @GET
    @Path("/me")
    @RequiresPermission
    @Operation(summary = "Read the current authenticated user profile.")
    @APIResponse(responseCode = "200", description = "Current user profile.")
    public Response currentUser() {
        return Response.ok(identityService.currentUser(requestIdentity.user().id())).build();
    }

    @GET
    @Path("/users")
    @RequiresPermission("identity.users.read")
    @Operation(summary = "List active internal users.")
    @APIResponse(responseCode = "200", description = "Users listed.")
    public Response listUsers() {
        return Response.ok(identityService.listUsers()).build();
    }

    @POST
    @Path("/users")
    @RequiresPermission("identity.users.write")
    @Operation(summary = "Create a local, Google or hybrid user.")
    @APIResponse(responseCode = "201", description = "User created.")
    public Response createUser(UserCreateRequest request) {
        var response = identityService.createUser(request, requestIdentity.user().id());
        return Response.created(URI.create("/api/v1/identity/users/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/users/{userId}")
    @RequiresPermission("identity.users.read")
    @Operation(summary = "Read one internal user.")
    @APIResponse(responseCode = "200", description = "User found.")
    public Response getUser(@PathParam("userId") String userId) {
        return Response.ok(identityService.getUser(parseUuid(userId, "userId"))).build();
    }

    @PATCH
    @Path("/users/{userId}")
    @RequiresPermission("identity.users.write")
    @Operation(summary = "Update one internal user profile.")
    @APIResponse(responseCode = "200", description = "User updated.")
    public Response updateUser(@PathParam("userId") String userId, UserUpdateRequest request) {
        return Response.ok(identityService.updateUser(parseUuid(userId, "userId"), request)).build();
    }

    @PUT
    @Path("/users/{userId}/roles")
    @RequiresPermission("identity.roles.manage")
    @Operation(summary = "Replace all roles for one user.")
    @APIResponse(responseCode = "200", description = "User roles replaced.")
    public Response replaceUserRoles(@PathParam("userId") String userId, ReplaceUserRolesRequest request) {
        return Response.ok(identityService.replaceUserRoles(parseUuid(userId, "userId"), request, requestIdentity.user().id())).build();
    }

    @POST
    @Path("/users/{userId}/activate")
    @RequiresPermission("identity.users.status")
    @Operation(summary = "Activate one user.")
    @APIResponse(responseCode = "200", description = "User activated.")
    public Response activateUser(@PathParam("userId") String userId) {
        return Response.ok(identityService.activateUser(parseUuid(userId, "userId"))).build();
    }

    @POST
    @Path("/users/{userId}/suspend")
    @RequiresPermission("identity.users.status")
    @Operation(summary = "Suspend one user.")
    @APIResponse(responseCode = "200", description = "User suspended.")
    public Response suspendUser(@PathParam("userId") String userId) {
        return Response.ok(identityService.suspendUser(parseUuid(userId, "userId"))).build();
    }

    @GET
    @Path("/roles")
    @RequiresPermission("identity.roles.read")
    @Operation(summary = "List active roles.")
    @APIResponse(responseCode = "200", description = "Roles listed.")
    public Response listRoles() {
        return Response.ok(identityService.listRoles()).build();
    }

    @POST
    @Path("/roles")
    @RequiresPermission("identity.roles.manage")
    @Operation(summary = "Create one role with permissions.")
    @APIResponse(responseCode = "201", description = "Role created.")
    public Response createRole(RoleCreateRequest request) {
        var response = identityService.createRole(request);
        return Response.created(URI.create("/api/v1/identity/roles/" + response.id()))
                .entity(response)
                .build();
    }

    @GET
    @Path("/permissions")
    @RequiresPermission("identity.permissions.read")
    @Operation(summary = "List permission catalog.")
    @APIResponse(responseCode = "200", description = "Permissions listed.")
    public Response listPermissions() {
        return Response.ok(identityService.listPermissions()).build();
    }

    @GET
    @Path("/authorized-identities")
    @RequiresPermission("identity.authorized-identities.read")
    @Operation(summary = "List authorized Google emails, domains and subjects.")
    @APIResponse(responseCode = "200", description = "Authorized identities listed.")
    public Response listAuthorizedIdentities() {
        return Response.ok(identityService.listAuthorizedIdentities()).build();
    }

    @POST
    @Path("/authorized-identities")
    @RequiresPermission("identity.authorized-identities.manage")
    @Operation(summary = "Create one authorized Google email, domain or subject.")
    @APIResponse(responseCode = "201", description = "Authorized identity created.")
    public Response createAuthorizedIdentity(AuthorizedIdentityCreateRequest request) {
        var response = identityService.createAuthorizedIdentity(request, requestIdentity.user().id());
        return Response.created(URI.create("/api/v1/identity/authorized-identities/" + response.id()))
                .entity(response)
                .build();
    }

    @POST
    @Path("/password/forgot")
    @Operation(summary = "Create a one-time password reset token.")
    @APIResponse(responseCode = "202", description = "Password recovery accepted.")
    public Response forgotPassword(PasswordForgotRequest request) {
        return Response.accepted(identityService.forgotPassword(request)).build();
    }

    @POST
    @Path("/password/reset")
    @Operation(summary = "Reset a password with a one-time token.")
    @APIResponse(responseCode = "204", description = "Password reset completed.")
    public Response resetPassword(PasswordResetRequest request) {
        identityService.resetPassword(request);
        return Response.noContent().build();
    }

    private UUID parseUuid(String value, String fieldName) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw ApiException.validation("VALIDATION_ERROR", "Field must be a UUID: " + fieldName + ".");
        }
    }
}
