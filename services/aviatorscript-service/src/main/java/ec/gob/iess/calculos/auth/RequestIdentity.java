package ec.gob.iess.calculos.auth;

import jakarta.enterprise.context.RequestScoped;

@RequestScoped
public class RequestIdentity {

    private AuthenticatedUser user;

    public void setUser(AuthenticatedUser user) {
        this.user = user;
    }

    public AuthenticatedUser user() {
        return user;
    }

    public AuthenticatedUser requireUser() {
        if (user == null) {
            throw new IllegalStateException("No existe una identidad autenticada para la solicitud.");
        }
        return user;
    }
}
