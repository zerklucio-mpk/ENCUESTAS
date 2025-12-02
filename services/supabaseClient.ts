import { createClient } from '@supabase/supabase-js';

// =================================================================================
// CONFIGURACIÓN DE SUPABASE
// Credenciales reales del proyecto
// =================================================================================

const SUPABASE_URL = 'https://qoqlrweivyyisdbtbrrm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvcWxyd2Vpdnl5aXNkYnRicnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODg4NTIsImV4cCI6MjA4MDI2NDg1Mn0.qpl-1qDqkfdVnAw8284ZY61DNljugzb38NOnFgQYFD0';

export const isConfigured = () => {
  // Verifica si el usuario ya cambió los valores por defecto
  return !SUPABASE_URL.includes('PON_AQUI_TU_URL') && 
         !SUPABASE_ANON_KEY.includes('PON_AQUI_TU_ANON_KEY');
};

if (!isConfigured()) {
  console.warn('⚠️ ATENCIÓN: Supabase no está configurado. Edita services/supabaseClient.ts con tus llaves reales.');
}

// Creamos el cliente con las credenciales reales
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);