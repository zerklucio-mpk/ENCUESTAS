
export enum Area {
  ALMACEN_C = "Almacén C",
  ALMACEN_F = "Almacén F",
  ALTO_VALOR = "Alto Valor",
  EMPAQUE_TV = "Empaque TV",
  EMPAQUE_RETAIL = "Empaque Retail",
  RECIBO = "Recibo",
  DEVOLUCIONES = "Devoluciones",
  MENSAJERIA_DISTRIBUCION = "Mensajería y Distribución",
  TRANSPORTISTAS = "Transportistas",
  MAQUILA = "Maquila",
  PREVENCION_PERDIDAS = "Prevención de Perdidas",
  REACONDICIONADO = "Reacondicionado",
  CALIDAD = "Calidad",
  MANTENIMIENTO = "Mantenimiento"
}

export enum Frequency {
  SIEMPRE = "Siempre",
  A_VECES = "A veces",
  NUNCA = "Nunca"
}

export enum Mood {
  MUY_MAL = "Muy mal",
  MAL = "Mal",
  REGULAR = "Regular",
  BIEN = "Bien",
  MUY_BIEN = "Muy bien"
}

export interface SurveyData {
  date: string;
  area: Area | "";
  mood: Mood | "";
  answers: Record<number, Frequency | string>;
  vulnerabilityText: string;
}

export interface QuestionDef {
  id: number;
  text: string;
}

export const SURVEY_QUESTIONS: QuestionDef[] = [
  { id: 1, text: "¿Mi supervisor me trata con respeto?" },
  { id: 2, text: "¿Escucha mis opiniones y sugerencias?" },
  { id: 3, text: "¿Se comunica de forma clara y profesional?" },
  { id: 4, text: "¿Me brinda apoyo cuando tengo un problema laboral?" },
  { id: 5, text: "¿Trata a todos los compañeros por igual?" },
  { id: 6, text: "¿Me explica correctamente que es lo que se espera de mi trabajo?" },
  { id: 7, text: "¿Me ofrece retroalimentación constructiva para mejorar?" },
  { id: 8, text: "¿Esta disponible cuando necesito orientación y ayuda?" },
  { id: 9, text: "¿Reconoce mi esfuerzo y logros?" },
  { id: 10, text: "¿Se interesa por mantener un buen ambiente de trabajo?" },
  { id: 11, text: "¿Me siento cómodo trabajando con mi supervisor o coordinador?" },
  { id: 12, text: "¿Considero que mi supervisor o coordinador es justo con sus decisiones?" },
  { id: 13, text: "¿Se han realizado juntas de arranque en tu área?" },
  { id: 14, text: "¿Ha habido algún cambio desde la ultima vez que contestaste la encuesta? (Si eres de nuevo ingreso responde N/A)" }
];
