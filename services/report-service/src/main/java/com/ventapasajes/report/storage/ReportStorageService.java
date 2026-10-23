package com.ventapasajes.report.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.ventapasajes.report.api.ReportServiceException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class ReportStorageService {
    @ConfigProperty(name = "app.report.storage.provider") String provider;
    @ConfigProperty(name = "app.report.storage.local-dir") String localDirectory;
    @ConfigProperty(name = "app.report.storage.bucket") String bucket;

    public void store(String key, byte[] content, String contentType) {
        try {
            if ("gcs".equalsIgnoreCase(provider)) {
                requireBucket();
                StorageOptions.getDefaultInstance().getService().create(BlobInfo.newBuilder(BlobId.of(bucket, key)).setContentType(contentType).build(), content);
                return;
            }
            Path root = Path.of(localDirectory).toAbsolutePath().normalize();
            Path target = root.resolve(key).normalize();
            if (!target.startsWith(root)) throw new ReportServiceException(Response.Status.INTERNAL_SERVER_ERROR, "STORAGE_PATH", "La clave de almacenamiento no es segura.");
            Files.createDirectories(target.getParent());
            Path temporary = Files.createTempFile(root, "report-", ".tmp");
            Files.write(temporary, content);
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException error) {
            throw new ReportServiceException(Response.Status.INTERNAL_SERVER_ERROR, "STORAGE_WRITE", "No se pudo almacenar el resultado.");
        }
    }

    public byte[] read(String key) {
        try {
            if ("gcs".equalsIgnoreCase(provider)) {
                requireBucket();
                var blob = StorageOptions.getDefaultInstance().getService().get(BlobId.of(bucket, key));
                if (blob == null) throw new ReportServiceException(Response.Status.NOT_FOUND, "RESULT_NOT_FOUND", "El resultado no existe o expiro.");
                return blob.getContent();
            }
            Path root = Path.of(localDirectory).toAbsolutePath().normalize();
            Path target = root.resolve(key).normalize();
            if (!target.startsWith(root) || !Files.exists(target)) throw new ReportServiceException(Response.Status.NOT_FOUND, "RESULT_NOT_FOUND", "El resultado no existe o expiro.");
            return Files.readAllBytes(target);
        } catch (IOException error) {
            throw new ReportServiceException(Response.Status.INTERNAL_SERVER_ERROR, "STORAGE_READ", "No se pudo leer el resultado.");
        }
    }

    private void requireBucket() { if (bucket == null || bucket.isBlank()) throw new ReportServiceException(Response.Status.INTERNAL_SERVER_ERROR, "STORAGE_CONFIG", "El bucket de reportes no esta configurado."); }
}
