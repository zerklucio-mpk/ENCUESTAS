import React from 'react';
import { Frequency, SurveyData, SURVEY_QUESTIONS } from '../types';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface LikertSectionProps {
  data: SurveyData;
  onUpdate: (questionId: number, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const LikertSection: React.FC<LikertSectionProps> = ({ data, onUpdate, onNext, onBack }) => {
  const answeredCount = Object.keys(data.answers).length;
  const totalQuestions = SURVEY_QUESTIONS.length;
  const isComplete = answeredCount === totalQuestions;

  // Opciones estándar para preguntas 1-13
  const optionsStandard = [
    { label: Frequency.SIEMPRE, activeClass: 'bg-blue-800 text-white border-blue-800' },
    { label: Frequency.A_VECES, activeClass: 'bg-amber-600 text-white border-amber-600' },
    { label: Frequency.NUNCA, activeClass: 'bg-slate-600 text-white border-slate-600' },
  ];

  // Opciones especiales para pregunta 14 (Cambios)
  const optionsSpecial = [
    { label: "Si", activeClass: 'bg-blue-800 text-white border-blue-800' },
    { label: "N/A", activeClass: 'bg-amber-600 text-white border-amber-600' },
    { label: "No", activeClass: 'bg-slate-600 text-white border-slate-600' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-28">
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Cuestionario de Satisfacción</h2>
        <p className="text-blue-800 text-lg">Por favor, responda todas las preguntas para poder continuar.</p>
      </div>

      <div className="space-y-8">
        {SURVEY_QUESTIONS.map((q) => {
          const answer = data.answers[q.id];
          const isAnswered = answer !== undefined;
          
          // Detectar si es la pregunta especial (14)
          const isSpecialQuestion = q.id === 14;
          const currentOptions = isSpecialQuestion ? optionsSpecial : optionsStandard;
          
          return (
            <div 
              key={q.id} 
              className={`
                bg-white p-6 md:p-8 rounded-lg border-2 transition-all duration-300 shadow-sm
                ${isAnswered ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200'}
              `}
            >
              <div className="flex items-start gap-4 mb-6">
                 <span className={`
                    flex-shrink-0 font-extrabold w-10 h-10 flex items-center justify-center rounded-full text-lg border-2
                    ${isAnswered ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}
                 `}>
                   {q.id}
                 </span>
                 <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-snug">
                  {q.text}
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-0 sm:pl-14">
                {currentOptions.map((opt) => {
                   const isActive = answer === opt.label;
                   return (
                    <button
                      key={opt.label}
                      onClick={() => onUpdate(q.id, opt.label)}
                      className={`
                        py-4 px-4 rounded-lg text-lg font-bold border-2 transition-all duration-150 flex items-center justify-center gap-2 relative
                        ${isActive
                          ? `${opt.activeClass} shadow-md`
                          : `bg-white hover:bg-slate-100 border-slate-300 text-slate-600`
                        }
                      `}
                    >
                       {isActive && <CheckCircle2 className="w-5 h-5 absolute left-4" />}
                       {opt.label}
                    </button>
                   );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Fijo para navegación segura */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
           <button
              onClick={onBack}
              className="px-6 py-3 rounded-lg font-bold text-slate-700 border-2 border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Anterior
            </button>
            
            <div className="text-base font-bold text-slate-600 hidden sm:block">
              {answeredCount} / {totalQuestions} Completadas
            </div>

            <button
              onClick={onNext}
              disabled={!isComplete}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-all flex items-center gap-2 ${
                isComplete 
                  ? 'bg-blue-800 text-white hover:bg-blue-900 shadow-lg' 
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              Siguiente <ArrowRight className="w-5 h-5" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default LikertSection;