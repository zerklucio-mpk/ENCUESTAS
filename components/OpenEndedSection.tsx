import React from 'react';
import { SurveyData } from '../types';
import { ShieldCheck, ChevronLeft, Send, PenSquare } from 'lucide-react';

interface OpenEndedSectionProps {
  data: SurveyData;
  onUpdate: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

const OpenEndedSection: React.FC<OpenEndedSectionProps> = ({ data, onUpdate, onSubmit, onBack, isSubmitting }) => {
  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
      
      <div className="bg-white p-8 rounded-lg border border-slate-300 shadow-sm text-center">
         <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 text-blue-800 rounded-full mb-6">
            <PenSquare className="w-10 h-10" />
         </div>
         <h2 className="text-3xl font-extrabold text-slate-800 mb-4">Comentarios Adicionales</h2>
         <p className="text-slate-700 text-xl">
           Si hay algo más que desee compartir con nosotros, este es el momento.
         </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-slate-300 overflow-hidden">
        <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-700" />
          <span className="text-emerald-800 font-bold text-lg">Zona Segura y Confidencial</span>
        </div>
        
        <div className="p-6 md:p-8">
          <label className="block text-slate-900 font-bold text-xl mb-4">
            ¿Ha ocurrido alguna situación en donde se haya sentido vulnerable?
          </label>
          <p className="text-slate-600 mb-4 text-base italic">
            * Su respuesta es opcional, pero muy valiosa para nosotros. Siéntase libre de expresarse.
          </p>
          
          <textarea
            value={data.vulnerabilityText}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder="Escriba aquí sus comentarios..."
            className="w-full h-64 p-5 rounded-lg bg-slate-50 border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all resize-none text-slate-800 text-xl leading-relaxed placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-6">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-slate-700 border-2 border-slate-300 hover:bg-slate-100 bg-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> Regresar
        </button>
        
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className={`px-10 py-4 rounded-lg font-bold text-white text-xl transition-all shadow-md flex items-center gap-3 ${
            isSubmitting
              ? 'bg-slate-500 cursor-wait' 
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
          }`}
        >
          {isSubmitting ? 'Enviando...' : 'Finalizar Encuesta'} 
          {!isSubmitting && <Send className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

export default OpenEndedSection;