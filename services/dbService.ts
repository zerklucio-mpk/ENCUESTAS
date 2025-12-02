import { supabase, isConfigured } from './supabaseClient';
import { SurveyData, Frequency, SURVEY_QUESTIONS, Mood, Area } from '../types';

// Convertir respuesta de texto a puntaje numérico
// Actualizado para soportar Si/No/NA
const getScoreValue = (freq: string): number => {
  switch (freq) {
    case Frequency.SIEMPRE: return 10;
    case "Si": return 10;
    
    case Frequency.A_VECES: return 5;
    case "N/A": return 5; // Neutral
    
    case Frequency.NUNCA: return 0;
    case "No": return 0;
    
    default: return 0;
  }
};

/**
 * Guarda una encuesta completa en la base de datos
 */
export const saveSurveyToDb = async (data: SurveyData): Promise<boolean> => {
  if (!isConfigured()) {
    console.warn("MODO DEMO: Supabase no está configurado. Los datos no se guardarán en la nube.");
    return true; 
  }

  try {
    // 1. Insertar Cabecera (Encuesta)
    const { data: surveyResult, error: surveyError } = await supabase
      .from('encuestas')
      .insert({
        fecha_registro: new Date().toISOString(), 
        area: data.area,
        mood: data.mood,
        vulnerability_text: data.vulnerabilityText,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (surveyError || !surveyResult) {
      console.error('Error guardando encuesta:', surveyError);
      throw surveyError;
    }

    const surveyId = surveyResult.id;

    // 2. Preparar Respuestas (Detalle)
    const answersToInsert = Object.entries(data.answers).map(([qId, answer]) => {
      const questionId = parseInt(qId);
      const questionText = SURVEY_QUESTIONS.find(q => q.id === questionId)?.text || "Pregunta desconocida";
      
      return {
        encuesta_id: surveyId,
        pregunta_id: questionId,
        pregunta_texto: questionText,
        respuesta: answer,
        puntaje: getScoreValue(answer as string)
      };
    });

    // 3. Insertar Respuestas en lote
    const { error: answersError } = await supabase
      .from('respuestas')
      .insert(answersToInsert);

    if (answersError) {
      console.error('Error guardando respuestas:', answersError);
      throw answersError;
    }

    return true;

  } catch (error) {
    console.error('Error en transacción de guardado:', error);
    return false;
  }
};

/**
 * Carga los datos históricos (metas) desde la tabla historico_bimestral
 */
export const fetchHistoricalData = async () => {
  if (!isConfigured()) return {};

  const { data, error } = await supabase
    .from('historico_bimestral')
    .select('*');
  
  if (error) {
    console.error('Error cargando históricos:', error);
    return {};
  }

  const formatted: Record<string, { score: string, count: string }> = {};
  data.forEach((row: any) => {
    formatted[row.area] = {
      score: row.score_anterior?.toString() || "",
      count: row.count_anterior?.toString() || ""
    };
  });
  
  return formatted;
};

/**
 * Guarda o actualiza un dato histórico
 */
export const upsertHistoricalData = async (area: string, score: string, count: string) => {
  if (!isConfigured()) return;

  // IMPORTANTE: Se agrega { onConflict: 'area' } para que Supabase sepa
  // que debe usar la columna 'area' (que debe ser UNIQUE en la BD) para decidir si actualiza o inserta.
  const { error } = await supabase
    .from('historico_bimestral')
    .upsert({
      area,
      score_anterior: parseFloat(score) || 0,
      count_anterior: parseInt(count) || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'area' });
  
  if (error) {
    // Usamos JSON.stringify para ver el mensaje real del objeto error
    console.error(`Error guardando histórico para ${area}:`, JSON.stringify(error, null, 2));
    throw new Error(error.message || "Error desconocido al guardar histórico");
  }
};

/**
 * Obtiene lista de encuestas recientes para gestión (borrado)
 */
export const fetchSurveysList = async (areaFilter: string) => {
  if (!isConfigured()) return [];

  let query = supabase
    .from('encuestas')
    .select('id, fecha_registro, area, mood, vulnerability_text')
    .order('created_at', { ascending: false });

  if (areaFilter !== 'GENERAL') {
    query = query.eq('area', areaFilter);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching surveys list", error);
    return [];
  }
  return data || [];
};

/**
 * Elimina una encuesta por ID
 * Retorna objeto con éxito y mensaje de error opcional
 */
export const deleteSurvey = async (id: number): Promise<{ success: boolean; error?: string }> => {
  if (!isConfigured()) return { success: false, error: "Base de datos no configurada" };

  try {
    // 1. Eliminamos primero las respuestas asociadas para evitar errores de Foreign Key
    // si la BD no tiene configurado ON DELETE CASCADE
    const { error: answersError } = await supabase
      .from('respuestas')
      .delete()
      .eq('encuesta_id', id);

    if (answersError) {
      console.warn("Error borrando respuestas (posiblemente ya borradas o no existen):", answersError);
      // No lanzamos error aquí, intentamos borrar la encuesta de todas formas
    }

    // 2. Eliminamos la encuesta
    const { error } = await supabase
      .from('encuestas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting survey", error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Error desconocido" };
  }
};

/**
 * Obtiene todos los datos para el Dashboard y los procesa
 */
export const fetchDashboardStats = async () => {
  if (!isConfigured()) return null;

  const { data: surveys, error: surveyError } = await supabase
    .from('encuestas')
    .select('*');

  const { data: answers, error: answersError } = await supabase
    .from('respuestas')
    .select('*');

  if (surveyError || answersError || !surveys || !answers) {
    return null;
  }

  return processStats(surveys, answers);
};

// Función auxiliar para procesar datos crudos
const processStats = (surveys: any[], answers: any[]) => {
  const areas = Object.values(Area);
  const stats: any = {};

  ['GENERAL', ...areas].forEach(key => {
    stats[key] = {
      total: 0,
      today: 0, 
      sumScore: 0,
      countScore: 0, 
      vulnerabilityCount: 0,
      comments: [],
      moodCounts: { [Mood.MUY_MAL]: 0, [Mood.MAL]: 0, [Mood.REGULAR]: 0, [Mood.BIEN]: 0, [Mood.MUY_BIEN]: 0 },
      questionCounts: {} 
    };
  });

  surveys.forEach(s => {
    const area = s.area;
    const mood = s.mood as Mood;
    const hasVuln = s.vulnerability_text && s.vulnerability_text.trim().length > 0;
    const commentData = hasVuln ? { text: s.vulnerability_text, date: s.fecha_registro } : null;

    updateStatNode(stats['GENERAL'], mood, hasVuln, commentData);
    if (stats[area]) {
      updateStatNode(stats[area], mood, hasVuln, commentData);
    }
  });

  answers.forEach(a => {
    const parentSurvey = surveys.find(s => s.id === a.encuesta_id);
    if (!parentSurvey) return;

    const area = parentSurvey.area;
    const qId = a.pregunta_id;
    const score = a.puntaje;
    const resp = a.respuesta; 

    updateAnswerNode(stats['GENERAL'], qId, resp, score);
    if (stats[area]) {
      updateAnswerNode(stats[area], qId, resp, score);
    }
  });

  const finalStats: any = {};
  Object.keys(stats).forEach(key => {
    const s = stats[key];
    
    const moodDist = [
      { label: "Muy Bien", val: s.moodCounts[Mood.MUY_BIEN], color: "bg-blue-600" },
      { label: "Bien", val: s.moodCounts[Mood.BIEN], color: "bg-teal-500" },
      { label: "Regular", val: s.moodCounts[Mood.REGULAR], color: "bg-yellow-500" },
      { label: "Mal", val: s.moodCounts[Mood.MAL], color: "bg-orange-500" },
      { label: "Muy Mal", val: s.moodCounts[Mood.MUY_MAL], color: "bg-red-600" },
    ];
    
    const moodTotal = moodDist.reduce((acc, curr) => acc + curr.val, 0);
    const moodDistribution = moodDist.map(m => ({
      label: m.label,
      percentage: moodTotal > 0 ? Math.round((m.val / moodTotal) * 100) : 0,
      color: m.color
    }));

    const questionsBreakdown = SURVEY_QUESTIONS.map(q => {
      const qStats = s.questionCounts[q.id] || { siempre: 0, aVeces: 0, nunca: 0 };
      const qTotal = qStats.siempre + qStats.aVeces + qStats.nunca;
      return {
        id: q.id,
        text: q.text,
        siempre: qTotal > 0 ? Math.round((qStats.siempre / qTotal) * 100) : 0,
        aVeces: qTotal > 0 ? Math.round((qStats.aVeces / qTotal) * 100) : 0,
        nunca: qTotal > 0 ? Math.round((qStats.nunca / qTotal) * 100) : 0,
      };
    });

    finalStats[key] = {
      total: s.total,
      today: 0,
      avgScore: s.countScore > 0 ? (s.sumScore / s.countScore) : 0, 
      vulnerabilityCount: s.vulnerabilityCount,
      comments: s.comments,
      moodDistribution,
      questionsBreakdown
    };
  });

  return finalStats;
};

const updateStatNode = (node: any, mood: Mood, hasVuln: boolean, commentData: any) => {
  node.total += 1;
  if (hasVuln) {
    node.vulnerabilityCount += 1;
    if (commentData) {
      node.comments.push(commentData);
    }
  }
  if (node.moodCounts[mood] !== undefined) node.moodCounts[mood] += 1;
};

const updateAnswerNode = (node: any, qId: number, resp: string, score: number) => {
  node.sumScore += score;
  node.countScore += 1;

  if (!node.questionCounts[qId]) {
    node.questionCounts[qId] = { siempre: 0, aVeces: 0, nunca: 0 };
  }
  
  // Mapear respuestas estándar y nuevas a los contadores visuales
  if (resp === Frequency.SIEMPRE || resp === "Si") node.questionCounts[qId].siempre += 1;
  else if (resp === Frequency.A_VECES || resp === "N/A") node.questionCounts[qId].aVeces += 1;
  else if (resp === Frequency.NUNCA || resp === "No") node.questionCounts[qId].nunca += 1;
};

/**
 * Obtiene datos para Excel
 * Implementación robusta: hace el join manualmente para no depender de View SQL
 */
export const fetchExcelData = async () => {
  if (!isConfigured()) {
    console.warn("Supabase no configurado. Exportando excel vacío.");
    return [];
  }

  // 1. Obtener todas las encuestas
  const { data: surveys, error: surveyError } = await supabase
    .from('encuestas')
    .select('*')
    .order('id', { ascending: true });

  // 2. Obtener todas las respuestas
  const { data: answers, error: answersError } = await supabase
    .from('respuestas')
    .select('*');

  if (surveyError || answersError || !surveys || !answers) {
    console.error("Error fetching excel data", surveyError || answersError);
    return [];
  }
  
  const surveysMap: any = {};
  
  // Procesar encuestas
  surveys.forEach((s: any) => {
    surveysMap[s.id] = {
      "ID Encuesta": s.id,
      "Fecha Registro": s.fecha_registro,
      "Área": s.area,
      "Estado de Ánimo": s.mood,
      "Vulnerabilidad": s.vulnerability_text,
      "Promedio": 0,
      _sumScore: 0,
      _countScore: 0
    };
  });

  // Procesar respuestas y unir
  answers.forEach((a: any) => {
    if (surveysMap[a.encuesta_id]) {
      const s = surveysMap[a.encuesta_id];
      s[`P${a.pregunta_id}: ${a.pregunta_texto}`] = a.respuesta;
      s[`Score_P${a.pregunta_id}`] = a.puntaje;
      s._sumScore += a.puntaje;
      s._countScore += 1;
    }
  });

  // Finalizar cálculo de promedios
  return Object.values(surveysMap).map((s: any) => {
    s["Promedio Final"] = s._countScore > 0 ? (s._sumScore / s._countScore).toFixed(2) : 0;
    delete s._sumScore;
    delete s._countScore;
    return s;
  });
};