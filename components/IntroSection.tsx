import React from 'react';
import { Area, SurveyData } from '../types';
import { Calendar, CheckCircle2, ArrowRight, User } from 'lucide-react';

interface IntroSectionProps {
  data: SurveyData;
  onUpdate: (field: keyof SurveyData, value: any) => void;
  onNext: () => void;
}

// Optimization: Define static data outside component to prevent re-creation on every render
const AREAS_LIST = Object.values(Area).sort();

const IntroSection: React.FC<IntroSectionProps> = ({ data, onUpdate, onNext }) => {
  const isFormValid = data.area !== "";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Tarjeta de Bienvenida - Diseño 'Carta' Institucional */}
      <div className="bg-white rounded-lg shadow-md border-l-8 border-blue-800 p-6 md:p-8">
        <h2 className="text-2xl font-extrabold text-slate-800 mb-3">Bienvenido/a a la Encuesta Bimestral</h2>
        <div className="text-lg text-slate-700 leading-relaxed space-y-3">
          <p>
            ¡Hola! Su opinión es clave para nosotros. Queremos invitarle a colaborar para <strong>construir juntos un mejor ambiente laboral.</strong>
          </p>
          <p>
            Sus respuestas nos ayudan a mejorar y fortalecer nuestro equipo. <strong>¡Gracias por participar!</strong>
          </p>
          <div className="pt-2">
            <span className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded font-bold border border-emerald-200 inline-block">
              Participación 100% anónima y segura.
            </span>
          </div>
        </div>
      </div>

      {/* Fecha */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-300 flex items-center gap-4">
        <div className="bg-blue-100 p-3 rounded-full text-blue-700">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-500 uppercase">Fecha actual</p>
          <p className="text-xl font-bold text-slate-800 capitalize">{data.date}</p>
        </div>
      </div>

      {/* Selección de Área */}
      <div className="bg-white rounded-lg shadow-md border border-slate-300 overflow-hidden">
        <div className="bg-slate-100 p-4 border-b border-slate-300 flex items-center gap-2">
          <User className="w-5 h-5 text-slate-600" />
          <h3 className="font-bold text-slate-800 text-lg">¿A qué área pertenece?</h3>
        </div>
        
        <div className="p-4 md:p-6 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
            {AREAS_LIST.map((area) => {
              const isSelected = data.area === area;
              return (
                <button
                  key={area}
                  onClick={() => onUpdate('area', area)}
                  className={`
                    group relative w-full text-left px-5 py-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-between
                    ${isSelected
                      ? 'bg-blue-800 border-blue-800 text-white shadow-lg transform scale-[1.01] z-10' 
                      : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                    }
                  `}
                >
                  <span className="font-bold text-lg">{area}</span>
                  {isSelected && <CheckCircle2 className="w-6 h-6 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!isFormValid}
          className={`
            flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-xl transition-all shadow-md
            ${isFormValid 
              ? 'bg-blue-800 text-white hover:bg-blue-900 hover:shadow-lg transform hover:-translate-y-0.5' 
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          Siguiente paso
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default IntroSection;