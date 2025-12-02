
/**
 * Generates a short motivational message based on the user's mood.
 * RUNNING LOCALLY - NO AI INTERACTION
 * CONTAINS 10 PRE-LOADED PHRASES PER MOOD - PERSONAL MOTIVATION FOCUS
 */
export const generateClosingMessage = async (vulnerabilityText: string, mood: string): Promise<string> => {
  // Simular un pequeño retardo natural para que no sea instantáneo
  await new Promise(resolve => setTimeout(resolve, 600));

  // Frases específicas para "Muy mal" (Enfoque: Autocompasión, paz mental, esperanza)
  const quotesMuyMal = [
    "Recuerda que tu paz interior es lo más valioso que tienes. Cuídala y date tiempo.",
    "Los momentos difíciles son solo capítulos, no toda tu historia. Esto también pasará.",
    "Sé amable contigo mismo hoy, estás haciendo lo mejor que puedes y eso es suficiente.",
    "Está bien detenerse y respirar. Tu bienestar personal es tu verdadera prioridad.",
    "No hay tormenta que dure para siempre. El sol volverá a salir en tu vida.",
    "Tu valor como persona es inmenso e inquebrantable, independientemente de cómo te sientas hoy.",
    "Date permiso de descansar y sanar el corazón. Te lo mereces.",
    "Un mal día no significa una mala vida. Mañana tendrás una nueva oportunidad para ser feliz.",
    "Abrázate fuerte. Eres tu mejor compañía y tu mayor fortaleza.",
    "Confía en tu capacidad de superar cualquier obstáculo personal. Eres increíble."
  ];

  // Frases específicas para "Mal" (Enfoque: Resiliencia, amor propio, fuerza)
  const quotesMal = [
    "La resiliencia nace en los momentos de prueba. Eres más fuerte de lo que crees.",
    "No te rindas, los grandes cambios en la vida suelen venir acompañados de grandes sacudidas.",
    "Respira hondo y suelta lo que no puedes controlar. Todo va a estar bien.",
    "Confía en el proceso de tu vida, todo sucede para enseñarnos algo valioso.",
    "Eres una persona valiosa y llena de luz, nunca permitas que nada apague eso.",
    "Hoy es solo un escalón más en tu camino. Sigue subiendo a tu propio ritmo.",
    "Rodéate de cosas que te den paz y tranquilidad hoy. Te mereces serenidad.",
    "Recuerda todo lo que has superado para llegar hasta aquí. Eres un guerrero/a.",
    "Tu potencial para ser feliz es ilimitado, no dejes que un obstáculo te nuble la vista.",
    "Busca esa pequeña chispa de alegría hoy dentro de ti, por pequeña que sea."
  ];

  // Frases específicas para "Regular" (Enfoque: Equilibrio, mindfulness, gratitud simple)
  const quotesRegular = [
    "La calma es un superpoder. Disfruta de la tranquilidad de ser tú mismo.",
    "Cada día es un regalo único, busca el detalle bonito que la vida tiene hoy para ti.",
    "El equilibrio es la clave de una vida plena. Estás en el camino correcto.",
    "Hoy es el día perfecto para hacer algo amable por ti mismo, solo porque sí.",
    "A veces, la normalidad es el mejor refugio para recargar energías y reconectar contigo.",
    "Confía en tu intuición y sigue adelante con serenidad. Tú conoces tu camino.",
    "La vida no tiene que ser perfecta para ser maravillosa. Disfruta el ahora.",
    "Dedícate un momento a solas hoy. Escucha lo que tu corazón necesita.",
    "Sigue fluyendo con la vida. Todo lo que es para ti, llegará en su momento justo.",
    "Eres el arquitecto de tu propia felicidad. Sigue construyendo tus sueños."
  ];

  // Frases específicas para "Bien" (Enfoque: Alegría, bienestar, autocuidado)
  const quotesBien = [
    "¡Qué alegría que te sientas bien! Disfruta al máximo esta sensación de plenitud.",
    "Tu bienestar irradia luz a todos los que te rodean. Gracias por ser tú.",
    "La gratitud transforma lo que tenemos en suficiente. Sigue cultivando esa visión.",
    "Hoy es un gran día para celebrar quien eres y todo lo que has logrado.",
    "Que esta energía positiva te impulse a cumplir tus sueños más personales.",
    "Sonríe, la vida te sonríe de vuelta cuando abres tu corazón.",
    "Guarda esta sensación bonita para cuando necesites un recordatorio de lo genial que es vivir.",
    "Eres merecedor/a de toda la felicidad y amor que sientes hoy.",
    "Disfruta de las pequeñas cosas, ahí reside la verdadera magia de la vida.",
    "Sigue cultivando esa paz y alegría interior, es tu tesoro más grande."
  ];

  // Frases específicas para "Muy bien" (Enfoque: Abundancia, plenitud, inspiración)
  const quotesMuyBien = [
    "¡Estás radiante! Que nada ni nadie apague esa luz tan hermosa que tienes.",
    "El mundo necesita más de esa energía increíble y auténtica que posees.",
    "Hoy eres imparable. Ve tras eso que tanto anhelas para tu vida.",
    "Celébrate hoy y siempre. Eres una persona extraordinaria y única.",
    "Tu felicidad es contagiosa y hermosa. ¡Disfruta cada segundo de este momento!",
    "Estás en tu mejor momento. ¡Vívelo, siéntelo y abrázalo!",
    "La vida es bella y tú la haces aún más especial con tu presencia.",
    "Sigue brillando con esa fuerza única que te caracteriza. Eres inspiración.",
    "Te mereces todo lo bueno que te está pasando y todas las bendiciones que vienen.",
    "Eres pura magia. ¡Sigue volando alto y persiguiendo tus estrellas!"
  ];

  let selectedQuotes: string[] = [];

  switch (mood) {
    case "Muy mal":
      selectedQuotes = quotesMuyMal;
      break;
    case "Mal":
      selectedQuotes = quotesMal;
      break;
    case "Regular":
      selectedQuotes = quotesRegular;
      break;
    case "Bien":
      selectedQuotes = quotesBien;
      break;
    case "Muy bien":
      selectedQuotes = quotesMuyBien;
      break;
    default:
      // Fallback por si acaso llega vacío
      selectedQuotes = [
        "Gracias por compartir tu sentir. Recuerda que eres importante.",
        "Tu bienestar personal es lo más valioso. ¡Cuídate mucho!"
      ];
  }

  // Selección aleatoria dentro de la categoría específica
  const randomIndex = Math.floor(Math.random() * selectedQuotes.length);
  return selectedQuotes[randomIndex];
};
