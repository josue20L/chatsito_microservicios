CREATE DATABASE messages_db;
\connect messages_db

CREATE TABLE mensajes (
    id_mensaje      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_conversacion BIGINT NOT NULL,
    id_remitente    BIGINT NOT NULL,
    contenido       TEXT,
    tipo            VARCHAR(10) NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','audio')),
    fecha_envio     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    editado_en      TIMESTAMPTZ,
    eliminado_en    TIMESTAMPTZ,
    reenviado_de_id BIGINT REFERENCES mensajes(id_mensaje) ON DELETE SET NULL,
    CHECK ((tipo='texto' AND contenido IS NOT NULL) OR (tipo='audio' AND contenido IS NULL)),
    CHECK (editado_en IS NULL OR tipo='texto'),
    CHECK (reenviado_de_id IS NULL OR reenviado_de_id <> id_mensaje),
    UNIQUE (id_conversacion, id_mensaje),
    UNIQUE (id_mensaje, tipo)
);
CREATE INDEX idx_mensajes_conversacion_fecha ON mensajes(id_conversacion, fecha_envio);
CREATE INDEX idx_mensajes_remitente ON mensajes(id_remitente);

CREATE TABLE lecturas_mensajes (
    id_conversacion BIGINT NOT NULL,
    id_mensaje      BIGINT NOT NULL,
    id_usuario      BIGINT NOT NULL,
    fecha_lectura   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_mensaje, id_usuario),
    FOREIGN KEY (id_conversacion, id_mensaje) REFERENCES mensajes(id_conversacion, id_mensaje) ON DELETE CASCADE
);
CREATE INDEX idx_lecturas_usuario ON lecturas_mensajes(id_usuario);
