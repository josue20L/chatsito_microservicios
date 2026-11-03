export interface Archivo {
  id_archivo: string;
  nombre: string;
  formato: string;
  tamano_bytes: number;
  duracion_segundos: number | null;
}

export interface AudioMessageResponse {
  id_mensaje: string;
  id_conversacion: string;
  id_remitente: string;
  contenido: string | null;
  tipo: string;
  fecha_envio: string | Date;
  eliminado_en?: string | Date | null;
  editado_en: string | Date | null;
  reenviado_de_id: string | null;
  remitente: { id_usuario: string; nombre: string };
  leido_por: string[];
  archivo: Archivo | null;
}

export interface InternalMessageInfo {
  id_mensaje: string;
  id_conversacion: string;
  id_remitente: string;
  tipo: string;
  eliminado_en: string | Date | null;
}
