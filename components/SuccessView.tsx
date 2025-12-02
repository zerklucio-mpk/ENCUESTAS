import React from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';

interface SuccessViewProps {
  aiMessage: string;
  onReset: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ aiMessage, onReset }) => {
  return (
    <div className="flex flex-col items-center justify-center animate-fade-in max-w-2xl mx-auto text-center px-4 py-10">
      
      <div className="mb-8">
        <div className="bg-emerald-100 p-6 rounded-full inline-block mb-4 shadow-sm">
          <CheckCircle2 className="w-24 h-24 text-emerald-600" />
        </div>
        <h2 className="text-4xl font-extrabold text-slate-800 mb-3">¡Encuesta Enviada!</h2>
        <p className="text-slate-600 text-xl font-medium">Muchas gracias por su tiempo y honestidad.</p>
      </div>

      {aiMessage && (
        <div className="w-full bg-white border-l-8 border-blue-800 rounded-lg shadow-lg p-8 md:p-12 mb-12 text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <span className="text-9xl font-serif leading-none">”</span>
          </div>
          <p className="text-sm font-bold text-blue-800 uppercase tracking-widest mb-4">Un mensaje para usted</p>
          <p className="text-2xl md:text-3xl font-serif text-slate-800 leading-relaxed italic relative z-10">
            "{aiMessage}"
          </p>
        </div>
      )}

      <button
        onClick={onReset}
        className="flex items-center gap-3 px-8 py-4 rounded-lg text-lg font-bold text-slate-600 border-2 border-slate-300 hover:bg-white hover:border-slate-400 hover:text-slate-800 hover:shadow-md transition-all bg-slate-100"
      >
        <RefreshCw className="w-5 h-5" />
        Iniciar una nueva encuesta
      </button>
    </div>
  );
};

export default SuccessView;