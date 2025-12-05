
import React, { useState, useEffect } from 'react';
import { SurveyData, Frequency } from './types';
import { generateClosingMessage } from './services/geminiService';
import { saveSurveyToDb } from './services/dbService'; 
import IntroSection from './components/IntroSection';
import MoodSection from './components/MoodSection';
import LikertSection from './components/LikertSection';
import OpenEndedSection from './components/OpenEndedSection';
import SuccessView from './components/SuccessView';
import ResultsView from './components/ResultsView';
import ProgressBar from './components/ProgressBar';
import { ShieldCheck, Lock, Building2, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';

const getInitialData = (): SurveyData => ({
  date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
  area: "",
  mood: "",
  answers: {},
  vulnerabilityText: ""
});

enum Step {
  INTRO = 0,
  MOOD = 1,
  QUESTIONS = 2,
  OPEN_ENDED = 3,
  SUCCESS = 4,
  RESULTS = 99 // Nuevo paso para la vista de admin
}

// Credencial de acceso administrativo
const ADMIN_ACCESS_KEY = "CVD_2104_.!.!.pmc";

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.INTRO);
  const [formData, setFormData] = useState<SurveyData>(getInitialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  
  // Estado para manejar el triple clic secreto
  const [secretClickCount, setSecretClickCount] = useState(0);

  // Estados de autenticación para el panel de resultados
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(false);

  // Efecto para resetear el contador de clics si pasan más de 1 segundo
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (secretClickCount > 0) {
      timer = setTimeout(() => {
        setSecretClickCount(0);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [secretClickCount]);

  const handleSecretAccess = () => {
    const newCount = secretClickCount + 1;
    setSecretClickCount(newCount);
    
    // Si llega a 3 clics rápidos, activa el modo resultados (que ahora pedirá clave)
    if (newCount === 3) {
      setStep(Step.RESULTS);
      setSecretClickCount(0);
    }
  };

  const handleAuthLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_ACCESS_KEY) {
      setIsAuthenticated(true);
      setAuthError(false);
      setPasswordInput(""); // Limpiar input por seguridad
    } else {
      setAuthError(true);
      // Pequeña vibración visual o feedback
      const input = document.getElementById('admin-pass-input');
      if (input) {
        input.classList.add('ring-red-500', 'ring-2');
        setTimeout(() => input.classList.remove('ring-red-500', 'ring-2'), 500);
      }
    }
  };

  const cancelAuth = () => {
    setStep(Step.INTRO);
    setAuthError(false);
    setPasswordInput("");
    setIsAuthenticated(false);
  };

  const handleUpdate = (field: keyof SurveyData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAnswerUpdate = (questionId: number, value: Frequency) => {
    setFormData(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: value }
    }));
  };

  const handleNext = () => {
    setStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Guardar en Base de Datos Supabase
      const success = await saveSurveyToDb(formData);
      
      if (!success) {
        alert("Hubo un problema de conexión al guardar sus respuestas. Por favor intente nuevamente.");
        setIsSubmitting(false);
        return;
      }

      // 2. Generar mensaje motivacional
      const message = await generateClosingMessage(formData.vulnerabilityText, formData.mood as string);
      setAiMessage(message);
      
      // 3. Cambiar vista
      setStep(Step.SUCCESS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error) {
      console.error("Submission error", error);
      alert("Hubo un error crítico. Por favor notifique al administrador.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(getInitialData());
    setStep(Step.INTRO);
    setAiMessage("");
    // Importante: Resetear autenticación al salir del panel
    setIsAuthenticated(false);
    setPasswordInput("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalSteps = 4;
  
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      {/* Header Institucional y Seguro */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md border-b border-slate-300 h-20 flex items-center">
        <div className="max-w-4xl mx-auto px-4 w-full flex items-center justify-between">
          
          <button 
            onClick={handleSecretAccess}
            className="flex items-center gap-3 focus:outline-none group"
            title="Portal Corporativo"
          >
            <div className="bg-blue-800 text-white p-2 rounded-lg shadow-sm group-active:scale-95 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex flex-col items-start">
              <h1 className="font-extrabold text-slate-800 text-xl leading-none tracking-tight select-none">CVDirecto</h1>
              <span className="text-sm text-slate-500 font-semibold mt-0.5 select-none">Portal de Colaboradores</span>
            </div>
          </button>
          
          <div className="bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span className="text-xs md:text-sm font-bold text-emerald-800 uppercase tracking-wide">Encuesta Anónima</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 pt-28 pb-12">
        {(step !== Step.SUCCESS && step !== Step.RESULTS) && (
          <div className="mb-8">
             <ProgressBar current={step + 1} total={totalSteps} />
          </div>
        )}

        <div className="transition-all duration-300 ease-in-out">
          {step === Step.INTRO && (
            <IntroSection 
              data={formData} 
              onUpdate={handleUpdate} 
              onNext={handleNext} 
            />
          )}

          {step === Step.MOOD && (
            <MoodSection 
              data={formData} 
              onUpdate={handleUpdate} 
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {step === Step.QUESTIONS && (
            <LikertSection 
              data={formData} 
              onUpdate={handleAnswerUpdate} 
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {step === Step.OPEN_ENDED && (
            <OpenEndedSection 
              data={formData}
              onUpdate={(val) => handleUpdate('vulnerabilityText', val)}
              onSubmit={handleSubmit}
              onBack={handleBack}
              isSubmitting={isSubmitting}
            />
          )}

          {step === Step.SUCCESS && (
            <SuccessView 
              aiMessage={aiMessage} 
              onReset={handleReset} 
            />
          )}

          {/* LOGIC PARA VISTA DE RESULTADOS CON AUTENTICACIÓN */}
          {step === Step.RESULTS && (
            isAuthenticated ? (
              <ResultsView onBack={handleReset} />
            ) : (
              <div className="animate-fade-in flex flex-col items-center justify-center pt-10">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-blue-800"></div>
                  
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 border border-blue-100">
                      <KeyRound className="w-10 h-10 text-blue-700" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800">Acceso Restringido</h2>
                    <p className="text-slate-500 text-sm mt-2">
                      Esta sección contiene información sensible de la empresa. Ingrese sus credenciales.
                    </p>
                  </div>

                  <form onSubmit={handleAuthLogin} className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Clave de Acceso</label>
                      <input 
                        id="admin-pass-input"
                        type="password" 
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          if(authError) setAuthError(false);
                        }}
                        className={`w-full px-4 py-3 rounded-lg border-2 font-bold text-slate-800 outline-none transition-all ${
                          authError 
                            ? 'border-red-300 bg-red-50 focus:border-red-500' 
                            : 'border-slate-300 bg-slate-50 focus:border-blue-500 focus:bg-white'
                        }`}
                        placeholder="••••••••••••••"
                        autoFocus
                      />
                      {authError && (
                        <div className="flex items-center gap-2 mt-2 text-red-600 animate-fade-in">
                           <AlertCircle className="w-4 h-4" />
                           <span className="text-xs font-bold">Credenciales incorrectas.</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        type="button" 
                        onClick={cancelAuth}
                        className="flex-1 py-3 px-4 rounded-lg font-bold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" /> Regresar
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 py-3 px-4 rounded-lg font-bold text-white bg-blue-800 hover:bg-blue-900 shadow-md transition-all hover:shadow-lg transform active:scale-95"
                      >
                        Verificar
                      </button>
                    </div>
                  </form>
                </div>
                <p className="text-slate-400 text-xs mt-6 font-semibold">
                  CVDirecto Security Check • Portal Administrativo
                </p>
              </div>
            )
          )}
        </div>
      </main>

      {/* Footer Legal/Confianza */}
      <footer className="py-8 bg-slate-200 border-t border-slate-300 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 mb-2 text-slate-600 font-bold">
            <ShieldCheck className="w-5 h-5 text-blue-800" />
            <span>Sus respuestas están protegidas y encriptadas.</span>
          </div>
          <p className="text-slate-500 text-sm">© {new Date().getFullYear()} CVDirecto. Proyectos y Mejora Continua.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
