CREATE INDEX IF NOT EXISTS idx_passengers_document_number
    ON passengers (document_number);

CREATE INDEX IF NOT EXISTS idx_passengers_name_search
    ON passengers (lower(first_name), lower(last_name));

CREATE INDEX IF NOT EXISTS idx_passengers_status_name
    ON passengers (status, last_name, first_name);
