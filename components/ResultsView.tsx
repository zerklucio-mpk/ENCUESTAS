
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, BarChart3, Users, TrendingUp, AlertCircle, MessageSquare, Filter, History, Save, X, FileDown, Loader2, FileSpreadsheet, RefreshCw, Database, Calendar, Trash2, List, AlertTriangle, ArrowDownToLine, Check, Copy, ChevronUp, ChevronDown, LineChart, MoreHorizontal, LayoutDashboard, MonitorPlay, ChevronRight, ChevronLeft, Trophy, Medal, Building2, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Area, SURVEY_QUESTIONS, Mood, Frequency } from '../types';
import { fetchDashboardStats, fetchHistoricalData, upsertHistoricalData, fetchExcelData, fetchSurveysList, deleteSurvey, saveTimelineSnapshot, fetchTimelineData, fetchBimestralAsTimelineRows } from '../services/dbService';
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
  // Raw counts
  siempreCount: number;
  aVecesCount: number;
  nuncaCount: number;
}

interface HistoricalData {
  score: string; // 0-100
  count: string; // Número de personas
  label?: string; // e.g. "Ene-Feb 2024"
}

interface SimpleSurvey {
  id: number;
  fecha_registro: string;
  area: string;
  mood: string;
  vulnerability_text: string | null;
}

interface TimelinePoint {
  date: string;
  displayDate: string;
  score: number;
  count: number;
  label?: string;
  isRef?: boolean; // Identifica si es la data de referencia temporal (bimestre anterior flotante)
}

const AREAS_LIST = Object.values(Area).sort();

const ResultsView: React.FC<ResultsViewProps> = ({ onBack }) => {
  const [selectedArea, setSelectedArea] = useState<string>("GENERAL");
  
  // Modals
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  
  // Presentation Mode State
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Actions states
  const [isExporting, setIsExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(true);
  
  // Estado para confirmación de borrado personalizado
  const [surveyToDelete, setSurveyToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado para confirmación de Snapshot (Cierre actual -> Meta Anterior)
  const [isSnapshotConfirmOpen, setIsSnapshotConfirmOpen] = useState(false);
  
  // Estado para confirmación de Snapshot Timeline (Gráfica)
  const [isTimelineSnapshotLoading, setIsTimelineSnapshotLoading] = useState(false);
  
  // Estado para mostrar/ocultar comentarios
  const [showComments, setShowComments] = useState(false);

  // Estados de carga
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  
  // Data State
  const [statsData, setStatsData] = useState<Record<string, DashboardStats> | null>(null);
  const [historicalData, setHistoricalData] = useState<Record<string, HistoricalData>>({});
  const [historyPeriodLabel, setHistoryPeriodLabel] = useState(""); // Label global del periodo

  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  // Estado para gestión
  const [rawSurveys, setRawSurveys] = useState<SimpleSurvey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const pdfExportRef = useRef<HTMLDivElement>(null); // Ref específica para el PDF limpio

  // Cargar datos al montar
  useEffect(() => {
    setDbConfigured(isConfigured());
    loadAllData();
  }, []);

  // Manejo de teclado para la presentación
  useEffect(() => {
    if (!isPresentationOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') setIsPresentationOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationOpen, currentSlide]);

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
        let foundLabel = "";

        AREAS_LIST.forEach(area => {
          fullHistory[area] = history[area] || { score: "", count: "" };
          // Recuperar la etiqueta si existe en alguno de los registros
          if (!foundLabel && history[area]?.label) {
            foundLabel = history[area].label!;
          }
        });
        setHistoricalData(fullHistory);
        setHistoryPeriodLabel(foundLabel); // Setear la etiqueta encontrada
      } else {
        // Inicializar vacío si falla
        const emptyHistory: Record<string, HistoricalData> = {};
        AREAS_LIST.forEach(area => { emptyHistory[area] = { score: "", count: "" }; });
        setHistoricalData(emptyHistory);
        setHistoryPeriodLabel("");
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

  // Función para abrir la gráfica evolutiva
  const handleOpenTimeline = async () => {
    if (!dbConfigured) {
      alert("No hay base de datos conectada para ver el historial.");
      return;
    }
    setIsTimelineModalOpen(true);
    setLoadingTimeline(true);
    try {
      // 1. Obtener Timeline Real (Instantáneas archivadas)
      const rawTimeline = await fetchTimelineData();
      
      // 2. Obtener "Bimestre Anterior" (Datos actuales en el modal histórico)
      // para tratarlos como un punto más en la gráfica.
      const rawBimestral = await fetchBimestralAsTimelineRows();

      // 3. Unir ambos datasets para procesarlos juntos
      const allRawData = [...rawTimeline, ...rawBimestral];

      // Agrupar por fecha
      const groupedByDate: Record<string, { sumScore: number, count: number, date: string, label?: string, isRef: boolean }> = {};
      
      allRawData.forEach((item: any) => {
        // Safety check for missing dates
        if (!item.fecha_cierre) return;
        
        const dateStr = String(item.fecha_cierre);
        const dateKey = dateStr.substring(0, 16); // YYYY-MM-DDTHH:mm
        
        // Detectar si es un registro de referencia temporal (Bimestre anterior manual)
        // Estos IDs se generan en dbService con prefijo "temp_"
        const isRef = String(item.id).startsWith("temp_");

        if (!groupedByDate[dateKey]) {
           groupedByDate[dateKey] = { 
             sumScore: 0, 
             count: 0, 
             date: dateStr,
             label: item.etiqueta, // Guardar etiqueta si existe
             isRef: isRef
           };
        }
        
        groupedByDate[dateKey].sumScore += parseFloat(item.score || 0);
        groupedByDate[dateKey].count += 1; 
        
        // Si cualquier item del grupo es referencia, el grupo se marca como referencia
        if (isRef) groupedByDate[dateKey].isRef = true;
      });

      const points: TimelinePoint[] = Object.values(groupedByDate).map(g => {
        const dateObj = new Date(g.date);
        const displayDateDefault = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Usar etiqueta si existe, si no, usar fecha
        // La etiqueta ya viene limpia desde dbService
        const finalLabel = g.label ? `${g.label}` : displayDateDefault;

        return {
          date: g.date,
          displayDate: finalLabel, 
          score: g.count > 0 ? (g.sumScore / g.count) : 0,
          count: g.count,
          label: g.label,
          isRef: g.isRef
        };
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setTimelineData(points);

    } catch (error) {
      console.error("Error loading timeline", error);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Guardar snapshot en Timeline (Base para la gráfica)
  const handleArchiveTimeline = async () => {
    if (!statsData) return;
    const confirm = window.confirm("¿Estás seguro de que quieres archivar el estado actual de TODAS las áreas en el historial evolutivo? Esto creará una nueva barra en la gráfica.");
    if (!confirm) return;

    setIsTimelineSnapshotLoading(true);
    try {
       const result = await saveTimelineSnapshot(statsData, "Cierre Manual");
       if (result.success) {
         // Recargar timeline
         await handleOpenTimeline();
       } else {
         alert("Error guardando timeline: " + result.error);
       }
    } catch (e) {
      console.error(e);
      alert("Error desconocido");
    } finally {
      setIsTimelineSnapshotLoading(false);
    }
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
    questionsBreakdown: SURVEY_QUESTIONS.map(q => ({ 
      id: q.id, 
      text: q.text, 
      siempre: 0, aVeces: 0, nunca: 0, 
      siempreCount: 0, aVecesCount: 0, nuncaCount: 0 
    }))
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
          count: currentAreaStats.total.toString(),
          label: historyPeriodLabel // Preservar o actualizar label
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
      // Guardar cada área modificada, incluyendo la etiqueta global
      for (const area of AREAS_LIST) {
        const h = historicalData[area];
        if (h) {
          await upsertHistoricalData(area, h.score, h.count, historyPeriodLabel);
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
    // Usamos la nueva referencia 'pdfExportRef' que contiene la plantilla profesional
    if (!pdfExportRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      // Pequeño delay para asegurar que los estilos de impresión se rendericen si hubieran cambios dinámicos
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(pdfExportRef.current, { 
        scale: 2, // Alta resolución
        useCORS: true, 
        logging: false, 
        backgroundColor: '#ffffff' // Fondo blanco puro para el reporte
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 1;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      
      // Añadir número de página a la primera página
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`Página ${pageNumber}`, pdfWidth - 25, pdfHeight - 10);
      
      heightLeft -= pdfHeight;
      
      // Lógica de paginación
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pageNumber++;
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        
        // Añadir número de página a las siguientes páginas
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Página ${pageNumber}`, pdfWidth - 25, pdfHeight - 10);
        
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

  // --- PRESENTATION LOGIC ---
  const presentationSlides = [
    "Portada",
    "Resumen Ejecutivo",
    // REMOVED: "Clima Laboral"
    "Factores de Riesgo (1/2)",
    "Factores de Riesgo (2/2)",
    "Ranking por Áreas"
  ];

  const startPresentation = () => {
    setCurrentSlide(0);
    setIsPresentationOpen(true);
  };

  const nextSlide = () => {
    setCurrentSlide(prev => (prev < presentationSlides.length - 1 ? prev + 1 : prev));
  };

  const prevSlide = () => {
    setCurrentSlide(prev => (prev > 0 ? prev - 1 : prev));
  };

  // Helper para generar el ranking
  const getAreaRanking = useCallback(() => {
    if (!statsData) return [];
    
    return AREAS_LIST.map(area => {
       const s = statsData[area];
       return {
         name: area,
         score: s ? s.avgScore : 0,
         total: s ? s.total : 0
       };
    })
    .filter(item => item.total > 0) // Solo mostrar áreas con encuestas
    .sort((a, b) => b.score - a.score); // Ordenar mayor a menor
  }, [statsData]);

  const areaRanking = getAreaRanking();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 animate-fade-in">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
        <h3 className="text-xl font-bold text-slate-700">Conectando con Supabase...</h3>
        <p className="text-slate-400 mt-2">Cargando métricas y análisis.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      
      {/* 1. STICKY HEADER & TOOLBAR */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors" title="Salir">
                <ArrowLeft className="w-6 h-6" />
             </button>
             <div className="flex flex-col">
               <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <LayoutDashboard className="w-5 h-5 text-blue-600" />
                 Dashboard
               </h1>
               <p className="text-xs font-semibold text-slate-400">CVDirecto Analytics</p>
             </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setIsHistoryModalOpen(true)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-md transition-all flex items-center gap-2">
                   <History className="w-3.5 h-3.5" /> Comparativa
                </button>
                <button onClick={handleOpenTimeline} className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-white shadow-sm rounded-md transition-all flex items-center gap-2">
                   <LineChart className="w-3.5 h-3.5" /> Histórico
                </button>
                <button onClick={startPresentation} className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white hover:shadow-sm rounded-md transition-all flex items-center gap-2 border border-emerald-100">
                   <MonitorPlay className="w-3.5 h-3.5" /> Presentar
                </button>
                <button onClick={handleOpenManage} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-md transition-all flex items-center gap-2">
                   <List className="w-3.5 h-3.5" /> Gestionar
                </button>
             </div>
             
             <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>

             <div className="flex gap-2">
               <button onClick={handleExportExcel} disabled={isExcelExporting || !dbConfigured} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50" title="Exportar Excel">
                 {isExcelExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
               </button>
               <button onClick={handleExportPDF} disabled={isExporting} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Descargar PDF">
                 {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
               </button>
               <button onClick={() => loadAllData(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Recargar">
                 <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
               </button>
             </div>
          </div>
        </div>
      </div>

      {!dbConfigured && (
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg flex items-center gap-3">
            <Database className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-semibold">Modo Demo: Base de datos no conectada.</span>
          </div>
        </div>
      )}

      {/* CONTENIDO REPORTABLE EN PANTALLA */}
      <div ref={reportRef} className="max-w-7xl mx-auto px-4 mt-8 space-y-8 bg-slate-50/50">
        
        {/* 2. TITLE & FILTER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-6 border-b border-slate-200">
           <div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Resultados Bimestrales</h2>
              <p className="text-slate-500 font-medium mt-1">Análisis de satisfacción y clima laboral.</p>
           </div>
           
           <div className="w-full md:w-auto relative">
              <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 block">Filtrar por Área</label>
              <div className="relative">
                 <select 
                   value={selectedArea} 
                   onChange={(e) => setSelectedArea(e.target.value)} 
                   className="w-full md:min-w-[300px] appearance-none bg-white border border-slate-300 hover:border-blue-400 text-slate-700 text-base font-bold rounded-xl py-3 pl-4 pr-10 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
                 >
                    <option value="GENERAL">🏢 Toda la Empresa</option>
                    <optgroup label="Áreas Operativas">
                       {AREAS_LIST.map(area => (<option key={area} value={area}>{area}</option>))}
                    </optgroup>
                 </select>
                 <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-5 h-5" />
              </div>
           </div>
        </div>

        {/* 3. KPI CARDS (REDESIGNED) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Card 1: Total */}
           <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <Users className="w-24 h-24 text-blue-600" />
              </div>
              <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                       <Users className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${countDiff < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                       {countDiff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                       {countLabel}
                    </span>
                 </div>
                 <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Encuestas Totales</p>
                 <p className="text-4xl font-black text-slate-900 mt-1">{currentStats.total}</p>
              </div>
           </div>

           {/* Card 2: Satisfaction */}
           <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <BarChart3 className="w-24 h-24 text-emerald-600" />
              </div>
              <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                       <BarChart3 className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${scoreDiff < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                       {scoreDiff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                       {scoreLabel}
                    </span>
                 </div>
                 <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Satisfacción Promedio</p>
                 <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-4xl font-black text-slate-900">{currentStats.avgScore.toFixed(1)}</p>
                    <span className="text-lg font-semibold text-slate-400">/10</span>
                 </div>
              </div>
           </div>

           {/* Card 3: Vulnerability */}
           <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <AlertCircle className="w-24 h-24 text-rose-600" />
              </div>
              <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-200">
                       <AlertCircle className="w-6 h-6" />
                    </div>
                 </div>
                 <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Reportes Vulnerabilidad</p>
                 <p className="text-4xl font-black text-slate-900 mt-1">{currentStats.vulnerabilityCount}</p>
                 <p className="text-xs text-rose-500 font-semibold mt-2">Atención prioritaria</p>
              </div>
           </div>
        </div>

        {/* 4. MAIN GRID - NOW ONLY COMMENTS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[400px] animate-fade-in">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-400" /> Comentarios
               </h3>
               <button 
                 onClick={() => setShowComments(!showComments)}
                 className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
               >
                 {showComments ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                 {showComments ? 'Ocultar' : 'Mostrar'}
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-grow bg-slate-50/30 relative">
               {!showComments ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <div className="bg-slate-100 p-4 rounded-full border border-slate-200">
                       <EyeOff className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-center max-w-xs">
                       <p className="font-bold text-slate-600 text-lg">Comentarios Ocultos por Privacidad</p>
                       <p className="text-sm mb-4">Los datos cualitativos están protegidos en la vista general.</p>
                       <button 
                         onClick={() => setShowComments(true)}
                         className="px-4 py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors"
                       >
                         Mostrar Comentarios
                       </button>
                    </div>
                 </div>
               ) : (
                  currentStats.comments.length > 0 ? (
                    <div className="space-y-4">
                       {currentStats.comments.map((comment, idx) => (
                          <div key={idx} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative animate-fade-in">
                             <div className="flex items-center gap-2 mb-3">
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                                   {comment.date ? new Date(comment.date).toLocaleDateString() : 'N/D'}
                                </span>
                             </div>
                             <p className="text-slate-600 text-sm leading-relaxed italic border-l-2 border-blue-200 pl-3">
                                "{comment.text}"
                             </p>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-center text-slate-300">
                       <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                       <p className="font-semibold text-slate-400">No hay comentarios reportados.</p>
                    </div>
                  )
               )}
            </div>
         </div>

        {/* 5. QUESTION BREAKDOWN */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-12">
           <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                 <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                 Desglose por Pregunta
              </h3>
              
              <div className="flex gap-3 text-xs font-bold">
                 <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-full border border-blue-100">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div> Siempre / Si
                 </div>
                 <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-100">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div> A veces
                 </div>
                 <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div> Nunca / No
                 </div>
              </div>
           </div>

           <div className="p-6 md:p-8">
              <div className="space-y-8">
                 {currentStats.questionsBreakdown.map((q) => (
                    <div key={q.id} className="relative">
                       <div className="flex items-baseline mb-3">
                          <span className="text-slate-300 font-black text-xl mr-3 w-8 text-right tabular-nums">{q.id}.</span>
                          <p className="text-slate-700 font-bold text-sm md:text-base leading-tight">{q.text}</p>
                       </div>
                       
                       <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex relative ml-11 md:w-[calc(100%-2.75rem)]">
                          {q.siempre > 0 && <div style={{ width: `${q.siempre}%` }} className="bg-blue-600 h-full"></div>}
                          {q.aVeces > 0 && <div style={{ width: `${q.aVeces}%` }} className="bg-amber-500 h-full"></div>}
                          {q.nunca > 0 && <div style={{ width: `${q.nunca}%` }} className="bg-slate-400 h-full"></div>}
                       </div>
                       
                       {/* ETIQUETAS ALINEADAS PROPORCIONALMENTE */}
                       <div className="flex w-full text-xs font-bold text-slate-400 mt-1 ml-11 md:w-[calc(100%-2.75rem)]">
                          {q.siempre > 0 && (
                            <div style={{ width: `${q.siempre}%` }} className="text-center text-blue-600 truncate px-1" title={`${q.siempre}% (${q.siempreCount})`}>
                               {q.siempre}% <span className="text-[10px] opacity-80">({q.siempreCount})</span>
                            </div>
                          )}
                          {q.aVeces > 0 && (
                            <div style={{ width: `${q.aVeces}%` }} className="text-center text-amber-600 truncate px-1" title={`${q.aVeces}% (${q.aVecesCount})`}>
                               {q.aVeces}% <span className="text-[10px] opacity-80">({q.aVecesCount})</span>
                            </div>
                          )}
                          {q.nunca > 0 && (
                            <div style={{ width: `${q.nunca}%` }} className="text-center text-slate-600 truncate px-1" title={`${q.nunca}% (${q.nuncaCount})`}>
                               {q.nunca}% <span className="text-[10px] opacity-80">({q.nuncaCount})</span>
                            </div>
                          )}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

      </div>

      {/* ===================================================================================== */}
      {/* 6. HIDDEN PRINT TEMPLATE (SOLO VISIBLE INTERNAMENTE PARA HTML2CANVAS)                  */}
      {/* ===================================================================================== */}
      <div 
        ref={pdfExportRef} 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: '-9999px', 
          width: '1000px', 
          zIndex: -50,
          backgroundColor: '#ffffff'
        }}
      >
         <div className="bg-white p-12 w-full text-slate-900 font-sans">
            
            {/* PDF Header - Diseño IDÉNTICO a App.tsx */}
            <div className="flex items-center justify-between border-b border-slate-300 pb-4 mb-8">
               <div className="flex items-center gap-3">
                  <div className="bg-blue-800 text-white p-2 rounded-lg">
                     <Building2 className="w-8 h-8" />
                  </div>
                  <div>
                     <h1 className="text-2xl font-extrabold text-slate-800 leading-none">CVDirecto</h1>
                     <span className="text-sm text-slate-500 font-bold">Portal de Colaboradores</span>
                  </div>
               </div>
               
               <div className="flex flex-col items-end">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 flex items-center gap-2 mb-2">
                     <Lock className="w-4 h-4 text-emerald-700" />
                     <span className="text-sm font-bold text-emerald-800 uppercase">Reporte Confidencial</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">
                     {selectedArea === 'GENERAL' ? 'Toda la Empresa' : selectedArea}
                  </p>
               </div>
            </div>

            {/* PDF Summary Cards */}
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-slate-300 pl-3">Métricas Clave</h2>
            <div className="grid grid-cols-3 gap-6 mb-12">
               <div className="bg-slate-50 p-6 rounded border border-slate-200">
                  <p className="text-slate-500 font-bold uppercase text-xs">Total Encuestas</p>
                  <p className="text-5xl font-black text-slate-900 mt-2">{currentStats.total}</p>
               </div>
               <div className="bg-slate-50 p-6 rounded border border-slate-200">
                  <p className="text-slate-500 font-bold uppercase text-xs">Satisfacción Promedio</p>
                  <div className="flex items-baseline gap-1 mt-2">
                     <p className="text-5xl font-black text-slate-900">{currentStats.avgScore.toFixed(1)}</p>
                     <span className="text-xl text-slate-400 font-bold">/10</span>
                  </div>
               </div>
               <div className="bg-slate-50 p-6 rounded border border-slate-200">
                  <p className="text-slate-500 font-bold uppercase text-xs">Reportes de Riesgo</p>
                  <p className={`text-5xl font-black mt-2 ${currentStats.vulnerabilityCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                     {currentStats.vulnerabilityCount}
                  </p>
               </div>
            </div>

            {/* MOOD DISTRIBUTION REMOVED FROM PDF */}

            {/* PDF Questions */}
            <div className="mb-12">
               <h2 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-emerald-600 pl-3">Desglose de Factores</h2>
               <div className="border border-slate-200 rounded overflow-hidden">
                  <div className="bg-slate-100 p-3 flex text-xs font-bold text-slate-500 uppercase">
                     <div className="w-10">ID</div>
                     <div className="flex-grow">Pregunta</div>
                     <div className="w-24 text-center text-blue-700">Siempre</div>
                     <div className="w-24 text-center text-amber-600">A veces</div>
                     <div className="w-24 text-center text-slate-600">Nunca</div>
                  </div>
                  {currentStats.questionsBreakdown.map((q, idx) => (
                     <div key={q.id} className={`p-3 flex items-center border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <div className="w-10 font-bold text-slate-400">{q.id}</div>
                        <div className="flex-grow pr-4 text-sm font-semibold text-slate-800">{q.text}</div>
                        <div className="w-24 text-center font-bold text-blue-700 text-xs">{q.siempre}% <span className="opacity-60 text-[10px]">({q.siempreCount})</span></div>
                        <div className="w-24 text-center font-bold text-amber-600 text-xs">{q.aVeces}% <span className="opacity-60 text-[10px]">({q.aVecesCount})</span></div>
                        <div className="w-24 text-center font-bold text-slate-500 text-xs">{q.nunca}% <span className="opacity-60 text-[10px]">({q.nuncaCount})</span></div>
                     </div>
                  ))}
               </div>
            </div>

            {/* PDF Ranking (Only if General) */}
            {selectedArea === 'GENERAL' && (
              <div className="mb-12 break-inside-avoid">
                 <h2 className="text-xl font-bold text-slate-800 mb-4 border-l-4 border-yellow-500 pl-3">Ranking de Áreas</h2>
                 <div className="grid grid-cols-2 gap-4">
                    {areaRanking.slice(0, 10).map((item, index) => (
                       <div key={item.name} className="flex justify-between items-center border border-slate-200 p-3 rounded bg-white">
                          <div className="flex items-center gap-3">
                             <span className="font-black text-slate-300 text-lg">#{index + 1}</span>
                             <span className="font-bold text-slate-700">{item.name}</span>
                          </div>
                          <span className="font-black text-slate-900 bg-slate-100 px-2 py-1 rounded">{item.score.toFixed(1)}</span>
                       </div>
                    ))}
                 </div>
              </div>
            )}

            {/* Footer Institucional - Diseño IDÉNTICO a App.tsx */}
            <div className="mt-12 pt-8 border-t border-slate-300 bg-slate-100 -mx-12 -mb-12 p-8 text-center">
               <div className="flex justify-center items-center gap-2 text-slate-600 font-bold mb-2">
                  <ShieldCheck className="w-5 h-5 text-blue-800" />
                  <span>Documento Oficial - Uso Interno Exclusivo</span>
               </div>
               <p className="text-slate-400 text-xs">Generado el {new Date().toLocaleDateString()} • CVDirecto Analytics</p>
            </div>

         </div>
      </div>


      {/* ================= MODALS (PRESERVED) ================= */}

      {/* MODAL TIMELINE CHART - Z-Index 60 */}
      {isTimelineModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col border border-slate-200">
             
             {/* Header Modal Timeline */}
             <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
               <div>
                 <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                   <LineChart className="w-6 h-6 text-blue-700" /> Histórico Evolutivo
                 </h3>
                 <p className="text-slate-500 text-sm mt-1">Comparativa de cierres globales a través del tiempo.</p>
               </div>
               <div className="flex gap-2">
                 <button 
                  onClick={handleArchiveTimeline}
                  disabled={isTimelineSnapshotLoading}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                   {isTimelineSnapshotLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                   Archivar Estado Actual
                 </button>
                 <button onClick={() => setIsTimelineModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                 </button>
               </div>
             </div>

             {/* Chart Body */}
             <div className="p-8 flex-grow flex items-end justify-center bg-white overflow-x-auto">
               {loadingTimeline ? (
                 <div className="flex flex-col items-center justify-center w-full h-full">
                   <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                   <p className="text-slate-500">Cargando gráfica...</p>
                 </div>
               ) : timelineData.length === 0 ? (
                 <div className="flex flex-col items-center justify-center w-full h-full text-center">
                    <div className="bg-slate-50 p-6 rounded-full mb-4"><LineChart className="w-12 h-12 text-slate-300" /></div>
                    <p className="text-lg font-bold text-slate-600">Aún no hay historial archivado</p>
                    <p className="text-slate-400 mb-6">Haz clic en "Archivar Estado Actual" para guardar tu primer punto en la gráfica.</p>
                 </div>
               ) : (
                 <div className="w-full h-full flex flex-col">
                   <div className="flex-grow flex items-end justify-around gap-4 pb-12 pt-10 border-b-2 border-slate-200 relative px-4 min-w-[600px]">
                      {/* Grid Lines Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-12">
                         {[100, 75, 50, 25, 0].map(val => (
                           <div key={val} className="w-full border-t border-dashed border-slate-100 relative h-0">
                             <span className="absolute -left-8 -top-3 text-xs font-bold text-slate-300">{val}%</span>
                           </div>
                         ))}
                      </div>

                      {/* Bars */}
                      {timelineData.map((point, idx) => (
                        <div key={idx} className="flex flex-col items-center group relative h-full justify-end w-24">
                          
                          {/* Tooltip */}
                          <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[calc(100%+10px)] bg-slate-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none w-32 text-center z-10">
                            <p className="font-bold">{point.displayDate}</p>
                            <p>Promedio: {point.score.toFixed(1)}%</p>
                            <p>Áreas: {point.count}</p>
                          </div>

                          {/* Value Label */}
                          <span className="mb-1 text-sm font-bold text-blue-700">{point.score.toFixed(0)}%</span>
                          
                          {/* Bar - Color determined by isRef flag, not text label */}
                          <div 
                            className={`w-12 rounded-t-lg shadow-lg hover:brightness-110 transition-all relative overflow-hidden ${point.isRef ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ height: `${point.score}%` }}
                          >
                             <div className="absolute top-0 left-0 w-full h-1 bg-white/20"></div>
                          </div>
                          
                          {/* Date Label (X-Axis) - Cleaner simple label */}
                          <div className="absolute top-[100%] pt-4 flex flex-col items-center">
                             <span className="text-xs font-bold text-slate-600 rotate-0 whitespace-nowrap text-center max-w-[120px] overflow-hidden text-ellipsis">
                               {point.displayDate}
                             </span>
                             {point.isRef && (
                               <span className="text-[10px] text-emerald-600 font-semibold">(Referencia)</span>
                             )}
                          </div>
                        </div>
                      ))}
                   </div>
                   <p className="text-center text-slate-400 text-xs mt-8">Evolución del promedio de satisfacción global (0-100%)</p>
                 </div>
               )}
             </div>
           </div>
        </div>
      )}

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
            <div className="p-6 overflow-y-auto custom-scrollbar flex-grow bg-slate-50">
               
               {/* NUEVO INPUT PARA LABEL DEL PERIODO */}
               <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <label className="block text-sm font-bold text-blue-800 mb-2">
                    Etiqueta del Periodo Anterior (Ej. Enero - Febrero 2024)
                  </label>
                  <input 
                    type="text" 
                    value={historyPeriodLabel}
                    onChange={(e) => setHistoryPeriodLabel(e.target.value)}
                    placeholder="Ingresa el nombre del bimestre o mes..."
                    className="w-full border border-blue-200 rounded-lg p-3 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
                  />
                  <p className="text-xs text-blue-600 mt-2">
                    Esta etiqueta aparecerá en la gráfica de historial para identificar este periodo.
                  </p>
               </div>

               <div className="grid grid-cols-1 gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                 <div className="flex items-center pb-2 border-b border-slate-100 text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">
                    <span className="w-1/3">Área</span>
                    <span className="w-1/3">Satisfacción (%)</span>
                    <span className="w-1/3">Participantes</span>
                 </div>
                 {AREAS_LIST.map(area => (
                   <div key={area} className="flex flex-col md:flex-row md:items-center gap-4">
                     <label className="text-sm font-bold text-slate-700 w-full md:w-1/3">{area}</label>
                     <div className="flex gap-4 w-full md:w-2/3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input type="number" min="0" max="100" value={historicalData[area]?.score || ""} onChange={(e) => handleHistoryChange(area, 'score', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-center" placeholder="0" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input type="number" min="0" value={historicalData[area]?.count || ""} onChange={(e) => handleHistoryChange(area, 'count', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-center" placeholder="0" />
                          </div>
                        </div>
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

      {/* ================= PRESENTATION MODE OVERLAY ================= */}
      {isPresentationOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fade-in">
          
          {/* HEADER BAR (Glassmorphism & Structure) */}
          <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 relative z-20 shadow-sm flex-shrink-0">
             {/* Left: Filter */}
             <div className="relative group min-w-[280px]">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                   <Filter className="w-4 h-4" />
                </div>
                <select 
                   value={selectedArea} 
                   onChange={(e) => setSelectedArea(e.target.value)} 
                   className="w-full appearance-none bg-slate-100 hover:bg-white border border-slate-200 hover:border-blue-300 text-slate-700 font-bold py-2.5 pl-10 pr-10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all text-xs uppercase tracking-wide"
                >
                   <option value="GENERAL">🏢 Toda la Empresa</option>
                   <optgroup label="Áreas Operativas">
                      {AREAS_LIST.map(area => (<option key={area} value={area}>{area}</option>))}
                   </optgroup>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
             </div>

             {/* Right: Controls */}
             <div className="flex items-center gap-4">
                <div className="bg-slate-100 px-4 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-200">
                   Diapositiva {currentSlide + 1} de {presentationSlides.length}
                </div>
                <div className="h-6 w-px bg-slate-300"></div>
                <button 
                   onClick={() => setIsPresentationOpen(false)}
                   className="p-2 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors border border-slate-200 shadow-sm"
                   title="Salir (ESC)"
                >
                   <X className="w-5 h-5" />
                </button>
             </div>
          </div>

          {/* Slide Content Container */}
          <div className="flex-grow flex items-center justify-center p-4 md:p-8 overflow-hidden relative bg-slate-50/50">
             
             {/* WRAPPER FOR SLIDE ANIMATION - Key triggers animation reset */}
             <div key={currentSlide} className="w-full h-full flex items-center justify-center animate-slide-up">
            
            {/* Slide 0: Portada */}
            {currentSlide === 0 && (
              <div className="text-center max-w-4xl">
                 <div className="inline-block p-6 rounded-3xl bg-blue-50 mb-6 shadow-inner animate-scale-in">
                    <LayoutDashboard className="w-20 h-20 text-blue-800" />
                 </div>
                 <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">Reporte de Resultados</h1>
                 <h2 className="text-3xl font-bold text-blue-700 mb-8">{selectedArea === 'GENERAL' ? 'Toda la Empresa' : selectedArea}</h2>
                 
                 <div className="grid grid-cols-2 gap-8 text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-lg mx-auto max-w-xl">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de corte</p>
                      <p className="text-xl font-bold text-slate-800">{new Date().toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total de Encuestas</p>
                      <p className="text-xl font-bold text-slate-800">{currentStats.total}</p>
                    </div>
                 </div>
              </div>
            )}

            {/* Slide 1: Resumen Ejecutivo (KPIs) */}
            {currentSlide === 1 && (
              <div className="w-full max-w-5xl">
                 <h2 className="text-3xl font-black text-slate-800 mb-8 border-l-8 border-blue-600 pl-4">Resumen Ejecutivo</h2>
                 <div className="grid grid-cols-3 gap-6">
                    <div className="bg-blue-50 rounded-2xl p-6 shadow-lg border border-blue-100 flex flex-col justify-between h-64">
                       <div className="flex justify-between items-start">
                          <Users className="w-12 h-12 text-blue-600" />
                          <span className={`text-sm font-bold px-3 py-1 rounded-full ${countDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                             {countLabel}
                          </span>
                       </div>
                       <div>
                          <p className="text-lg font-bold text-blue-800 uppercase mb-1 opacity-70">Total Encuestas</p>
                          <p className="text-6xl font-black text-slate-900">{currentStats.total}</p>
                       </div>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-6 shadow-lg border border-emerald-100 flex flex-col justify-between h-64">
                       <div className="flex justify-between items-start">
                          <BarChart3 className="w-12 h-12 text-emerald-600" />
                          <span className={`text-sm font-bold px-3 py-1 rounded-full ${scoreDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                             {scoreLabel}
                          </span>
                       </div>
                       <div>
                          <p className="text-lg font-bold text-emerald-800 uppercase mb-1 opacity-70">Satisfacción</p>
                          <div className="flex items-baseline gap-2">
                             <p className="text-6xl font-black text-slate-900">{currentStats.avgScore.toFixed(1)}</p>
                             <span className="text-2xl font-bold text-slate-400">/10</span>
                          </div>
                       </div>
                    </div>

                    <div className="bg-rose-50 rounded-2xl p-6 shadow-lg border border-rose-100 flex flex-col justify-between h-64">
                       <div className="flex justify-between items-start">
                          <AlertCircle className="w-12 h-12 text-rose-600" />
                          {currentStats.vulnerabilityCount > 0 && <span className="bg-rose-600 text-white font-bold px-3 py-1 rounded-full text-xs animate-pulse">Atención</span>}
                       </div>
                       <div>
                          <p className="text-lg font-bold text-rose-800 uppercase mb-1 opacity-70">Vulnerabilidad</p>
                          <p className="text-6xl font-black text-slate-900">{currentStats.vulnerabilityCount}</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {/* Slide 2: Preguntas Parte 1 (Was Slide 3) */}
            {currentSlide === 2 && (
               <div className="w-full max-w-6xl h-full flex flex-col">
                  <div className="w-full mb-2 flex justify-between items-end border-b border-slate-200 pb-2 flex-shrink-0">
                     <div>
                       <h2 className="text-2xl font-black text-slate-800 mb-1 border-l-8 border-emerald-500 pl-3">Factores de Riesgo (1/2)</h2>
                     </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center gap-2 overflow-hidden">
                     {currentStats.questionsBreakdown.slice(0, 7).map(q => (
                        <div key={q.id} className="bg-white border border-slate-100 py-2 px-4 rounded-lg shadow-sm flex items-center gap-4">
                           {/* Left Column: ID + Text (60% width) */}
                           <div className="flex items-start gap-3 flex-1">
                              <span className="text-lg font-black text-slate-400 min-w-[1.4rem]">{q.id}.</span>
                              <p className="text-base font-bold text-slate-800 leading-tight">{q.text}</p>
                           </div>

                           {/* Right Column: Visuals (40% width) */}
                           <div className="w-[40%] flex flex-col justify-center">
                              {/* Bar */}
                              <div className="w-full h-3 flex rounded-full overflow-hidden bg-slate-100 mb-1 border border-slate-200">
                                 {q.siempre > 0 && <div style={{ width: `${q.siempre}%` }} className="bg-blue-600 h-full transition-all duration-1000 ease-out"></div>}
                                 {q.aVeces > 0 && <div style={{ width: `${q.aVeces}%` }} className="bg-amber-500 h-full transition-all duration-1000 ease-out"></div>}
                                 {q.nunca > 0 && <div style={{ width: `${q.nunca}%` }} className="bg-slate-400 h-full transition-all duration-1000 ease-out"></div>}
                              </div>

                              {/* Compact Stats Line */}
                              <div className="flex justify-end gap-3 text-xs font-bold">
                                 {q.siempreCount >= 0 && (
                                    <span className="text-blue-700">Siempre: {q.siempre}%</span>
                                 )}
                                 {q.aVecesCount >= 0 && (
                                    <span className="text-amber-700">A veces: {q.aVeces}%</span>
                                 )}
                                 {q.nuncaCount >= 0 && (
                                    <span className="text-slate-600">Nunca: {q.nunca}%</span>
                                 )}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* Slide 3: Preguntas Parte 2 (Was Slide 4) */}
            {currentSlide === 3 && (
               <div className="w-full max-w-6xl h-full flex flex-col">
                  <div className="w-full mb-2 flex justify-between items-end border-b border-slate-200 pb-2 flex-shrink-0">
                     <div>
                       <h2 className="text-2xl font-black text-slate-800 mb-1 border-l-8 border-emerald-500 pl-3">Factores de Riesgo (2/2)</h2>
                     </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center gap-2 overflow-hidden">
                     {currentStats.questionsBreakdown.slice(7, 14).map(q => (
                        <div key={q.id} className="bg-white border border-slate-100 py-2 px-4 rounded-lg shadow-sm flex items-center gap-4">
                           {/* Left Column: ID + Text (60% width) */}
                           <div className="flex items-start gap-3 flex-1">
                              <span className="text-lg font-black text-slate-400 min-w-[1.4rem]">{q.id}.</span>
                              <p className="text-base font-bold text-slate-800 leading-tight">{q.text}</p>
                           </div>

                           {/* Right Column: Visuals (40% width) */}
                           <div className="w-[40%] flex flex-col justify-center">
                              {/* Bar */}
                              <div className="w-full h-3 flex rounded-full overflow-hidden bg-slate-100 mb-1 border border-slate-200">
                                 {q.siempre > 0 && <div style={{ width: `${q.siempre}%` }} className="bg-blue-600 h-full transition-all duration-1000 ease-out"></div>}
                                 {q.aVeces > 0 && <div style={{ width: `${q.aVeces}%` }} className="bg-amber-500 h-full transition-all duration-1000 ease-out"></div>}
                                 {q.nunca > 0 && <div style={{ width: `${q.nunca}%` }} className="bg-slate-400 h-full transition-all duration-1000 ease-out"></div>}
                              </div>

                              {/* Compact Stats Line */}
                              <div className="flex justify-end gap-3 text-xs font-bold">
                                 {q.siempreCount >= 0 && (
                                    <span className="text-blue-700">Siempre: {q.siempre}%</span>
                                 )}
                                 {q.aVecesCount >= 0 && (
                                    <span className="text-amber-700">A veces: {q.aVeces}%</span>
                                 )}
                                 {q.nuncaCount >= 0 && (
                                    <span className="text-slate-600">Nunca: {q.nunca}%</span>
                                 )}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* Slide 4: Ranking de Áreas (Was Slide 5) */}
            {currentSlide === 4 && (
               <div className="w-full max-w-6xl flex flex-col h-full max-h-full">
                   <h2 className="text-3xl font-black text-slate-800 mb-6 border-l-8 border-yellow-500 pl-4 flex items-center gap-3 flex-shrink-0">
                      Ranking Global por Áreas 
                      <Trophy className="w-8 h-8 text-yellow-500" />
                   </h2>
                   
                   <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        {areaRanking.length === 0 ? (
                           <div className="col-span-2 flex flex-col items-center justify-center py-20 text-slate-400">
                              <Trophy className="w-20 h-20 mb-4 opacity-20" />
                              <p className="text-xl font-bold">No hay suficientes datos para generar el ranking.</p>
                           </div>
                        ) : (
                           areaRanking.map((item, index) => {
                              // Highlight Selected Area
                              const isSelected = item.name === selectedArea;

                              // Colores para los primeros 3 lugares
                              let rankColor = "bg-slate-100 border-slate-200 text-slate-600";
                              let barColor = "bg-slate-400";
                              let icon = null;

                              if (index === 0) {
                                 rankColor = "bg-yellow-50 border-yellow-200 text-yellow-700 ring-2 ring-yellow-100";
                                 barColor = "bg-yellow-500";
                                 icon = <Medal className="w-5 h-5 text-yellow-500" />;
                              } else if (index === 1) {
                                 rankColor = "bg-slate-50 border-slate-300 text-slate-700";
                                 barColor = "bg-slate-500";
                                 icon = <Medal className="w-5 h-5 text-slate-400" />;
                              } else if (index === 2) {
                                 rankColor = "bg-orange-50 border-orange-200 text-orange-800";
                                 barColor = "bg-orange-500";
                                 icon = <Medal className="w-5 h-5 text-orange-600" />;
                              }
                              
                              // Override if selected to highlight
                              if (isSelected) {
                                 rankColor = "bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500 shadow-md transform scale-[1.01]";
                                 if (index > 2) barColor = "bg-blue-600";
                              }

                              return (
                                 <div key={item.name} className={`p-3 rounded-lg border flex items-center gap-3 shadow-sm transition-all duration-300 ${rankColor}`}>
                                    <div className="w-8 h-8 flex items-center justify-center font-black text-xl opacity-50">
                                       #{index + 1}
                                    </div>
                                    <div className="flex-grow">
                                       <div className="flex justify-between items-end mb-1">
                                          <h4 className="font-bold text-base leading-none flex items-center gap-2">
                                             {item.name}
                                             {isSelected && <span className="text-[10px] bg-blue-600 text-white px-1.5 rounded-full uppercase tracking-wider">Tú</span>}
                                          </h4>
                                          {icon}
                                       </div>
                                       <div className="w-full bg-white/50 rounded-full h-3 overflow-hidden">
                                          <div className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${(item.score * 10)}%` }}></div>
                                       </div>
                                    </div>
                                    <div className="text-right min-w-[60px]">
                                       <div className="text-2xl font-black">{item.score.toFixed(1)}</div>
                                       <div className="text-[10px] font-bold opacity-60 uppercase">Puntos</div>
                                    </div>
                                 </div>
                              );
                           })
                        )}
                      </div>
                   </div>
               </div>
            )}
            
             </div> {/* End Animated Wrapper */}
          </div>

          {/* Navigation Controls Footer */}
          <div className="h-16 border-t border-slate-200 bg-white flex items-center justify-between px-8 relative z-20 flex-shrink-0">
             <div className="text-slate-400 font-bold text-xs">
                CVDirecto Analytics
             </div>
             
             <div className="flex gap-4">
                <button 
                  onClick={prevSlide}
                  disabled={currentSlide === 0}
                  className="p-2 rounded-full bg-slate-50 border border-slate-200 shadow hover:bg-slate-100 disabled:opacity-30 transition-all"
                >
                   <ChevronLeft className="w-5 h-5 text-slate-700" />
                </button>
                <button 
                  onClick={nextSlide}
                  disabled={currentSlide === presentationSlides.length - 1}
                  className="p-2 rounded-full bg-blue-600 border border-blue-700 shadow hover:bg-blue-700 disabled:opacity-30 transition-all"
                >
                   <ChevronRight className="w-5 h-5 text-white" />
                </button>
             </div>

             <div className="absolute bottom-0 left-0 h-1 bg-blue-600 transition-all duration-500" style={{ width: `${((currentSlide + 1) / presentationSlides.length) * 100}%` }}></div>
          </div>

        </div>
      )}

    </div>
  );
};

export default ResultsView;
