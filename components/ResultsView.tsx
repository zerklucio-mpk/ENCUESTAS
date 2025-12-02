import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, BarChart3, Users, TrendingUp, AlertCircle, MessageSquare, Filter, History, Save, X, FileDown, Loader2, FileSpreadsheet, RefreshCw, Database, Calendar, Trash2, List, AlertTriangle, ArrowDownToLine, Check, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { Area, SURVEY_QUESTIONS, Mood, Frequency } from '../types';
import { fetchDashboardStats, fetchHistoricalData, upsertHistoricalData, fetchExcelData, fetchSurveysList, deleteSurvey } from '../services/dbService';
import { isConfigured } from '../services/supabaseClient';

interface ResultsViewProps {
  onBack: () => void;
}

interface DashboardStats {
  total: number;
  today: number;
  avgScore: number;
  vulnerabilityCount: number;
  comments: { text: string; date: string }[]; 
  moodDistribution: { label: string; percentage: number; color: string }[];
  questionsBreakdown: QuestionStat[];
}

interface QuestionStat {
  id: number;
  text: string;
  siempre: number;
  aVeces: number;
  nunca: number;
}

interface HistoricalData {
  score: string; // 0-100
  count: string; // Número de personas
}

interface SimpleSurvey {
  id: number;
  fecha_registro: string;
  area: string;
  mood: string;
  vulnerability_text: string | null;
}

const AREAS_LIST = Object.values(Area).sort();

const ResultsView: React.FC<ResultsViewProps> = ({ onBack }) => {
  const [selectedArea, setSelectedArea] = useState<string>("GENERAL");
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(true);
  
  // Estado para visualización de comentarios
  const [showComments, setShowComments] = useState(false);
  
  // Estado para confirmación de borrado personalizado
  const [surveyToDelete, setSurveyToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado para confirmación de Snapshot (Cierre actual)
  const [isSnapshotConfirmOpen, setIsSnapshotConfirmOpen] = useState(false);
  
  // Estados de carga
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [statsData, setStatsData] = useState<Record<string, DashboardStats> | null>(null);
  const [historicalData, setHistoricalData] = useState<Record<string, HistoricalData>>({});
  
  // Estado para gestión
  const [rawSurveys, setRawSurveys] = useState<SimpleSurvey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  // Cargar datos al montar
  useEffect(() => {
    setDbConfigured(isConfigured());
    loadAllData();
  }, []);

  // Resetear la vista de comentarios cuando se cambia de área
  useEffect(() => {
    setShowComments(false);
  }, [selectedArea]);

  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [stats, history] = await Promise.all([
        fetchDashboardStats(),
        fetchHistoricalData()
      ]);
      
      if (stats) {
        setStatsData(stats);
      } else {
        // Fallback si no hay datos (o DB no conectada)
        setStatsData(null);
      }

      if (history) {
        // Rellenar huecos si faltan áreas en el histórico
        const fullHistory: Record<string, HistoricalData> = {};
        AREAS_LIST.forEach(area => {
          fullHistory[area] = history[area] || { score: "", count: "" };
        });
        setHistoricalData(fullHistory);
      } else {
        // Inicializar vacío si falla
        const emptyHistory: Record<string, HistoricalData> = {};
        AREAS_LIST.forEach(area => { emptyHistory[area] = { score: "", count: "" }; });
        setHistoricalData(emptyHistory);
      }
    } catch (e) {
      console.error("Error loading dashboard data", e);
    } finally {
      if (!silent) setLoading(false);
      else setIsRefreshing(false);
    }
  };

  const handleOpenManage = async () => {
    setIsManageModalOpen(true);
    setLoadingSurveys(true);
    const data = await fetchSurveysList(selectedArea);
    setRawSurveys(data);
    setLoadingSurveys(false);
  };

  // 1. Abrir modal de confirmación borrado
  const promptDelete = (id: number) => {
    setSurveyToDelete(id);
  };

  // 2. Ejecutar borrado real
  const confirmDelete = async () => {
    if (surveyToDelete === null) return;
    
    setIsDeleting(true);
    const result = await deleteSurvey(surveyToDelete);
    
    if (result.success) {
      // Actualizar lista local
      setRawSurveys(prev => prev.filter(s => s.id !== surveyToDelete));
      // Recargar stats principales en segundo plano (silent reload)
      loadAllData(true); 
      setSurveyToDelete(null); // Cerrar modal confirmación
    } else {
      alert(`Error al eliminar la encuesta: ${result.error || "Error desconocido"}. Revisa los permisos en Supabase.`);
    }
    setIsDeleting(false);
  };

  // Obtener estadísticas actuales según selección o defaults en cero
  const currentStats = (statsData && statsData[selectedArea]) || {
    total: 0,
    today: 0,
    avgScore: 0,
    vulnerabilityCount: 0,
    comments: [],
    moodDistribution: [],
    questionsBreakdown: SURVEY_QUESTIONS.map(q => ({ id: q.id, text: q.text, siempre: 0, aVeces: 0, nunca: 0 }))
  };

  // Helper para comparar históricos dinámicamente
  const getComparisonsForArea = (area: string, stats: DashboardStats) => {
    let historicalScore = 0;
    let historicalCount = 0;

    if (area === "GENERAL") {
      const values = (Object.values(historicalData) as HistoricalData[]).filter(v => v.score !== "");
      const totalScore = values.reduce((acc, val) => acc + (parseFloat(val.score) || 0), 0);
      historicalScore = values.length > 0 ? totalScore / values.length : 0;
      
      historicalCount = (Object.values(historicalData) as HistoricalData[]).reduce((acc, val) => acc + (parseInt(val.count) || 0), 0);
    } else {
      historicalScore = parseFloat(historicalData[area]?.score || "0");
      historicalCount = parseInt(historicalData[area]?.count || "0");
    }

    const historicalScale10 = historicalScore / 10;
    const scoreDiff = stats.avgScore - historicalScale10;
    const countDiff = stats.total - historicalCount;
    
    return {
      scoreLabel: `${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)} vs ant.`,
      scoreDiff,
      countLabel: `${countDiff >= 0 ? '+' : ''}${countDiff} vs ant.`,
      countDiff
    };
  };

  const { scoreLabel, scoreDiff, countLabel, countDiff } = getComparisonsForArea(selectedArea, currentStats);

  // Solicitar snapshot (Abrir modal)
  const handleRequestSnapshot = () => {
    if (!statsData) {
      alert("No se encontraron datos estadísticos cargados para importar.");
      return;
    }
    setIsSnapshotConfirmOpen(true);
  };

  // Ejecutar snapshot (Acción confirmada)
  const executeSnapshotImport = () => {
    if (!statsData) return;

    const newHistoryData: Record<string, HistoricalData> = { ...historicalData };
    let importedCount = 0;

    AREAS_LIST.forEach(area => {
      const currentAreaStats = statsData[area];
      if (currentAreaStats) {
        // Convertimos el promedio (0-10) a escala 0-100 para el histórico
        const score100 = Math.round(currentAreaStats.avgScore * 10);
        newHistoryData[area] = {
          score: score100.toString(),
          count: currentAreaStats.total.toString()
        };
        importedCount++;
      }
    });

    if (importedCount > 0) {
      setHistoricalData(newHistoryData);
      setIsSnapshotConfirmOpen(false); // Cerrar modal
    } else {
      setIsSnapshotConfirmOpen(false);
      alert("No se encontraron datos por área para importar.");
    }
  };

  // Guardar histórico
  const handleSaveHistory = async () => {
    setIsSavingHistory(true);
    try {
      // Guardar cada área modificada
      for (const area of AREAS_LIST) {
        const h = historicalData[area];
        if (h) {
          await upsertHistoricalData(area, h.score, h.count);
        }
      }
      // Recargar para confirmar
      await loadAllData(true);
      alert("Histórico guardado correctamente.");
      setIsHistoryModalOpen(false); // Close only on success
    } catch (error: any) {
      alert("Hubo un error al guardar los datos históricos: " + error.message);
    } finally {
      setIsSavingHistory(false);
    }
  };

  const handleHistoryChange = (area: string, field: keyof HistoricalData, value: string) => {
    setHistoricalData(prev => ({
      ...prev,
      [area]: { ...prev[area], [field]: value }
    }));
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#F1F5F9' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      const cleanName = selectedArea.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`Reporte_CVDirecto_${cleanName}_${dateStr}.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Error al generar PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!dbConfigured) {
      alert("No se puede exportar Excel porque no hay base de datos conectada.");
      return;
    }
    setIsExcelExporting(true);
    try {
      const XLSX = await import('xlsx');
      
      // Obtener datos reales de Supabase
      const data = await fetchExcelData();

      const worksheet = XLSX.utils.json_to_sheet(data);
      if (data.length === 0) {
           XLSX.utils.sheet_add_aoa(worksheet, [["No hay datos registrados aún."]], { origin: "A1" });
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados Detallados");
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `CVDirecto_Data_Completa_${dateStr}.xlsx`);
    } catch (error) {
      console.error("Error Excel", error);
      alert("Error al exportar Excel.");
    } finally {
      setIsExcelExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 animate-fade-in">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold">Cargando datos de Supabase...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-12 relative">
      
      {!dbConfigured && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 mb-6 rounded-r shadow-sm flex items-center gap-3">
          <Database className="w-6 h-6 text-amber-600" />
          <div>
            <p className="font-bold">Base de Datos No Conectada</p>
            <p className="text-sm">Estás viendo el dashboard en modo demostración. Los datos no se están guardando ni leyendo de la nube.</p>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            <button onClick={onBack} className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border border-slate-300 text-sm shadow-sm">
              <ArrowLeft className="w-4 h-4" /> Salir
            </button>
            <button onClick={() => setIsHistoryModalOpen(true)} className="bg-white hover:bg-slate-50 text-blue-700 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm shadow-sm border border-blue-200">
              <History className="w-4 h-4" /> Registrar Bimestre Anterior
            </button>
            <button onClick={handleOpenManage} className="bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm shadow-sm border border-slate-300">
              <List className="w-4 h-4" /> Gestionar Registros
            </button>
            <button onClick={() => loadAllData(false)} className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border border-slate-300 text-sm shadow-sm" title="Recargar datos">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
          
          <div className="flex gap-2 w-full xl:w-auto">
            <button onClick={handleExportExcel} disabled={isExcelExporting || !dbConfigured} className={`px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 text-sm shadow-md flex-1 md:flex-none justify-center ${!dbConfigured ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
              {isExcelExporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando Excel...</> : <><FileSpreadsheet className="w-4 h-4" /> Exportar Excel</>}
            </button>

            <button onClick={handleExportPDF} disabled={isExporting} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 text-sm shadow-md flex-1 md:flex-none justify-center">
              {isExporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando PDF...</> : <><FileDown className="w-4 h-4" /> Reporte PDF</>}
            </button>
          </div>
      </div>

      {/* REPORTE VISUAL DASHBOARD NORMAL */}
      <div ref={reportRef} className="space-y-6 bg-slate-100 p-1 md:p-4 rounded-xl">
        
        {/* Header Dashboard */}
        <div className="bg-slate-800 text-white p-6 rounded-lg shadow-lg flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Resultados Bimestrales</h2>
              <p className="text-slate-300 text-sm mt-1">CVDirecto - Proyectos y Mejora Continua</p>
            </div>
          </div>
          <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-slate-300 font-bold min-w-fit"><Filter className="w-5 h-5" /> Filtrar por Área:</div>
            {isExporting ? (
              <div className="text-white font-bold text-lg border-b border-white pb-1">{selectedArea === "GENERAL" ? "🏢 VISTA GENERAL (Toda la Empresa)" : selectedArea}</div>
            ) : (
              <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="w-full md:w-auto flex-grow bg-slate-800 border border-slate-500 text-white rounded-lg p-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer">
                <option value="GENERAL">🏢 VISTA GENERAL (Toda la Empresa)</option>
                <hr />
                {AREAS_LIST.map(area => (<option key={area} value={area}>{area}</option>))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="bg-blue-100 text-blue-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Visualizando: {selectedArea === "GENERAL" ? "Toda la Empresa" : selectedArea}
          </span>
        </div>

        {/* METRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-blue-600">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-lg"><Users className="w-6 h-6 text-blue-600" /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${countDiff < 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{countLabel}</span>
            </div>
            <p className="text-slate-500 font-bold uppercase text-sm tracking-wide">Encuestas Totales</p>
            <p className="text-4xl font-extrabold text-slate-800 mt-1">{currentStats.total}</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 rounded-lg"><TrendingUp className="w-6 h-6 text-emerald-600" /></div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${scoreDiff < 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{scoreLabel}</span>
            </div>
            <p className="text-slate-500 font-bold uppercase text-sm tracking-wide">Satisfacción Promedio</p>
            <p className="text-4xl font-extrabold text-slate-800 mt-1">{currentStats.avgScore.toFixed(1)}<span className="text-lg text-slate-400">/10</span></p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-red-50 rounded-lg"><AlertCircle className="w-6 h-6 text-red-600" /></div>
              <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">Acumulado</span>
            </div>
            <p className="text-slate-500 font-bold uppercase text-sm tracking-wide">Reportes Vulnerabilidad</p>
            <p className="text-4xl font-extrabold text-slate-800 mt-1">{currentStats.vulnerabilityCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 transition-all duration-300">
          {/* DISTRIBUCIÓN */}
          <div className={`bg-white p-8 rounded-lg border border-slate-200 shadow-sm transition-all duration-300 ${showComments ? '' : 'lg:col-span-2'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-2 border-slate-100 gap-4">
              <h3 className="text-xl font-bold text-slate-800">Distribución de Ánimo</h3>
              
              <button 
                onClick={() => setShowComments(!showComments)}
                className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition-colors border ${
                  showComments 
                    ? 'bg-slate-100 text-slate-700 border-slate-300' 
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                {showComments ? <ChevronUp className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                {showComments ? 'Ocultar Comentarios' : 'Ver Comentarios Abiertos'}
              </button>
            </div>

            {currentStats.total > 0 ? (
              <div className="space-y-6">
                {currentStats.moodDistribution.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm font-bold text-slate-600 mb-2"><span>{item.label}</span><span>{item.percentage}%</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden"><div className={`h-full rounded-full ${item.color} transition-all duration-1000 ease-out`} style={{ width: `${item.percentage}%` }}></div></div>
                  </div>
                ))}
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center py-10 text-slate-400"><AlertCircle className="w-12 h-12 mb-2 opacity-50" /><p className="font-bold">No hay datos registrados</p></div>
            )}
          </div>

          {/* COMENTARIOS - VISIBLE SOLO SI SHOWCOMMENTS ES TRUE */}
          {showComments && (
            <div className="bg-white p-8 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[400px] animate-fade-in">
              <h3 className="text-xl font-bold text-slate-800 mb-2 border-b pb-2 border-slate-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-500" /> Comentarios Abiertos
              </h3>
              
              <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 mt-2">
                {currentStats.comments.length > 0 ? (
                  <div className="space-y-4">
                    {currentStats.comments.map((comment, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-bold text-slate-400">
                              {comment.date ? new Date(comment.date).toLocaleDateString() : 'Sin fecha'}
                          </span>
                        </div>
                        <p className="text-slate-700 italic text-sm md:text-base leading-relaxed">"{comment.text}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-center">
                    <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold text-lg">Sin reportes</p>
                    <p className="text-sm text-slate-400">No hay comentarios de vulnerabilidad para esta selección.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ANALISIS PREGUNTA */}
        <div className="bg-white p-6 md:p-8 rounded-lg border border-slate-200 shadow-sm break-inside-avoid">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-4 gap-4">
            <h3 className="text-xl font-bold text-slate-800">Análisis por Pregunta</h3>
            <div className="flex gap-4 text-xs md:text-sm font-bold bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-full"></div> Siempre / Si</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-full"></div> A veces / NA</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-400 rounded-full"></div> Nunca / No</div>
            </div>
          </div>
          
          <div className="space-y-8">
            {currentStats.questionsBreakdown.map((q) => (
              <div key={q.id} className="space-y-2">
                <div className="flex justify-between items-end"><p className="text-sm md:text-base font-bold text-slate-700 w-11/12"><span className="inline-block font-extrabold text-slate-400 mr-2 w-6 text-right">{q.id}.</span> {q.text}</p></div>
                <div className="h-8 w-full rounded-md overflow-hidden flex text-xs font-bold text-white leading-8 shadow-inner bg-slate-100">
                  {q.siempre > 0 && <div style={{ width: `${q.siempre}%` }} className="bg-blue-600 flex items-center justify-center relative group border-r border-blue-700/20 last:border-0"><span className="text-[10px] md:text-xs">{q.siempre}%</span></div>}
                  {q.aVeces > 0 && <div style={{ width: `${q.aVeces}%` }} className="bg-amber-500 flex items-center justify-center relative group border-r border-amber-600/20 last:border-0"><span className="text-[10px] md:text-xs">{q.aVeces}%</span></div>}
                  {q.nunca > 0 && <div style={{ width: `${q.nunca}%` }} className="bg-slate-400 flex items-center justify-center relative group"><span className="text-[10px] md:text-xs">{q.nunca}%</span></div>}
                  {q.siempre === 0 && q.aVeces === 0 && q.nunca === 0 && <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 font-normal">Sin respuestas</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL HISTORY - Z-Index 60 to be above sticky header */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 relative">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center bg-slate-50 rounded-t-xl gap-4">
              <div><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-blue-600" /> Comparativa Bimestral</h3><p className="text-slate-500 text-sm mt-1">Metas del bimestre anterior.</p></div>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleRequestSnapshot} 
                  disabled={isSavingHistory}
                  className="bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-300 px-3 py-2 rounded-lg font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  title="Copiar los resultados actuales a la columna de histórico"
                >
                  <ArrowDownToLine className="w-4 h-4" /> 
                  Cargar Cierre Actual
                </button>
                <button onClick={() => setIsHistoryModalOpen(false)} disabled={isSavingHistory} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
               <div className="grid grid-cols-1 gap-6">
                 {AREAS_LIST.map(area => (
                   <div key={area} className="flex flex-col md:flex-row md:items-center gap-4 border-b border-slate-100 pb-4 last:border-0">
                     <label className="text-sm font-bold text-slate-700 w-full md:w-1/3">{area}</label>
                     <div className="flex gap-4 w-full md:w-2/3">
                        <div className="flex-1"><label className="block text-xs text-slate-500 mb-1 font-semibold">Satisfacción (0-100)</label><div className="flex items-center gap-2"><input type="number" min="0" max="100" value={historicalData[area]?.score || ""} onChange={(e) => handleHistoryChange(area, 'score', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="80" /><span className="text-slate-400 font-bold text-sm">%</span></div></div>
                        <div className="flex-1"><label className="block text-xs text-slate-500 mb-1 font-semibold">Cant. Personas</label><div className="flex items-center gap-2"><input type="number" min="0" value={historicalData[area]?.count || ""} onChange={(e) => handleHistoryChange(area, 'count', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="20" /><span className="text-slate-400 font-bold text-sm">#</span></div></div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
              <button onClick={() => setIsHistoryModalOpen(false)} disabled={isSavingHistory} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors border border-transparent hover:border-slate-300">Cancelar</button>
              <button 
                onClick={handleSaveHistory} 
                disabled={isSavingHistory}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
              >
                {isSavingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSavingHistory ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>

            {/* CONFIRMATION OVERLAY (Z-Index 70 to be above History Modal Z-60) */}
            {isSnapshotConfirmOpen && (
              <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 rounded-xl animate-fade-in">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-center border-2 border-slate-200">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <Copy className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-2">¿Cargar Cierre Actual?</h4>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Esta acción copiará los resultados actuales (promedios y conteos) de todas las áreas y los colocará en la columna <strong>"Meta Anterior"</strong>.
                    <br/><br/>
                    <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded">Nota: Los cambios no se guardan en la base de datos hasta que hagas clic en "Guardar Cambios".</span>
                  </p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsSnapshotConfirmOpen(false)} 
                      className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={executeSnapshotImport}
                      className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors"
                    >
                      Sí, Cargar Datos
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL GESTION (LIST) - Z-Index 60 */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-200 relative">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <List className="w-5 h-5 text-blue-600" /> Gestión de Registros
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Eliminar encuestas (Visualizando: {selectedArea === 'GENERAL' ? 'Todas' : selectedArea})
                </p>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-0 overflow-y-auto custom-scrollbar flex-grow bg-slate-50">
              {loadingSurveys ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                  <p className="text-slate-500">Cargando registros...</p>
                </div>
              ) : rawSurveys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <AlertCircle className="w-12 h-12 text-slate-300 mb-2" />
                  <p className="text-slate-500 font-bold">No se encontraron encuestas registradas.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="p-4 border-b border-slate-200 font-bold text-sm">ID</th>
                      <th className="p-4 border-b border-slate-200 font-bold text-sm">Fecha</th>
                      <th className="p-4 border-b border-slate-200 font-bold text-sm">Área</th>
                      <th className="p-4 border-b border-slate-200 font-bold text-sm">Ánimo</th>
                      <th className="p-4 border-b border-slate-200 font-bold text-sm text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {rawSurveys.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-sm font-mono text-slate-400">#{s.id}</td>
                        <td className="p-4 text-sm font-bold text-slate-700">
                          {s.fecha_registro ? new Date(s.fecha_registro).toLocaleDateString() : '-'}
                          <span className="block text-xs text-slate-400 font-normal">
                             {s.fecha_registro ? new Date(s.fecha_registro).toLocaleTimeString() : ''}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600">{s.area}</td>
                        <td className="p-4 text-sm font-bold text-slate-700">{s.mood}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => promptDelete(s.id)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100 transition-colors"
                            title="Eliminar encuesta permanentemente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-white rounded-b-xl flex justify-between items-center text-xs text-slate-400 px-6">
              <span>Total registros: {rawSurveys.length}</span>
              <button onClick={() => setIsManageModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">Cerrar</button>
            </div>
            
            {/* DELETE CONFIRMATION MODAL OVERLAY */}
            {surveyToDelete !== null && (
              <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-4 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 p-6 flex flex-col items-center text-center scale-100">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                  <h4 className="text-xl font-extrabold text-slate-800 mb-2">¿Eliminar encuesta?</h4>
                  <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                    Estás a punto de borrar permanentemente la encuesta <span className="font-mono bg-slate-100 px-1 rounded">#{surveyToDelete}</span>. 
                    <br/><strong className="text-red-600">Esta acción no se puede deshacer.</strong>
                  </p>
                  <div className="flex w-full gap-3">
                    <button 
                      onClick={() => setSurveyToDelete(null)} 
                      disabled={isDeleting}
                      className="flex-1 py-3 px-4 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={confirmDelete}
                      disabled={isDeleting}
                      className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {isDeleting ? 'Borrando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsView;