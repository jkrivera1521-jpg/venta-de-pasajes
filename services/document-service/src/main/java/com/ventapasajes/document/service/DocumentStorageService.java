package com.ventapasajes.document.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.StorageOptions;
import com.ventapasajes.document.api.dto.DownloadPayload;
import com.ventapasajes.document.api.dto.StoredDocument;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class DocumentStorageService {

    private static final String PDF_CONTENT_TYPE = "application/pdf";

    @ConfigProperty(name = "app.documents.storage.provider")
    String provider;

    @ConfigProperty(name = "app.documents.local-dir")
    String localDir;

    @ConfigProperty(name = "app.documents.bucket")
    String bucket;

    public StoredDocument storePdf(String objectName, String fileName, byte[] content) {
        String normalizedProvider = normalizeProvider(provider);
        String checksum = sha256(content);

        if ("gcs".equals(normalizedProvider)) {
            BlobInfo blobInfo = BlobInfo.newBuilder(bucket, objectName)
                    .setContentType(PDF_CONTENT_TYPE)
                    .build();
            StorageOptions.getDefaultInstance().getService().create(blobInfo, content);
            return new StoredDocument("gcs", "gs://" + bucket + "/" + objectName, PDF_CONTENT_TYPE, fileName, checksum,
                    content.length);
        }

        try {
            Path target = localRoot().resolve(objectName).normalize();
            if (!target.startsWith(localRoot())) {
                throw new WebApplicationException("Invalid document storage path.", Response.Status.BAD_REQUEST);
            }
            Files.createDirectories(target.getParent());
            Files.write(target, content);
            return new StoredDocument("local", "local://" + objectName, PDF_CONTENT_TYPE, fileName, checksum,
                    content.length);
        } catch (IOException ex) {
            throw new WebApplicationException("Could not store generated PDF.", ex,
                    Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    public DownloadPayload readPdf(String storageProvider, String storageUri, String fileName) {
        String normalizedProvider = normalizeProvider(storageProvider);

        if ("gcs".equals(normalizedProvider)) {
            GcsObject object = parseGcsUri(storageUri);
            Blob blob = StorageOptions.getDefaultInstance().getService().get(object.bucket(), object.name());
            if (blob == null || !blob.exists()) {
                throw new NotFoundException("Stored document was not found.");
            }
            return new DownloadPayload(blob.getContent(), PDF_CONTENT_TYPE, fileName);
        }

        try {
            String objectName = storageUri.replaceFirst("^local://", "");
            Path source = localRoot().resolve(objectName).normalize();
            if (!source.startsWith(localRoot()) || !Files.exists(source)) {
                throw new NotFoundException("Stored document was not found.");
            }
            return new DownloadPayload(Files.readAllBytes(source), PDF_CONTENT_TYPE, fileName);
        } catch (IOException ex) {
            throw new WebApplicationException("Could not read stored PDF.", ex,
                    Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    private Path localRoot() {
        return Path.of(localDir).toAbsolutePath().normalize();
    }

    private static String normalizeProvider(String value) {
        return value == null || value.isBlank() ? "local" : value.trim().toLowerCase();
    }

    private static GcsObject parseGcsUri(String storageUri) {
        if (storageUri == null || !storageUri.startsWith("gs://")) {
            throw new WebApplicationException("Invalid Cloud Storage URI.", Response.Status.INTERNAL_SERVER_ERROR);
        }
        String value = storageUri.substring("gs://".length());
        int separator = value.indexOf('/');
        if (separator <= 0 || separator == value.length() - 1) {
            throw new WebApplicationException("Invalid Cloud Storage URI.", Response.Status.INTERNAL_SERVER_ERROR);
        }
        return new GcsObject(value.substring(0, separator), value.substring(separator + 1));
    }

    private static String sha256(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(content));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm is not available.", ex);
        }
    }

    private record GcsObject(String bucket, String name) {
    }
}
