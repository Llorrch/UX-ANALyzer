import { PresetDisaster } from './types';

export const LIMA_TIEMPO_REAL = 'San Isidro, Lima - Perú';

export const PERSISTENT_PILLARS = [
  {
    id: 'nielsen',
    name: '10 Heurísticas de Nielsen',
    tag: 'Heurísticas de Nielsen',
    description: 'La biblia del diseño de interacción. Consistencia, prevención de errores, visibilidad del estado del sistema, libertad del usuario y estándares lógicos.',
    arthurQuote: 'Si tu app no tiene consistencia, Jorge, estás obligando al usuario a pensar como si estuviera resolviendo integrales en una combi en marcha. ¡Estándares, carajo!',
    icon: 'Compass'
  },
  {
    id: 'gestalt',
    name: 'Leyes de la Gestalt',
    tag: 'Leyes de Gestalt',
    description: 'Cómo el cerebro humano agrupa elementos visuales de forma natural según proximidad, similitud, continuidad y contraste de fondo.',
    arthurQuote: 'El cerebro ve un grupo de botones pegados y asume que hacen lo mismo. Si pones el botón de "Guardar" y el de "Borrar todo" con el mismo color y juntos, eres un terrorista del interfaz. Ley de proximidad básica, animal.',
    icon: 'Layers'
  },
  {
    id: 'wcag',
    name: 'Accesibilidad WCAG 2.2',
    tag: 'Accesibilidad WCAG',
    description: 'Garantía de legibilidad para todos. Contraste mínimo de 4.5:1, jerarquía de fuentes legible, tamaños táctiles mínimos de 44px e interactivos claros.',
    arthurQuote: '¿Letras plomitas sobre fondo gris claro? ¿Qué crees, que tus usuarios tienen vista de águila o que están usando un monitor Apple de 5000 dólares? Hay abuelitos tratando de usar tu servicio, ten un poco de empatía y métele contraste, huachafo.',
    icon: 'Eye'
  },
  {
    id: 'psychology',
    name: 'Psicología (Hick & Fitts)',
    tag: 'Psicología del Diseño',
    description: 'Hick: A más opciones, más lento decide el usuario. Fitts: Los botones principales deben ser grandes y estar cerca de las zonas naturales del dedo/cursor.',
    arthurQuote: 'Si tienes 15 campos en tu formulario, estás violando la Ley de Hick y tu tasa de rebote va a ser del 99%. A la gente le da flojera rellenar cojudeces. ¡Reduce la carga cognitiva, por las puras no te pago!',
    icon: 'Brain'
  },
  {
    id: 'architecture',
    name: 'Arquitectura de Información',
    tag: 'Arquitectura de Información',
    description: 'Estructuración clara del contenido para un flujo de navegación intuitivo. Menús limpios, priorización visual y orden de lectura.',
    arthurQuote: 'Tu menú de navegación parece el mapa del Metropolitano en hora punta. Nadie entiende dónde dar click. Si no hay jerarquía, tu arquitectura es un asco.',
    icon: 'Map'
  }
];

export const PRESET_DISASTERS: PresetDisaster[] = [
  {
    id: 'metropolitano',
    name: 'Web del Metropolitano (Classic)',
    description: 'Un laberinto de banners de los años 2000, marquesinas parpadeantes, nulo responsive y PDF de rutas pesadísimos imposibles de abrir en celular.',
    category: 'Infraestructura Pública',
    url: 'http://www.metropolitano.gob.pe'
  },
  {
    id: 'banco-nacion',
    name: 'Portal del Banco de la Nación',
    description: 'Botones que parecen anuncios engañosos, contraste inexistente, alertas rojas que asustan al usuario y un login capado que te pide coordenadas imposibles.',
    category: 'Banca Estatal'
  },
  {
    id: 'wilson',
    name: 'Página Web clásica de Wilson Hardware',
    description: 'Bento Grid fallido con 250 productos de computación en una sola grilla, tipografía Comic Sans accidental, fondos parpadeantes e información de stock en colores chicha.',
    category: 'E-commerce Brutalista'
  },
  {
    id: 'reniec-renovacion',
    name: 'App de Renovación de DNI (RENIEC)',
    description: 'Carga facial que te rechaza si parpadeas, instrucciones escritas en letras de 8px gris y un flujo de pagos externo que te saca de la app sin avisar.',
    category: 'Trámite Nacional'
  },
  {
    id: 'saga-cyber',
    name: 'Checkout de Saga Falabella en Cyber Days',
    description: 'Pop-ups infinitos ofreciendo tarjetas de crédito justo cuando quieres pagar, un scroll infinito que interfiere con el botón de finalizar compra y nula confirmación de stock.',
    category: 'Retail masivo'
  }
];
