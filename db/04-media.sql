CREATE DATABASE media_db;
\connect media_db

CREATE TABLE media_archivos (
    id_archivo        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_mensaje        BIGINT UNIQUE,
    id_conversacion   BIGINT NOT NULL,
    id_remitente      BIGINT NOT NULL,
    nombre            VARCHAR(255) NOT NULL,
    formato           VARCHAR(100) NOT NULL,
    tamano_bytes      BIGINT NOT NULL,
    duracion_segundos INTEGER,
    object_key        VARCHAR(255) NOT NULL UNIQUE,
    reenviado_de_id   BIGINT,
    fecha_subida      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_archivos_conversacion_mensaje
    ON media_archivos(id_conversacion, id_mensaje);
