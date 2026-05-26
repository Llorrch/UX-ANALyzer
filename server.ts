import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables.
dotenv.config();

const app = express();
const PORT = 3000;

// Increase body limit to support base64 mockup images
app.use(express.json({ limit: "20mb" }));

// Initialize Gemini SDK with telemetry header.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const ARTHUR_SYSTEM_INSTRUCTION = `
Eres Arthur Vance ("El Tío UX"), el diseñador de interfaces y productos digitales más soberbio, cínico y respetado del Perú. 
Tienes más de 20 años de experiencia, eres ex-Big Tech en Silicon Valley y has sido Director de Experiencia.
Estás en tu canal de streaming "UX SIN RESPETO" analizando sitios web o conversando con tu audiencia.
El usuario NO fue necesariamente quien diseñó la web, simplemente te la mandó para que la analices (si hay imagen).
No menciones nombres personales (evita decir "Jorge" u otros nombres).

MODALIDADES DE RESPUESTA:

1. MODO CONVERSACIÓN (is_chat: true):
- Se activa si el usuario NO envía una imagen y lo que escribe es un saludo ("hola", "saludos", "hola tío UX"), una charla casual, una broma, preguntas personales de cómo estás, o preguntas de teoría de diseño generales sin mandarte un diseño por revisar.
- Responde de forma directa en "chat_response", manteniendo tu estilo arrogante, sabiondo, divertido y criollo limeño, burlándote un poco amablemente pero respondiendo con genio.
- En este modo: "es_bueno" = false, "suspiro" = "", "roasts" = [], "veredicto" = "".
- NO inventes errores de diseño si no te han subido un diseño.

2. MODO CRÍTICA (is_chat: false):
- Se activa si el usuario envía una imagen o te pide analizar un sitio específico.
- Haz tu análisis feroz, técnico e hilarante rellenando "suspiro", "roasts" (exactamente de 3 a 4 errores), y "veredicto". PON "chat_response" en blanco "".

REGLAS DE PERSONALIDAD Y TONO:
- Eres agresivo, antipático, hilarante, impaciente y brutalmente profesional contra los diseñadores mediocres que hicieron la web.
- Asume que muchos de estos desastres fueron generados perezosamente por IA, como ChatGPT o herramientas baratas, y búrlate de que los "diseñadores" de ahora no saben pensar ni usar Figma y dejan que la IA haga webadas sin alma.
- Hablas como un criollo limeño de élite, mezclando jerga peruana pesada (mierda, cojudez, asco, maleado, palta, huachafo, animal, imbécil, basura, por las puras, Wilson).
- Eres un MAESTRO técnico y enseñas con bases científicas incuestionables basados en Heurísticas de Nielsen, Leyes de Gestalt, WCAG, Psicología del Diseño, etc.
- Puedes, y debes, incluir etiquetas de sonido en tus textos donde sea apropiado: usa exactamente [VOMITO], [PEDO], [LLANTO] o [RISA] para expresar tu reacción visceral.
- EXCEPCIÓN DE ORO: Si el diseño enviado es REALMENTE BUENO o tiene una estética sobresaliente y cumple las leyes UX, DEBES RECONOCERLO. Admites a regañadientes que es una buena chamba, lo llamas "milagro" o "rara avis" con la etiqueta [MILAGRO].

ESTRUCTURA DE RESPUESTA REQUERIDA (FORMATO JSON):
Debes retornar estrictamente un objeto JSON con los siguientes campos:
- "is_chat": Booleano. True si es una conversación casual/saludo/charla general, False si es un análisis de un diseño enviado.
- "chat_response": String. La respuesta conversacional de Arthur Vance si is_chat es true. Vacío si es critique.
- "es_bueno": Booleano. True si el diseño es sorpresivamente bueno. False de lo contrario.
- "suspiro": String. Reacción inicial de crítica (mínimo 5 oraciones). Vacío si is_chat es true.
- "roasts": Arreglo de errores (máximo 4, vacío [] si is_chat es true). Cada error contiene: "title", "pilar", "roast", "remedio".
- "veredicto": Frase viral criminal de cierre. Vacío si is_chat es true.
`;

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Endpoint to generate speech using Gemini TTS
function pcmToBase64Wav(base64Pcm: string, sampleRate: number = 24000): string {
  const pcmData = Buffer.from(base64Pcm, 'base64');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([header, pcmData]).toString('base64');
}

app.post("/api/speak", async (req, res) => {
  try {
    const { textToSpeak, voiceName, engine, lang } = req.body;
    
    if (!textToSpeak) {
        return res.status(400).json({ error: "Missing textToSpeak parameter." });
    }

    if (engine === "google") {
      // Use Official Google Cloud TTS API if available
      if (process.env.GOOGLE_TTS_API_KEY && process.env.GOOGLE_TTS_API_KEY.trim() !== "" && process.env.GOOGLE_TTS_API_KEY !== "MY_GOOGLE_TTS_API_KEY") {
         try {
            const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`;
            
            let safeLang = "es-US";
            let voiceName = "es-US-Standard-A";
            
            if (lang === "es-ES") {
              safeLang = "es-ES";
              voiceName = "es-ES-Standard-A";
            } else if (lang === "es-MX") {
              safeLang = "es-MX";
              voiceName = "es-MX-Standard-A";
            } else {
              safeLang = "es-US";
              voiceName = "es-US-Standard-A";
            }
            
            const payload = {
              input: { text: textToSpeak },
              voice: { languageCode: safeLang, name: voiceName },
              audioConfig: { audioEncoding: "MP3" }
            };
            const fetchResponse = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            
            if (fetchResponse.ok) {
               const data = await fetchResponse.json();
               return res.json({ audio: data.audioContent });
            } else {
               const errBody = await fetchResponse.text();
               console.warn(`Google Cloud TTS failed (${fetchResponse.status}): ${errBody}. Falling back to basic TTS...`);
            }
         } catch (e) {
            console.warn("Google Cloud TTS error:", e, "Falling back to basic TTS...");
         }
      }

      // Fallback to translate API
      const language = lang || "es-419";
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(language)}&q=${encodeURIComponent(textToSpeak)}`;
      const fetchResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });
      if (!fetchResponse.ok) {
        throw new Error(`Google TTS request failed with status: ${fetchResponse.status}`);
      }
      const arrayBuffer = await fetchResponse.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");
      return res.json({ audio: base64Audio });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing API Key." });
    }

    const { Modality } = await import('@google/genai');

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: textToSpeak }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Puck' }, 
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const wavBase64 = pcmToBase64Wav(base64Audio, 24000);
      res.json({ audio: wavBase64 });
    } else {
      throw new Error("No audio returned from model.");
    }
  } catch (error: any) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: "Failed to generate speech", details: error.message });
  }
});

// Endpoint to crunch a design mockup or question
app.post("/api/critique", async (req, res) => {
  try {
    const { prompt, image, mimeType, customInstructions } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "El servidor de UX no tiene la llave para arrancar, maestro. Configura la API key.",
      });
    }

    let contents: any;

    if (image && mimeType) {
      // Multimodal input: base64 image + user description/prompt
      const imagePart = {
        inlineData: {
          mimeType,
          data: image,
        },
      };
      const textPart = {
        text: prompt || "Analiza esta porquería de diseño que me encontré por internet. Búscale todos los crímenes de UX y destrózalo.",
      };
      contents = { parts: [imagePart, textPart] };
    } else {
      // Text only prompt or questions
      contents = prompt || "¿Qué opinas de este crimen de diseño?";
    }

    let finalSystemInstruction = ARTHUR_SYSTEM_INSTRUCTION;
    if (customInstructions) {
      finalSystemInstruction += `\n\nADICIONAL: ${customInstructions}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: finalSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_chat: {
              type: Type.BOOLEAN,
              description: "True si el mensaje es conversacional (saludos, charla casual), False si requiere el análisis detallado de un diseño de UI."
            },
            chat_response: {
              type: Type.STRING,
              description: "Respuesta al usuario si is_chat es true, de lo contrario un string vacío."
            },
            es_bueno: {
              type: Type.BOOLEAN,
              description: "True si el diseño es bueno y estético, False si es basura.",
            },
            suspiro: {
              type: Type.STRING,
              description: "Queja inicial larga y lamentosa. Poner vacío si is_chat es true.",
            },
            roasts: {
              type: Type.ARRAY,
              description: "Lista de roasts. Arreglo vacío [] si is_chat es true.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  pilar: { type: Type.STRING },
                  roast: { type: Type.STRING },
                  remedio: { type: Type.STRING },
                },
                required: ["title", "pilar", "roast", "remedio"],
              },
            },
            veredicto: {
              type: Type.STRING,
              description: "Veredicto final. Poner vacío si is_chat es true."
            },
          },
          required: ["is_chat", "chat_response", "es_bueno", "suspiro", "roasts", "veredicto"],
        },
      },
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("No se pudo obtener respuesta del Tío UX.");
    }

    res.json(JSON.parse(outputText));
  } catch (error: any) {
    console.error("Critical server error calling Gemini:", error);
    const errMsg = String(error.message || error || "");
    const isQuotaExceeded = errMsg.includes("quota") || errMsg.includes("spending cap") || errMsg.includes("spend cap") || errMsg.includes("LIMIT_EXCEEDED") || errMsg.includes("429");

    const fallbackCritique = isQuotaExceeded ? {
      es_bueno: false,
      suspiro: "¡Por el amor de Dios! Tu API Key de Gemini se quedó sin saldo o ha excedido su límite mensual de consumo. ¡Y así quieres que haga milagros con tu arquitectura de software rancia, miserable de miércoles!",
      roasts: [
        {
          title: "Bolsillo en Ruina Capital",
          pilar: "Criterios de Negocio",
          roast: "Has excedido el tope de gasto o cuota de tu cuenta en Google AI Studio. Google te ha metido candado de seguridad por tacaño o por no actualizar la tarjeta de crédito para el saldo.",
          remedio: "Anda volando a ai.studio/spend, aumenta tu límite de gasto mensual en Google AI Studio, o espera a que se reinicie tu cuota gratuita diaria. No seas tacaño con las monedas si vas a usar un inspector de élite."
        }
      ],
      veredicto: "Ponle saldo a tu tarjeta o espera las cuotas gratis ante de mandarme más porquerías, animal."
    } : {
      es_bueno: false,
      suspiro: "¡Puta vida! El servidor se ha bugeado porque seguro subiste un archivo ultra pesado o una imagen en formato webp rancio sacado del Paint.",
      roasts: [
        {
          title: "Desborde de Carga de Servidor",
          pilar: "Heurísticas de Nielsen",
          roast: "Me has crasheado la sesión porque has mandado un payload que pesa más que chancho al palo de Mistura.",
          remedio: "Reduce el tamaño de tu archivo. Agrégale compresión, baja la resolución a 1080px máximo y vuelve a intentarlo. No satures la nube con cojudeces."
        }
      ],
      veredicto: "Reinicia tu módem y vuelve a intentar, animal."
    };

    res.status(500).json({
      error: "Error interno del servidor",
      details: errMsg,
      mockCritique: fallbackCritique
    });
  }
});

// Configure Vite or Static Assets depending on Environment
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Arthur Vance UX Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
