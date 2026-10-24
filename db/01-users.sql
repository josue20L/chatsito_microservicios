CREATE DATABASE users_db;
\connect users_db

CREATE TABLE usuarios (
    id_usuario     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    correo         VARCHAR(150) NOT NULL,
    password_hash  TEXT         NOT NULL,
    fecha_registro TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_usuarios_correo ON usuarios (LOWER(correo));
