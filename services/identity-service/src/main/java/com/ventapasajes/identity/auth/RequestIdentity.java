package com.ventapasajes.identity.auth;

import jakarta.enterprise.context.RequestScoped;

@RequestScoped
public class RequestIdentity {

    private AuthenticatedUser user;

    public AuthenticatedUser user() {
        return user;
    }

    public void setUser(AuthenticatedUser user) {
        this.user = user;
    }
}
