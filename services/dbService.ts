
import { supabase, isConfigured } from './supabaseClient';
import { SurveyData, Frequency, SURVEY_QUESTIONS, Mood, Area } from '../types';

// ============================================================================
// HELPERS DE NORMALIZACIÓN (CRÍTICO PARA CORREGIR DATOS SUCIOS)
// ============================================================================

/**
 * Normaliza un texto para comparación:
 * 1. Convierte a minúsculas
 * 2. Elimina espacios al inicio/final
 * 3. Elimina acentos (á -> a, é -> e, etc.)
 */
const normalizeStr = (str: string | null | undefined): string => {
  if (!str) return "";
  return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Busca la coincidencia correcta en el ENUM de Áreas basándose en el texto sucio de la DB.
 * Ej: DB "Almacen F " -> Match "Almacén F"
 */
const matchArea = (dbArea: string): string => {
  const cleanDb = normalizeStr(dbArea);
  if (!cleanDb) return "GENERAL";

  const knownAreas = Object.values(Area);
  
  // 1. Búsqueda exacta normalizada
  for (const known of knownAreas) {
    if (normalizeStr(known) === cleanDb) {
      return known;
    }
  }

  // 2. Fallback: Si no encuentra, retorna GENERAL (o podrías retornar el string original si prefieres)
  // Para efectos de dashboard, mejor agrupar errores en GENERAL o loguearlos
  console.warn(`Área no reconocida en DB: "${dbArea}". Se asignará a GENERAL (solo visualización).`);
  return "GENERAL";
};

// Convertir respuesta de texto a puntaje numérico (Versión Robusta)
// NOTA: Se eliminaron referencias a Mood ("bien", "mal") para evitar calificar emociones por error.
const getScoreValue = (freq: string): number => {
  const cleanFreq = normalizeStr(freq);
  if (!cleanFreq) return 0;

  // Casos Positivos (10 puntos)
  // "siempre", "si", "sí", "s"
  if (cleanFreq === "siempre" || cleanFreq === "si" || cleanFreq === "sí" || cleanFreq === "s" || cleanFreq.includes("siempre")) {
    return 10;
  }

  // Casos Neutros (5 puntos)
  // "a veces", "aveces", "n/a", "na", "no aplica", "no apllica"
  if (cleanFreq.includes("veces") || cleanFreq === "n/a" || cleanFreq === "na" || cleanFreq.includes("aplica") || cleanFreq.includes("regular")) {
    return 5;
  }

  // Casos Negativos (0 puntos)
  // "nunca", "no", "n"
  if (cleanFreq === "nunca" || cleanFreq === "no" || cleanFreq === "n" || cleanFreq.includes("nunca")) {
    return 0;
  }
  
  // Por defecto, si no se reconoce (ej. data corrupta), retornamos 0 para no inflar promedios artificialmente
  return 0;
};

// ============================================================================
// HELPER DE PAGINACIÓN (Solución al límite de 1000 filas)
// ============================================================================

/**
 * Obtiene TODAS las filas de una tabla, superando el límite de 1000 registros de Supabase
 * mediante peticiones paginadas en bucle.
 */
const fetchAllRows = async (tableName: string, selectQuery: string = '*', orderByCol: string = 'id') => {
  if (!isConfigured()) return [];
  
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let more = true;

  try {
    while (more) {
      const to = from + step - 1;
      
      const { data, error } = await supabase
        .from(tableName)
        .select(selectQuery)
        .order(orderByCol, { ascending: true })
        .range(from, to);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        
        // Si recibimos menos datos que el "step", significa que llegamos al final
        if (data.length < step) {
          more = false;
        } else {
          from += step;
        }
      } else {
        more = false;
      }
    }
    return allData;
  } catch (err) {
    console.error(`Error fetching all rows from ${tableName}:`, err);
    return [];
  }
};

// ============================================================================
// FUNCIONES DE BASE DE DATOS
// ============================================================================

/**
 * Guarda una encuesta completa en la base de datos
 */
export const saveSurveyToDb = async (data: SurveyData): Promise<boolean> => {
  if (!isConfigured()) {
    console.warn("MODO DEMO: Supabase no está configurado. Los datos no se guardarán en la nube.");
    return true; 
  }

  try {
    // Intentamos guardar el área limpia si coincide con el enum, si no, guardamos el raw trimmeado
    const cleanArea = matchArea(data.area) !== "GENERAL" ? matchArea(data.area) : data.area.trim();

    // 1. Insertar Cabecera (Encuesta)
    const { data: surveyResult, error: surveyError } = await supabase
      .from('encuestas')
      .insert({
        fecha_registro: new Date().toISOString(), 
        area: cleanArea, 
        mood: data.mood,
        vulnerability_text: data.vulnerabilityText,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (surveyError || !surveyResult) {
      console.error('Error guardando encuesta:', JSON.stringify(surveyError, null, 2));
      throw surveyError;
    }

    const surveyId = surveyResult.id;

    // 2. Preparar Respuestas (Detalle)
    const answersToInsert = Object.entries(data.answers).map(([qId, answer]) => {
      const questionId = parseInt(qId);
      const questionText = SURVEY_QUESTIONS.find(q => q.id === questionId)?.text || "Pregunta desconocida";
      const answerStr = answer as string;
      
      // IMPORTANTE: Si es la pregunta 14 (Cambios), forzamos puntaje 0 para que NO se califique.
      const score = (questionId === 14) ? 0 : getScoreValue(answerStr);

      return {
        encuesta_id: surveyId,
        pregunta_id: questionId,
        pregunta_texto: questionText,
        respuesta: answerStr,
        puntaje: score
      };
    });

    // 3. Insertar Respuestas en lote
    const { error: answersError } = await supabase
      .from('respuestas')
      .insert(answersToInsert);

    if (answersError) {
      console.error('Error guardando respuestas:', JSON.stringify(answersError, null, 2));
      throw answersError;
    }

    return true;

  } catch (error) {
    console.error('Error en transacción de guardado:', error);
    return false;
  }
};

/**
 * Obtiene detalles de una encuesta específica (respuestas) para editar
 */
export const fetchSurveyDetails = async (surveyId: number) => {
  if (!isConfigured()) return null;

  const { data: survey, error: surveyError } = await supabase
    .from('encuestas')
    .select('*')
    .eq('id', surveyId)
    .single();

  const { data: answers, error: answersError } = await supabase
    .from('respuestas')
    .select('*')
    .eq('encuesta_id', surveyId)
    .order('pregunta_id', { ascending: true });

  if (surveyError || answersError) {
    console.error("Error fetching details", surveyError, answersError);
    return null;
  }

  return { survey, answers };
};

/**
 * Actualiza una encuesta y sus respuestas
 */
export const updateSurvey = async (
  surveyId: number, 
  metaData: { area: string, mood: string, vulnerability_text: string },
  answers: Record<number, string>
) => {
  if (!isConfigured()) return { success: false, error: "DB no configurada" };

  try {
    // Usar matchArea para asegurar que guardamos el nombre estándar del área
    const cleanArea = matchArea(metaData.area) !== "GENERAL" ? matchArea(metaData.area) : metaData.area.trim();

    // 1. Actualizar metadatos de la encuesta
    const { error: headerError } = await supabase
      .from('encuestas')
      .update({
        area: cleanArea,
        mood: metaData.mood,
        vulnerability_text: metaData.vulnerability_text
      })
      .eq('id', surveyId);

    if (headerError) throw headerError;

    // 2. Actualizar cada respuesta individualmente
    // Utilizamos Promise.all para hacer las peticiones en paralelo y mejorar rendimiento
    const updatePromises = Object.entries(answers).map(async ([qId, respText]) => {
      const qNum = parseInt(qId);
      // IMPORTANTE: Forzar puntaje 0 para pregunta 14 al editar
      const newScore = (qNum === 14) ? 0 : getScoreValue(respText);
      
      const { error: ansError } = await supabase
        .from('respuestas')
        .update({
          respuesta: respText,
          puntaje: newScore
        })
        .eq('encuesta_id', surveyId)
        .eq('pregunta_id', qNum);
        
      if (ansError) throw ansError;
    });

    await Promise.all(updatePromises);

    return { success: true };
  } catch (e: any) {
    console.error("Error updating survey:", e);
    return { success: false, error: e.message };
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
    if (error.code === 'PGRST205') {
      console.warn("Tabla 'historico_bimestral' no encontrada. Funcionalidad de histórico desactivada.");
      return {};
    }
    console.error('Error cargando históricos:', JSON.stringify(error, null, 2));
    return {};
  }

  const formatted: Record<string, { score: string, count: string, label?: string }> = {};
  data.forEach((row: any) => {
    // Normalizamos el área del histórico para que coincida con el dashboard
    const areaKey = matchArea(row.area);
    formatted[areaKey] = {
      score: row.score_anterior?.toString() || "",
      count: row.count_anterior?.toString() || "",
      label: row.periodo_label || "" 
    };
  });
  
  return formatted;
};

/**
 * Guarda o actualiza un dato histórico
 */
export const upsertHistoricalData = async (area: string, score: string, count: string, periodoLabel: string = "") => {
  if (!isConfigured()) return;

  // Asegurar que guardamos el nombre limpio
  const cleanArea = matchArea(area) !== "GENERAL" ? matchArea(area) : area.trim();

  const basePayload = {
    area: cleanArea,
    score_anterior: parseFloat(score) || 0,
    count_anterior: parseInt(count) || 0,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('historico_bimestral')
    .upsert({
      ...basePayload,
      periodo_label: periodoLabel,
    }, { onConflict: 'area' });
  
  if (error) {
    if (error.code === 'PGRST204' || error.code === '42703') {
       console.warn(`Columna 'periodo_label' no detectada. Reintentando guardar sin etiqueta.`);
       const { error: retryError } = await supabase
        .from('historico_bimestral')
        .upsert(basePayload, { onConflict: 'area' });

       if (retryError) throw new Error("Error al guardar histórico: " + retryError.message);
       return; 
    }
    if (error.code === 'PGRST205') {
       throw new Error("La tabla 'historico_bimestral' no existe.");
    }
    console.error(`Error guardando histórico para ${area}:`, JSON.stringify(error, null, 2));
    throw new Error(error.message);
  }
};

/**
 * NUEVO: Obtiene la línea de tiempo histórica para gráficas
 */
export const fetchTimelineData = async () => {
  if (!isConfigured()) return [];

  const { data, error } = await supabase
    .from('historico_timeline')
    .select('*')
    .order('fecha_cierre', { ascending: true });

  if (error) {
    if (error.code === 'PGRST205') {
       console.warn("Tabla 'historico_timeline' no encontrada.");
       return [];
    }
    console.error("Error fetching timeline:", JSON.stringify(error, null, 2));
    return [];
  }
  return data || [];
};

/**
 * Convierte los datos de 'historico_bimestral' al formato de 'historico_timeline'
 */
export const fetchBimestralAsTimelineRows = async () => {
  if (!isConfigured()) return [];

  const { data, error } = await supabase
    .from('historico_bimestral')
    .select('*');

  if (error || !data || data.length === 0) return [];

  return data.map((row: any) => {
    let etiquetaClean = "Bimestre Anterior";
    if (row.periodo_label && row.periodo_label.trim().length > 0) {
      etiquetaClean = row.periodo_label;
    } else if (row.updated_at) {
      try {
        const dateObj = new Date(row.updated_at);
        const mes = dateObj.toLocaleString('es-ES', { month: 'long' });
        const anio = dateObj.getFullYear();
        const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
        etiquetaClean = `${mesCap} ${anio}`;
      } catch (e) {
        etiquetaClean = "Bimestre Anterior";
      }
    }

    return {
      id: `temp_${row.id}`, 
      fecha_cierre: row.updated_at || new Date().toISOString(),
      area: matchArea(row.area), // Normalizar también aquí
      score: row.score_anterior,
      count: row.count_anterior,
      etiqueta: etiquetaClean
    };
  });
};

/**
 * NUEVO: Guarda un snapshot completo de todas las áreas en la línea de tiempo
 */
export const saveTimelineSnapshot = async (statsByArea: Record<string, any>, label: string = "Cierre") => {
  if (!isConfigured()) return { success: false, error: "DB no configurada" };

  const fechaCierre = new Date().toISOString();
  const areas = Object.values(Area);
  
  const insertData = areas.map(area => {
    const stat = statsByArea[area];
    const score = stat ? (stat.avgScore * 10) : 0;
    const count = stat ? stat.total : 0;
    
    return {
      fecha_cierre: fechaCierre,
      area: area,
      score: score,
      count: count,
      etiqueta: label
    };
  });

  const { error } = await supabase
    .from('historico_timeline')
    .insert(insertData);

  if (error) {
    if (error.code === 'PGRST205') {
      return { success: false, error: "La tabla 'historico_timeline' no existe." };
    }
    console.error("Error saving timeline snapshot:", JSON.stringify(error, null, 2));
    return { success: false, error: error.message };
  }
  return { success: true };
};

export const fetchSurveysList = async (areaFilter: string) => {
  if (!isConfigured()) return [];

  // Usamos fetchAllRows para asegurar que vemos todas las encuestas en la gestión
  // aunque sean más de 1000.
  const allSurveys = await fetchAllRows('encuestas', 'id, fecha_registro, area, mood, vulnerability_text, created_at', 'created_at');

  if (areaFilter === 'GENERAL') return allSurveys;

  // Filtro robusto en cliente usando matchArea
  return allSurveys.filter((s: any) => matchArea(s.area) === areaFilter);
};

export const deleteSurvey = async (id: number): Promise<{ success: boolean; error?: string }> => {
  if (!isConfigured()) return { success: false, error: "Base de datos no configurada" };

  try {
    const { error: answersError } = await supabase
      .from('respuestas')
      .delete()
      .eq('encuesta_id', id);

    if (answersError) console.warn("Error borrando respuestas:", JSON.stringify(answersError));

    const { error } = await supabase
      .from('encuestas')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/**
 * Obtiene todos los datos para el Dashboard y los procesa
 * AHORA USA PAGINACIÓN PARA SUPERAR EL LÍMITE DE 1000 FILAS
 */
export const fetchDashboardStats = async () => {
  if (!isConfigured()) return null;

  // Usamos la nueva función fetchAllRows en lugar de supabase.select simple
  const [surveys, answers] = await Promise.all([
    fetchAllRows('encuestas'),
    fetchAllRows('respuestas')
  ]);

  if (!surveys || !answers) {
    console.error("Error fetching dashboard data (Pagination failed)");
    return null;
  }

  return processStats(surveys, answers);
};

// Función auxiliar para procesar datos crudos (OPTIMIZADA)
const processStats = (surveys: any[], answers: any[]) => {
  const areas = Object.values(Area);
  
  // 1. Crear Map de Encuestas para acceso O(1)
  const surveyMap = new Map();
  surveys.forEach(s => {
    surveyMap.set(s.id, {
      ...s,
      cleanArea: matchArea(s.area) // Pre-calcular el área normalizada
    });
  });

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

  // 2. Procesar Encuestas (Cabeceras)
  surveyMap.forEach((s) => {
    const area = s.cleanArea;
    const mood = s.mood as Mood;
    const hasVuln = s.vulnerability_text && s.vulnerability_text.trim().length > 0;
    const commentData = hasVuln ? { text: s.vulnerability_text, date: s.fecha_registro } : null;

    updateStatNode(stats['GENERAL'], mood, hasVuln, commentData);
    
    if (stats[area]) {
      updateStatNode(stats[area], mood, hasVuln, commentData);
    }
  });

  // 3. Procesar Respuestas (Detalles)
  answers.forEach(a => {
    const parentSurvey = surveyMap.get(a.encuesta_id);
    
    // Si hay una respuesta huérfana (sin encuesta padre), la ignoramos
    if (!parentSurvey) return;

    const area = parentSurvey.cleanArea;
    const qId = a.pregunta_id;
    
    // Recalcular puntaje al vuelo (usando lógica robusta)
    // IMPORTANTE: Forzamos 0 si es pregunta 14
    const score = (qId === 14) ? 0 : getScoreValue(a.respuesta); 
    const resp = a.respuesta; 

    updateAnswerNode(stats['GENERAL'], qId, resp, score);
    if (stats[area]) {
      updateAnswerNode(stats[area], qId, resp, score);
    }
  });

  // 4. Calcular Promedios Finales
  const finalStats: any = {};
  Object.keys(stats).forEach(key => {
    const s = stats[key];
    
    const moodDist = [
      { label: "Muy Bien", val: s.moodCounts[Mood.MUY_BIEN], color: "bg-blue-700" }, // Matched UI
      { label: "Bien", val: s.moodCounts[Mood.BIEN], color: "bg-teal-600" }, // Matched UI
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
        siempreCount: qStats.siempre,
        aVecesCount: qStats.aVeces,
        nuncaCount: qStats.nunca
      };
    });

    finalStats[key] = {
      total: s.total,
      today: 0,
      // Mejora de precisión: Mantener decimales hasta el renderizado
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
  // CORRECCIÓN CRÍTICA: Excluir Pregunta 14 del cálculo de satisfacción promedio.
  // Solo sumamos al score si NO es la pregunta 14.
  if (qId !== 14) {
    node.sumScore += score;
    node.countScore += 1;
  }

  if (!node.questionCounts[qId]) {
    node.questionCounts[qId] = { siempre: 0, aVeces: 0, nunca: 0 };
  }
  
  // Normalización para conteo visual usando normalizeStr
  const cleanResp = normalizeStr(resp);
  
  // Incluye variantes comunes y limpieza de estado de ánimo que pudiera coincidir
  if (cleanResp === "siempre" || cleanResp === "si" || cleanResp === "sí" || cleanResp === "s" || cleanResp.includes("siempre")) {
    node.questionCounts[qId].siempre += 1;
  }
  else if (cleanResp.includes("veces") || cleanResp === "n/a" || cleanResp === "na" || cleanResp.includes("aplica") || cleanResp.includes("regular")) {
    node.questionCounts[qId].aVeces += 1;
  }
  else if (cleanResp === "nunca" || cleanResp === "no" || cleanResp === "n" || cleanResp.includes("nunca")) {
    node.questionCounts[qId].nunca += 1;
  }
};

/**
 * Obtiene datos para Excel (Normalizados)
 * AHORA USA PAGINACIÓN
 */
export const fetchExcelData = async () => {
  if (!isConfigured()) {
    return [];
  }

  // Usamos fetchAllRows para garantizar la exportación completa
  const [surveys, answers] = await Promise.all([
    fetchAllRows('encuestas'),
    fetchAllRows('respuestas')
  ]);

  if (!surveys || !answers) {
    console.error("Error fetching excel data");
    return [];
  }
  
  const surveysMap: any = {};
  
  surveys.forEach((s: any) => {
    surveysMap[s.id] = {
      "ID Encuesta": s.id,
      "Fecha Registro": s.fecha_registro,
      "Área": matchArea(s.area), // Limpieza en Excel también
      "Estado de Ánimo": s.mood,
      "Vulnerabilidad": s.vulnerability_text,
      "Promedio": 0,
      _sumScore: 0,
      _countScore: 0
    };
  });

  answers.forEach((a: any) => {
    if (surveysMap[a.encuesta_id]) {
      const s = surveysMap[a.encuesta_id];
      s[`P${a.pregunta_id}: ${a.pregunta_texto}`] = a.respuesta;
      
      // Recalcular el puntaje para el excel también
      // IMPORTANTE: Forzar 0 si es pregunta 14 para que no aparezca calificada en el Excel
      const realScore = (a.pregunta_id === 14) ? 0 : getScoreValue(a.respuesta);
      s[`Score_P${a.pregunta_id}`] = realScore;
      
      // CORRECCIÓN CRÍTICA: Excluir P14 del promedio en Excel también
      if (a.pregunta_id !== 14) {
        s._sumScore += realScore;
        s._countScore += 1;
      }
    }
  });

  return Object.values(surveysMap).map((s: any) => {
    s["Promedio Final"] = s._countScore > 0 ? (s._sumScore / s._countScore).toFixed(2) : 0;
    delete s._sumScore;
    delete s._countScore;
    return s;
  });
};
