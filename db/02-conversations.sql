CREATE DATABASE conversations_db;
\connect conversations_db

CREATE TABLE conversaciones (
    id_conversacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo            VARCHAR(10) NOT NULL
        CHECK (tipo IN ('privada', 'grupo')),
    nombre          VARCHAR(100),
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (tipo = 'grupo'   AND nombre IS NOT NULL)
        OR
        (tipo = 'privada' AND nombre IS NULL)
    )
);

-- Sin FK a usuarios: ese dato vive en users-service
CREATE TABLE participantes (
    id_conversacion BIGINT NOT NULL
        REFERENCES conversaciones(id_conversacion) ON DELETE CASCADE,
    id_usuario      BIGINT NOT NULL,
    fecha_union     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_conversacion, id_usuario)
);

CREATE INDEX idx_participantes_usuario
    ON participantes(id_usuario);
