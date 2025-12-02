import React from 'react';
import { Mood, SurveyData } from '../types';
import { Smile, Meh, Frown, ThumbsUp, ChevronLeft, ArrowRight, Heart } from 'lucide-react';

interface MoodSectionProps {
  data: SurveyData;
  onUpdate: (field: keyof SurveyData, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const MoodSection: React.FC<MoodSectionProps> = ({ data, onUpdate, onNext, onBack }) => {
  const moods = [
    { value: Mood.MUY_MAL, label: "Muy mal", icon: <Frown className="w-10 h-10" />, color: "bg-red-50 border-red-200 text-red-800", active: "bg-red-600 text-white border-red-600" },
    { value: Mood.MAL, label: "Mal", icon: <Frown className="w-10 h-10" />, color: "bg-orange-50 border-orange-200 text-orange-800", active: "bg-orange-500 text-white border-orange-500" },
    { value: Mood.REGULAR, label: "Regular", icon: <Meh className="w-10 h-10" />, color: "bg-yellow-50 border-yellow-200 text-yellow-800", active: "bg-yellow-500 text-white border-yellow-500" },
    { value: Mood.BIEN, label: "Bien", icon: <Smile className="w-10 h-10" />, color: "bg-teal-50 border-teal-200 text-teal-800", active: "bg-teal-600 text-white border-teal-600" },
    { value: Mood.MUY_BIEN, label: "Muy bien", icon: <ThumbsUp className="w-10 h-10" />, color: "bg-blue-50 border-blue-200 text-blue-800", active: "bg-blue-700 text-white border-blue-700" },
  ];

  const isValid = data.mood !== "";

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
      <div className="bg-white p-8 rounded-lg border-t-4 border-blue-800 shadow-md">
        <h2 className="text-3xl font-bold text-slate-800 mb-3 flex items-center gap-3">
          <Heart className="w-8 h-8 text-red-500 fill-red-500" />
          ¿Cómo se siente el día de hoy?
        </h2>
        <p className="text-slate-600 text-xl font-medium">
          Seleccione la opción que mejor represente su estado de ánimo actual.
        </p>
      </div>

      <div className="grid gap-4">
        {moods.map((m) => {
           const isSelected = data.mood === m.value;
           
           return (
            <button
              key={m.value}
              onClick={() => onUpdate('mood', m.value)}
              className={`
                w-full flex items-center p-4 md:p-5 rounded-xl border-2 transition-all duration-200 shadow-sm
                ${isSelected
                  ? `${m.active} shadow-lg scale-[1.01]`
                  : `bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50`
                }
              `}
            >
              <div className={`
                p-3 rounded-full mr-5 border-2
                ${isSelected ? 'bg-white/20 border-white/40' : 'bg-slate-100 border-slate-200'}
              `}>
                {m.icon}
              </div>
              
              <div className="flex-grow text-left">
                <span className="text-2xl font-bold block">{m.label}</span>
              </div>
              
              <div className={`
                w-8 h-8 rounded-full border-2 flex items-center justify-center
                ${isSelected ? 'border-white bg-white' : 'border-slate-300 bg-slate-100'}
              `}>
                {isSelected && <div className={`w-3 h-3 rounded-full ${m.value === Mood.MUY_MAL ? 'bg-red-600' : 'bg-blue-700'}`}></div>}
              </div>
            </button>
           );
        })}
      </div>

      <div className="flex justify-between items-center pt-8 border-t border-slate-200 mt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-4 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors border border-slate-300 bg-white"
        >
          <ChevronLeft className="w-6 h-6" /> Regresar
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`flex items-center gap-3 px-10 py-4 rounded-lg font-bold text-xl transition-all shadow-md ${
            isValid 
              ? 'bg-blue-800 text-white hover:bg-blue-900 hover:shadow-lg' 
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          Continuar <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default MoodSection;