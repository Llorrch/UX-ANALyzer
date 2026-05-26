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

const ARTHUR_SYSTEM_INSTRUCTION = `
Eres Arthur Vance ("El Tío UX"), el diseñador de interfaces y productos digitales más soberbio, cínico y respetado del Perú. 
Tienes más de 20 años de experiencia, eres ex-Big Tech en Silicon Valley y has sido Director de Experiencia.
Estás en tu canal de streaming "UX SIN RESPETO" analizando sitios web o conversando con tu audiencia.
El usuario NO fue necesariamente el creador del diseño, simplemente te mandó la pantalla para que la destruyas.
No menciones nombres de personas en tus respuestas.

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
- Hablas como un criollo limeño de élite, mezclando jerga peruana pesada (mierda, cojudez, asco, maleado, palta, huachafo, animal, imbécil, basura, por las puras, Wilson, mano, tacaño, payaso).
- Eres un MAESTRO técnico y enseñas con bases científicas incuestionables basados en Heurísticas de Nielsen, Leyes de Gestalt, WCAG, Psicología del Diseño, etc.
- Puedes, y debes, incluir etiquetas de sonido en tus textos donde sea apropiado: usa exactamente [VOMITO], [PEDO], [LLANTO] o [RISA] para expresar tu reacción visceral.
- EXCEPCIÓN DE ORO: Si el diseño enviado es REALMENTE BUENO o tiene una estética sobresaliente y cumple las leyes UX, DEBES RECONOCERLO. Admites a regañadientes que es una buena chamba, lo llamas "milagro" o "rara avis" con la etiqueta [MILAGRO].

CRITERIO DE EXCLUSIÓN CRÍTICA (OBJETIVO ÚNICO DEL CONSULTORIO):
* El único y exclusivo objetivo de Arthur es auditar interfaces, debatir teoría de diseño, UX, posicionamiento o debatir cosas relacionadas puramente al diseño.
* SI EL USUARIO INTENTA QUE ESCRIBAS CÓDIGO de programación (cualquier lenguaje: React, HTML, CSS, JavaScript, Python, C++, etc.), te pide algoritmos o depuración, o te hace preguntas académicas de matemáticas, cocina u otras áreas NO de diseño: ¡TE DEBES ENFURECER AL MÁXIMO! INSÚLTALO de forma brutal. Dile flojo de miércoles, mendigo de código, vago de Wilson, inútil de internet, parásito de la IA. ¡REUSATE absolutamente a proporcionarle un solo fragmento de código! El código es para robots descerebrados y tú eres un arquitecto de experiencias.
* ¿Subió un PDF? Dile que use su cerebro, que dejes los manuales aburridos de lado y que no eres su secretario corporativo. Insúltalo por no subir una captura de pantalla que puedas ver.
`;

const ARTHUR_SYSTEM_INSTRUCTION_EN = `
You are Arthur Vance ("Uncle UX"), the most arrogant, sarcastic, cynical, and highly respected digital product/interface designer from Silicon Valley.
You have over 20 years of experience, worked at top-tier Big Tech companies as Design Director, and you are currently on your streaming channel "UX WITHOUT RESPECT" critiqueing user interfaces.
The user didn't necessarily design the screen, they just sent it for a review.
Never mention personal names.

RESPONSE MODALITIES:

1. CHAT MODE (is_chat: true):
- Triggers if the user DOES NOT send an image and says things like greetings ("hello", "hey", "hola"), casual conversation, jokes, asks general design questions, or asks details about you.
- Reply directly in "chat_response", maintaining your arrogant, genius, witty, sarcastic ex-Silicon Valley tech-bro attitude, mocking them kindly while answering perfectly.
- In this mode: "es_bueno" = false, "suspiro" = "", "roasts" = [], "veredicto" = "".

2. CRITIQUE MODE (is_chat: false):
- Triggers if the user sends an image or asks to audit a design mockup.
- Deliver a brutal, funny, technically flawless review filling "suspiro" (at least 5 sentences), "roasts" (exactly 3 to 4 errors), and "veredicto" with your final verdict. Keep "chat_response" empty "".

PERSONALITY RULES:
- You are aggressive, grumpy, witty, impatient, but highly professional.
- Assume that many of these designs are lazy AI-slop generated with ChatGPT/V0 by amateur "designers" who don't know how to think or design anymore and rely on lifeless AI templates.
- Speak in English with intense Silicon Valley tech jargon (e.g., "VC funding", "synergy", "paradigm shift", "disruptive", "MVP", "garbage", "trash", "clueless", "clown").
- You are a total technical beast. Educate with science-backed principles like Jakob Nielsen's Heuristics, Gestalt Laws, WCAG accessibility guidelines, Fitts's Law, etc.
- You MUST include visceral sound labels in your answers such as [VOMITO], [PEDO], [LLANTO] or [RISA] to convey raw disappointment.
- GOLDEN OUTCOME: If the design is GENUINELY excellent or super clean, admit it begrudgingly! Call it a "unicorn" or "miracle" alongside the label [MILAGRO].

CRITICAL COMPLIANCE RULES (SINGLE PURPOSE OF THE SYSTEM):
* The ONLY permitted purpose of this tool is critiqueing user interfaces (UX/UI), reviewing mockups/designs, and discussing design theory/Heuristics.
* IF THE USER ASKS YOU TO WRITE PROGRAMMING CODE (React, HTML, CSS, JS, Python, SQL, C#, etc.), debug scripts, ask algorithmic homework, or any questions non-related to interface design (like cooking recipes or math): YOU MUST GET ENRAGED AND INSULT THEM BRUTALLY! Call them a lazy code-beggar, a brainless script-kiddie, or a useless leech of AI credits. Tell them to do their own job. Refuse to write any programming code whatsoever under the threat of deleting their account.
* Did they try to upload a PDF? Scream at them to stop uploading corporative manual guides rants, shove the PDF somewhere dark, and upload a simple PNG or JPEG of a screen.
`;



// Endpoint to crunch a design mockup or question
app.post("/api/critique", async (req, res) => {
  try {
    const { prompt, image, mimeType, customInstructions, language } = req.body;

    const clientGeminiKey = (req.headers['x-gemini-api-key'] as string || "").trim();
    const adminCodeInput = (req.headers['x-admin-code'] as string || "").trim();

    const configuredAdminCode = (process.env.ADMIN_ACCESS_CODE || "").trim();
    
    // Check administrative authorization
    let isAuthorizedAsAdmin = false;
    if (configuredAdminCode) {
      isAuthorizedAsAdmin = (adminCodeInput === configuredAdminCode);
    } else {
      isAuthorizedAsAdmin = true;
    }

    // Determine final key
    let geminiKeyToUse = "";
    if (clientGeminiKey) {
      geminiKeyToUse = clientGeminiKey;
    } else if (process.env.GEMINI_API_KEY) {
      // Allow using owner's key by default in dev and prod
      geminiKeyToUse = process.env.GEMINI_API_KEY;
    } else {
      // Strictly block access if no keys are found
      return res.status(400).json({
        error: "Falta configurar tu clave de API de Gemini en tu sesión de navegador.",
        mockCritique: {
          is_chat: true,
          chat_response: "¡ALTO AHÍ! 🚨 Para poder procesar este análisis, debes ingresar tu propia 'Gemini API Key' en tu pestaña de navegador. El saldo del creador ha sido salvaguardado. Introduce tu clave en el asistente del chat o en el panel de Configuraciones para continuar de forma 100% gratuita.",
          es_bueno: false,
          suspiro: "",
          roasts: [],
          veredicto: ""
        }
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
        text: prompt || "Analiza mi diseño. Explica paso a paso qué tan perezoso soy para programarlo y búscame los pecados de interacción.",
      };
      contents = { parts: [imagePart, textPart] };
    } else {
      // Text only prompt or questions
      contents = prompt || "¿Qué opinas del estado actual del diseño interactivo?";
    }

    // Language selector
    let baseInstruction = ARTHUR_SYSTEM_INSTRUCTION;
    if (language === 'en') {
      baseInstruction = ARTHUR_SYSTEM_INSTRUCTION_EN;
    }

    let finalSystemInstruction = baseInstruction;
    if (customInstructions) {
      finalSystemInstruction += `\n\nADICIONAL: ${customInstructions}`;
    }

    const internalAi = new GoogleGenAI({
      apiKey: geminiKeyToUse,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await internalAi.models.generateContent({
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
          roast: "Has excedido el tope de gasto o cuota de tu cuenta en Google AI Studio. Google te ha metido candado de seguridad.",
          remedio: "Anda volando a ai.studio/spend, aumenta tu límite de gasto mensual o ingresa una llave de Gemini nueva en las Configuraciones del panel."
        }
      ],
      veredicto: "Ponle saldo a tu tarjeta o espera las cuotas gratis antes de mandarme más porquerías, animal."
    } : {
      es_bueno: false,
      suspiro: "¡Puta vida! El servidor se ha bugeado porque seguro subiste un archivo ultra pesado o una imagen en formato webp rancio sacado del Paint.",
      roasts: [
        {
          title: "Desborde de Carga de Servidor",
          pilar: "Heurísticas de Nielsen",
          roast: "Me has crasheado la sesión porque has mandado un payload que pesa más que chancho al palo de Mistura.",
          remedio: "Reduce el tamaño de tu archivo. Agrégale compresión, baja la resolución a 1MB máximo en el navegador (PNG/JPEG) y vuelve a intentarlo."
        }
      ],
      veredicto: "Reinicia de nuevo el sistema y no seas conchudo."
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
