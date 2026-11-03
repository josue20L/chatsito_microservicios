export interface Archivo {
  id_archivo: string;
  nombre: string;
  formato: string;
  tamano_bytes: number;
  duracion_segundos: number | null;
}

export interface MessageResponse {
  id_mensaje: string;
  id_conversacion: string;
  id_remitente: string;
  contenido: string | null;
  tipo: string;
  fecha_envio: Date;
  eliminado_en?: Date | null;
  editado_en: Date | null;
  reenviado_de_id: string | null;
  remitente: { id_usuario: string; nombre: string };
  leido_por: string[];
  archivo: Archivo | null;
}
