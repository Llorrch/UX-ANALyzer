import { useState, useEffect, useCallback } from 'react';
import ArthurChat from './components/ArthurChat';
import WinWindow from './components/WinWindow';
import { Critique, ChatMessage } from './types';
import { Terminal, Settings, Volume2, Globe, Brain, Car, Palette, TrendingUp, Youtube, Info } from 'lucide-react';

let globalAudioContext: AudioContext | null = null;
let currentAudioSource: AudioBufferSourceNode | null = null;
let currentSpeechSessionId = 0;

function unlockAudio() {
  if (!globalAudioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      globalAudioContext = new AudioCtx();
    }
  }
  if (globalAudioContext && globalAudioContext.state === 'suspended') {
    globalAudioContext.resume();
  }
}

function playXpBootSound() {
  unlockAudio();
  if (!globalAudioContext) return;
  
  const ctx = globalAudioContext;
  const now = ctx.currentTime;
  
  // Create master node with lowpass filter for warm synth analog character
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.40, now + 0.15);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 5.0);
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(2600, now + 1.2);
  filter.frequency.exponentialRampToValueAtTime(600, now + 4.6);
  
  masterGain.connect(filter);
  filter.connect(ctx.destination);

  // Helper inside to generate detuned pad voices
  const createPadVoice = (freq: number, startTime: number, duration: number, volume: number) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const voiceGain = ctx.createGain();
    
    // Triangle + Sine combination creates a very rich Windows XP retro organ-pad character
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc1.detune.setValueAtTime(-10, startTime);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq, startTime);
    osc2.detune.setValueAtTime(10, startTime);
    
    voiceGain.gain.setValueAtTime(0, startTime);
    voiceGain.gain.linearRampToValueAtTime(volume * 0.7, startTime + 0.8);
    voiceGain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 2.4);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    
    osc1.connect(voiceGain);
    osc2.connect(voiceGain);
    voiceGain.connect(masterGain);
    
    osc1.start(startTime);
    osc1.stop(startTime + duration);
    osc2.start(startTime);
    osc2.stop(startTime + duration);
  };

  // Base chords (Ab major / Eb major warm bed)
  const padFreqs = [
    77.78,   // Eb2
    103.83,  // Ab2
    155.56,  // Eb3
    207.65,  // Ab3
    261.63,  // C4
    311.13,  // Eb4
    415.30,  // Ab4
    523.25,  // C5
  ];
  
  padFreqs.forEach((freq, idx) => {
    const vol = idx < 2 ? 0.35 : idx < 5 ? 0.22 : 0.12;
    createPadVoice(freq, now, 4.8, vol);
  });

  // Second layer of moving chords resolving around the dominant 1s later
  const resolveFreqs = [
    116.54,  // Bb2
    233.08,  // Bb3
    311.13,  // Eb4
    392.00,  // G4
    466.16,  // Bb4
    587.33,  // D5
  ];
  
  resolveFreqs.forEach((freq, idx) => {
    const vol = idx < 2 ? 0.25 : 0.12;
    createPadVoice(freq, now + 0.8, 4.0, vol);
  });

  // Chime sparkling arpeggio notes
  // Eb5 -> Bb5 -> Eb6 -> F6 -> G6 -> Bb6 -> Eb7
  const chimeNotes = [
    { freq: 622.25,  time: 0.00 },
    { freq: 932.33,  time: 0.16 },
    { freq: 1244.51, time: 0.32 },
    { freq: 1396.91, time: 0.48 },
    { freq: 1567.98, time: 0.64 },
    { freq: 1864.66, time: 0.80 },
    { freq: 2489.02, time: 1.05 }
  ];

  chimeNotes.forEach((note, idx) => {
    const oscChime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    const delay = ctx.createDelay();
    const delayGain = ctx.createGain();
    
    oscChime.type = 'sine';
    oscChime.frequency.setValueAtTime(note.freq, now + note.time);
    
    const attack = 0.01;
    const decay = idx === chimeNotes.length - 1 ? 2.5 : 1.2;
    
    chimeGain.gain.setValueAtTime(0, now + note.time);
    chimeGain.gain.linearRampToValueAtTime(idx === chimeNotes.length - 1 ? 0.35 : 0.22, now + note.time + attack);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + decay);
    
    // Cozy echoes for the nostalgic shine
    delay.delayTime.setValueAtTime(0.28, now + note.time);
    delayGain.gain.setValueAtTime(0.22, now + note.time);
    
    oscChime.connect(chimeGain);
    chimeGain.connect(masterGain);
    
    chimeGain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(masterGain);
    delayGain.connect(delay);
    
    oscChime.start(now + note.time);
    oscChime.stop(now + note.time + decay + 0.5);
  });
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isEnraged, setIsEnraged] = useState<boolean>(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
    return localStorage.getItem('hide_welcome_modal') !== 'true';
  });

  type WindowId = 'analyzer' | 'settings';
  const [openWindows, setOpenWindows] = useState<WindowId[]>(['analyzer']);
  const [activeWindow, setActiveWindow] = useState<WindowId>('analyzer');
  const [minimizedWindows, setMinimizedWindows] = useState<WindowId[]>([]);
  const [appLanguage, setAppLanguage] = useState<string>(() => localStorage.getItem('app_language') || 'es');
  const [browserVoiceURI, setBrowserVoiceURI] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>(() => {
    return localStorage.getItem('custom_instructions') || 'Habla en español callejero latinoamericano, directo, divertido, coloquial, espontáneo y con chispa callejera natural (usa palabras como webadas, asco, animal, imbécil, basura, payaso, gil, tacaño, fracasado).';
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Custom API keys
  const [customGeminiKey, setCustomGeminiKey] = useState<string>(() => sessionStorage.getItem('custom_gemini_key') || '');
  const [adminAccessCode, setAdminAccessCode] = useState<string>(() => localStorage.getItem('admin_access_code') || '');
  
  // Free chats counter (up to 5 free chats with the creator's key per device)
  const [freeChatsCount, setFreeChatsCount] = useState<number>(() => {
    return Number(localStorage.getItem('free_chats_count')) || 0;
  });

  // Initialize Speech Synthesis voice loading with reactive events (important for macOS and Chrome)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const list = window.speechSynthesis.getVoices();
        setVoices(list);
        
        // Auto-select a high quality Spanish voice if none is explicitly set (prefer Google español México)
        setBrowserVoiceURI(prev => {
          if (prev) return prev;
          if (list.length > 0) {
            // 1. Google español de México
            const googleEsMx = list.find(v => (v.lang.toLowerCase() === 'es-mx' || v.lang.toLowerCase() === 'es_mx') && v.name.toLowerCase().includes('google'));
            if (googleEsMx) return googleEsMx.voiceURI;

            // 2. Google español (cualquiera, ej. España, EE.UU.)
            const googleEs = list.find(v => v.lang.toLowerCase().startsWith('es') && v.name.toLowerCase().includes('google'));
            if (googleEs) return googleEs.voiceURI;

            // 3. Cualquier voz en español de México (es-MX)
            const genericEsMx = list.find(v => v.lang.toLowerCase() === 'es-mx' || v.lang.toLowerCase() === 'es_mx');
            if (genericEsMx) return genericEsMx.voiceURI;

            // 4. macOS Siri o voces Premium españolas (Siri, Monica, Paulina, Jorge, Diego)
            const premiumEs = list.find(v => v.lang.toLowerCase().startsWith('es') && (v.name.includes('Premium') || v.name.includes('Enhanced') || ['Monica', 'Paulina', 'Jorge', 'Diego'].some(n => v.name.includes(n))));
            if (premiumEs) return premiumEs.voiceURI;
            
            // 5. Cualquier voz estándar en español
            const generalEs = list.find(v => v.lang.toLowerCase().startsWith('es'));
            if (generalEs) return generalEs.voiceURI;
          }
          return '';
        });
      };
      
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const speakText = useCallback(async (text: string) => {
    try {
      unlockAudio();
      
      currentSpeechSessionId++;
      const mySessionId = currentSpeechSessionId;

      if (currentAudioSource) {
        try { currentAudioSource.stop(); } catch(e) {}
        currentAudioSource = null;
      }
      setIsSpeaking(false);
      
      if ('speechSynthesis' in window) {
         window.speechSynthesis.cancel(); 
      }
      // Fix S/. abbreviation to "Soles"
      let cleanText = text.replace(/S\/\./g, ' Soles ');

      cleanText = cleanText.replace(/\[V[OÓ]MITO\]|\[PEDO\]|\[LLANTO\]|\[RISA\]|\[MILAGRO\]/gi, '');
      cleanText = cleanText.replace(/[&*#_\[\]-]+/g, '');

      setIsSpeaking(true);

      if ('speechSynthesis' in window) {
        return new Promise<void>((resolve) => {
           const utterance = new SpeechSynthesisUtterance(cleanText);
           utterance.rate = 1.1;
           const voicesList = window.speechSynthesis.getVoices();
           let selectedVoice = voicesList.find(v => v.voiceURI === browserVoiceURI);
           
           console.log("TTS Browser Mode - Selected Voice URI:", browserVoiceURI);
           
           if (!selectedVoice) {
             // Prioritize Google español, then macOS premium/enhanced voices for Spanish
             const googleEsMx = voicesList.find(v => (v.lang.toLowerCase() === 'es-mx' || v.lang.toLowerCase() === 'es_mx') && v.name.toLowerCase().includes('google'));
              const googleEs = googleEsMx || voicesList.find(v => v.lang.toLowerCase().startsWith('es') && v.name.toLowerCase().includes('google'));
             const macPremium = voicesList.find(v => v.lang.toLowerCase().startsWith('es') && (v.name.includes('Premium') || v.name.includes('Enhanced') || ['Monica', 'Paulina', 'Jorge', 'Diego'].some(n => v.name.includes(n))));
             selectedVoice = googleEs || macPremium || voicesList.find(v => v.lang.toLowerCase().startsWith('es-')) || voicesList.find(v => v.lang.toLowerCase().startsWith('es')) || voicesList[0];
             console.log("TTS Browser Mode - Auto-fallback selected voice:", selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : "None");
           } else {
             console.log("TTS Browser Mode - User chosen selected voice:", `${selectedVoice.name} (${selectedVoice.lang})`);
           }
           
           if (selectedVoice) {
             utterance.voice = selectedVoice;
             utterance.lang = selectedVoice.lang;
           } else {
             utterance.lang = 'es-MX'; // Fallback language
           }
           
           utterance.onend = () => {
             if (mySessionId === currentSpeechSessionId) setIsSpeaking(false);
             resolve();
           };
           utterance.onerror = () => {
             if (mySessionId === currentSpeechSessionId) setIsSpeaking(false);
             resolve();
           };
           
           window.speechSynthesis.speak(utterance);
        });
      }
    } catch (e) {
      console.error("Speech Synthesis Error:", e);
      setIsSpeaking(false);
    }
  }, [browserVoiceURI]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      try {
        const silentUtterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(silentUtterance);
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    currentSpeechSessionId++;
    if (currentAudioSource) {
      try { currentAudioSource.stop(); } catch (e) {}
      currentAudioSource = null;
    }
    setIsSpeaking(false);
  }, []);

  const handleClearHistory = () => {
    setMessages([]);
    stopSpeaking();
  };

  const triggerLocalArthurInsult = useCallback((userText: string, insultText: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString()
    };
    const insultMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: insultText,
      critique: {
        is_chat: true,
        chat_response: insultText,
        es_bueno: false,
        suspiro: "",
        roasts: [],
        veredicto: ""
      },
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages((prev) => [...prev, userMsg, insultMsg]);
    speakText(insultText);
  }, [speakText]);

  const handleAnalyzeCritique = async (prompt: string, imageBase64: string | null = null, mimeType: string | null = null) => {
    unlockAudio();
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      image: imageBase64 ? `data:${mimeType || 'image/png'};base64,${imageBase64}` : undefined,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const critiqueHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customGeminiKey) critiqueHeaders['x-gemini-api-key'] = customGeminiKey;
      if (adminAccessCode) critiqueHeaders['x-admin-code'] = adminAccessCode;

      const response = await fetch('/api/critique', {
        method: 'POST',
        headers: critiqueHeaders,
        body: JSON.stringify({ prompt, image: imageBase64, mimeType, customInstructions, language: appLanguage })
      });

      let critiqueData: Critique;
      if (!response.ok) {
        try {
          const errPayload = await response.json();
          if (errPayload && errPayload.mockCritique) {
            critiqueData = errPayload.mockCritique;
          } else {
            throw new Error(errPayload.error || "API Failure");
          }
        } catch (e: any) {
          throw new Error(e.message || "API Failure");
        }
      } else {
        critiqueData = await response.json();
      }

      // Increment free chats count if using default/creator key
      if (!customGeminiKey) {
        setFreeChatsCount((prev) => {
          const nextVal = prev + 1;
          localStorage.setItem('free_chats_count', String(nextVal));
          return nextVal;
        });
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: critiqueData.is_chat ? (critiqueData.chat_response || '') : `Crítica recibida.`,
        critique: critiqueData,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, assistantMsg]);
      
      // Auto reproduce roast removed (User asked to only play on demand)
      const roastsText = (critiqueData.roasts || []).map(r => `${r.title}. ${r.roast}`).join('. ');
      const textToSpeak = critiqueData.is_chat 
        ? (critiqueData.chat_response || '') 
        : `${critiqueData.suspiro}. ${roastsText}. ${critiqueData.veredicto}`;


      // Trigger automatic rage if he mentions certain words
      if (textToSpeak.toLowerCase().includes('mierda') || textToSpeak.toLowerCase().includes('asco') || /\[(VOMITO|VÓMITO|PEDO)\]/i.test(textToSpeak)) {
        setIsEnraged(true);
        setTimeout(() => setIsEnraged(false), 800);
      }
      
    } catch (err: any) {
      console.error(err);
      const fallback: Critique = {
        es_bueno: false,
        suspiro: "¡Me cago en la conexión! El servidor está muerto. Revisa tu API key.",
        roasts: [{ title: "Error 500", pilar: "Heurísticas de Nielsen", roast: "No hay internet capataz.", remedio: "Reconecta y vuelve." }],
        veredicto: "Cero a la izquierda."
      };
      
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Mala conexión.`,
        critique: fallback,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages((prev) => [...prev, errMsg]);

    } finally {
      setIsLoading(false);
    }
  };

  const openWindow = (id: WindowId) => {
    if (!openWindows.includes(id)) {
      setOpenWindows([...openWindows, id]);
    }
    setMinimizedWindows(minimizedWindows.filter(w => w !== id));
    setActiveWindow(id);
  };

  const closeWindow = (id: WindowId) => {
    setOpenWindows(openWindows.filter(w => w !== id));
    setMinimizedWindows(minimizedWindows.filter(w => w !== id));
    if (activeWindow === id) {
       const remaining = openWindows.filter(w => w !== id);
       setActiveWindow(remaining.length > 0 ? remaining[0] : null as any);
    }
  };

  const minimizeWindow = (id: WindowId) => {
    if (!minimizedWindows.includes(id)) {
      setMinimizedWindows([...minimizedWindows, id]);
    }
    if (activeWindow === id) {
       const remaining = openWindows.filter(w => w !== id && !minimizedWindows.includes(w) && w !== id);
       setActiveWindow(remaining.length > 0 ? remaining[remaining.length - 1] : null as any);
    }
  };

  const toggleWindowMinimizeRestore = (id: WindowId) => {
    if (minimizedWindows.includes(id)) {
      setMinimizedWindows(minimizedWindows.filter(w => w !== id));
      setActiveWindow(id);
    } else if (activeWindow === id) {
      minimizeWindow(id);
    } else {
      setMinimizedWindows(minimizedWindows.filter(w => w !== id));
      setActiveWindow(id);
    }
  };

  const isAnalyzerOpen = openWindows.includes('analyzer');

  return (
    <div className="w-[100dvw] h-[100dvh] flex flex-col font-win text-black bg-transparent">
      
      {/* Desktop Area */}
      <div className="flex-1 relative overflow-hidden" onClick={() => setActiveWindow(null as any)}>
        {/* Desktop Icons */}
        <div className="flex flex-col gap-5 p-4 absolute top-0 left-0 w-32 h-full z-0 select-none">
          <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform" onClick={(e) => {e.stopPropagation(); openWindow('analyzer')}}>
            <Terminal size={38} className={`text-white p-1 filter drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)] ${activeWindow === 'analyzer' ? 'bg-blue-800' : ''}`} />
            <span className={`text-white text-center font-bold text-[11px] leading-tight px-1.5 py-0.5 rounded ${activeWindow === 'analyzer' ? 'bg-blue-800 border-dotted border border-white' : ''}`} style={{ textShadow: '1px 1px 0 #003399, -1px -1px 0 #003399, 1px -1px 0 #003399, -1px 1px 0 #003399, 0 2px 4px rgba(0,0,0,1)' }}>UX ANALyzer</span>
          </div>

          <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform" onClick={(e) => {e.stopPropagation(); openWindow('settings')}}>
            <div className={`p-1 ${activeWindow === 'settings' ? 'bg-blue-800' : ''}`}>
              <Settings size={36} className="text-white filter drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]" />
            </div>
            <span className={`text-white text-center font-bold text-[11px] leading-tight px-1.5 py-0.5 rounded ${activeWindow === 'settings' ? 'bg-blue-800 border-dotted border border-white' : ''}`} style={{ textShadow: '1px 1px 0 #003399, -1px -1px 0 #003399, 1px -1px 0 #003399, -1px 1px 0 #003399, 0 2px 4px rgba(0,0,0,1)' }}>Panel de Control</span>
          </div>

          <div className="w-full border-t border-dotted border-white/45 my-1.5"></div>

          <div className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform" onClick={(e) => { e.stopPropagation(); alert('¡Próximamente disponible! Esta sección se encuentra en construcción.'); }}>
            <Globe size={38} className="text-white p-1 fill-blue-400 filter drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1.5 py-0.5" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,1)' }}>Mi página web</span>
          </div>

          <a 
            href="https://aivaperu.com/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform group text-decoration-none"
            onClick={(e) => e.stopPropagation()}
          >
            <Brain size={38} className="text-[#ffccd5] p-1 fill-[#ff3366] filter drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1.5 py-0.5 group-hover:underline" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,1)' }}>Aiva Psicólogos</span>
          </a>

          <a 
            href="https://autoque.app/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform group text-decoration-none"
            onClick={(e) => e.stopPropagation()}
          >
            <Car size={38} className="text-[#b3d9ff] p-1 fill-[#1a8cff] filter drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1.5 py-0.5 group-hover:underline" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,1)' }}>Autoqué</span>
          </a>

          <div 
            className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform" 
            onClick={(e) => { e.stopPropagation(); alert('Sitio en construcción civil 🚧 ¡Estoy construyendo mi portafolio, ten paciencia!'); }}
          >
            <Palette size={38} className="text-[#ffe3a8] p-1 fill-[#fb8c00] filter drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1.5 py-0.5" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,1)' }}>Mi portafolio</span>
          </div>

          <a 
            href="https://metria.agency/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform group text-decoration-none"
            onClick={(e) => e.stopPropagation()}
          >
            <TrendingUp size={38} className="text-[#d1fae5] p-1 fill-[#059669] filter drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1.5 py-0.5 group-hover:underline" style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,1)' }}>Mejora tu conversión</span>
          </a>
        </div>

        {/* Windows */}
        {/* Windows */}
        {openWindows.includes('settings') && !minimizedWindows.includes('settings') && (
          <WinWindow 
             id="settings" title="Panel de Control - Tío UX" icon={<Settings size={12} />}
             isActive={activeWindow === 'settings'} onFocus={() => setActiveWindow('settings')}
             onClose={() => closeWindow('settings')}
             onMinimize={() => minimizeWindow('settings')}
             defaultPosition={{x: 50, y: 50}} width={440} height={415}
          >
             <div className="p-3 bg-win-gray h-full flex flex-col gap-3 text-black text-xs">
                <div className="flex items-center gap-2 mb-1">
                   <Volume2 size={32} className="text-gray-700" />
                   <div>
                     <h2 className="font-bold text-sm">Opciones y Configuración</h2>
                     <p className="text-[10px] text-gray-600">Configura la voz, idioma y llaves de acceso del consultorio virtual.</p>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 max-h-[380px]">
                   {/* Language block */}
                   <fieldset className="win-border-inset p-2.5 bg-white">
                      <legend className="bg-win-gray px-1 font-bold">Idioma de Respuestas / Output Language</legend>
                      <div className="flex flex-col gap-2 mt-1">
                         <label className="flex flex-col">
                           <span className="font-bold mb-1">Seleccionar Idioma</span>
                           <select 
                             className="win-border-inset p-1 bg-white text-xs outline-none" 
                             value={appLanguage} 
                             onChange={(e) => {
                               // Language and instructions updated below
                               const newLng = e.target.value;
                               setAppLanguage(newLng);
                               localStorage.setItem('app_language', newLng);
                               if (newLng === 'es') {
                                 const textVal = 'Habla en español callejero latinoamericano, directo, divertido, coloquial, espontáneo y con chispa callejera natural (usa palabras como webadas, asco, animal, imbécil, basura, payaso, gil, tacaño, fracasado).';
                                 setCustomInstructions(textVal);
                                 localStorage.setItem('custom_instructions', textVal);
                               } else if (newLng === 'en') {
                                 const textVal = 'Speak in casual, sarcastic American street slang, using ex-Silicon Valley tech jargon.';
                                 setCustomInstructions(textVal);
                                 localStorage.setItem('custom_instructions', textVal);
                               }
                             }}
                           >
                             <option value="es">Español callejero latinoamericano</option>
                             <option value="en">English (Sarcastic ex-Silicon Valley Designer)</option>
                           </select>
                         </label>
                      </div>
                   </fieldset>

                   <fieldset className="win-border-inset p-2.5 bg-white">
                      <legend className="bg-win-gray px-1 font-bold">Llaves de API (Seguridad y Privacidad)</legend>
                      <div className="flex flex-col gap-2 mt-1">
                         <div className="text-[10px] text-red-700 leading-tight mb-1 font-bold">
                           * Si eres usuario público, debes ingresar tu propia Gemini API Key para los análisis premium.
                         </div>
                         <label className="flex flex-col gap-0.5">
                           <span className="font-bold">Tu API Key de Gemini:</span>
                           <input 
                             type="password" 
                             placeholder="Ingresa tu llave AIzaSy..." 
                             className="win-border-inset p-1 bg-white font-mono text-xs"
                             value={customGeminiKey}
                             onChange={(e) => {
                               setCustomGeminiKey(e.target.value);
                               sessionStorage.setItem('custom_gemini_key', e.target.value);
                             }}
                           />
                         </label>
                         <label className="flex flex-col gap-0.5">
                           <span className="font-bold">Clave de Acceso Administrador (Opcional):</span>
                           <input 
                             type="password" 
                             placeholder="Bypassear API Key si eres dueño..." 
                             className="win-border-inset p-1 bg-white font-mono text-xs"
                             value={adminAccessCode}
                             onChange={(e) => {
                               setAdminAccessCode(e.target.value);
                               localStorage.setItem('admin_access_code', e.target.value);
                             }}
                           />
                         </label>
                      </div>
                   </fieldset>

                   <fieldset className="win-border-inset p-2.5 bg-white">
                      <legend className="bg-win-gray px-1 font-bold">Voz y Tono</legend>
                      <div className="flex flex-col gap-2 mt-1">
                         <label className="flex flex-col">
                           <span className="font-bold mb-1">Voz Local del Navegador (100% Gratuito)</span>
                           <select 
                             className="win-border-inset p-1 bg-white text-xs" 
                             value={browserVoiceURI} 
                             onChange={(e) => setBrowserVoiceURI(e.target.value)}
                           >
                             <option value="">Automático (Prioriza macOS Premium/Enhanced)</option>
                             {voices.slice().sort((a, b) => {
                               const aEs = a.lang.toLowerCase().startsWith('es');
                               const bEs = b.lang.toLowerCase().startsWith('es');
                               if (aEs && !bEs) return -1;
                               if (!aEs && bEs) return 1;
                               return a.name.localeCompare(b.name);
                             }).map(v => (
                               <option key={v.voiceURI} value={v.voiceURI}>
                                 {v.lang.toLowerCase().startsWith('es') ? '🇪🇸 ' : '🌐 '} {v.name} ({v.lang})
                               </option>
                             ))}
                           </select>
                         </label>
                      </div>
                   </fieldset>

                   <fieldset className="win-border-inset p-2.5 bg-white">
                      <legend className="bg-win-gray px-1 font-bold">Instrucciones Adicionales</legend>
                      <div className="flex flex-col gap-2 mt-1">
                         <label className="flex flex-col">
                           <span className="mb-1 text-[10px] text-gray-700">Dile a Arthur cómo debe comportarse o con qué acento hablar (ej. "Habla en español callejero latinoamericano", "Sé extremadamente sarcástico").</span>
                           <textarea 
                             className="win-border-inset p-1 resize-none h-14"
                             placeholder="Ej: Habla en español callejero latinoamericano..."
                             value={customInstructions}
                             onChange={(e) => {
                               setCustomInstructions(e.target.value);
                               localStorage.setItem('custom_instructions', e.target.value);
                             }}
                           />
                         </label>
                      </div>
                   </fieldset>
                </div>
                
                <div className="flex justify-end mt-1 pt-2 border-t border-gray-300">
                   <button className="win-btn font-bold px-6 py-1" onClick={() => closeWindow('settings')}>Aceptar</button>
                </div>
             </div>
        </WinWindow>
        )}

        {isAnalyzerOpen && !minimizedWindows.includes('analyzer') && (
          <WinWindow 
             id="analyzer" title="UX ANALyzer (Tóxico Mode)" icon={<Terminal size={12}/>}
             isActive={activeWindow === 'analyzer'} onFocus={() => setActiveWindow('analyzer')}
             onClose={() => closeWindow('analyzer')}
             onMinimize={() => minimizeWindow('analyzer')}
             defaultPosition={{x: 140, y: 30}} width={600} height={520}
             className={isEnraged ? 'animate-rage border-4 border-red-500' : ''}
          >
             <ArthurChat 
               onAnalyze={handleAnalyzeCritique} 
               isLoading={isLoading} 
               messages={messages} 
               onClear={handleClearHistory}
               onSpeak={speakText}
               onStopSpeaking={stopSpeaking}
               isSpeaking={isSpeaking}
               onEnrage={() => {
                 setIsEnraged(true);
                 setTimeout(() => setIsEnraged(false), 500);
               }}
               customInstructions={customInstructions}
               onLocalInsult={triggerLocalArthurInsult}
               customGeminiKey={customGeminiKey} freeChatsCount={freeChatsCount}
               onSaveGeminiKey={(key) => {
                 setCustomGeminiKey(key);
                 sessionStorage.setItem('custom_gemini_key', key);
               }}
             />
          </WinWindow>
        )}

        {/* Footer Credit Tag "Hecho por Yorch" */}
        <div 
          className="absolute bottom-3 right-4 select-none pointer-events-none text-white font-bold text-xs tracking-wider z-0 opacity-90 font-mono"
          style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,1)' }}
        >
          Hecho por Yorch
        </div>

        {showWelcomeModal && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center z-[9999] p-4 select-none">
            <div className="w-[450px] max-w-full xp-window xp-window-active flex flex-col font-win text-black">
              {/* Title Bar */}
              <div className="win-titlebar">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span className="bg-white/20 p-0.5 rounded-sm">
                    <Info size={14} className="text-white" />
                  </span>
                  <span>El ANALyzer - Bienvenido</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    type="button" 
                    className="xp-btn-close flex items-center justify-center font-bold text-xs text-center" 
                    onClick={() => {
                      setShowWelcomeModal(false);
                    }}
                    title="Cerrar"
                  >
                    r
                  </button>
                </div>
              </div>

              {/* Window Content */}
              <div className="p-4 flex flex-col gap-4 bg-[#ece9d8] text-xs leading-relaxed win-border-outset flex-1 select-text">
                <div className="flex gap-4">
                  {/* Giant Info Icon styled with XP Blue Outline */}
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-blue-100 border-2 border-blue-600 shadow-md">
                    <Info size={28} className="text-[#0054e3]" />
                  </div>
                  <div className="flex-1 flex flex-col gap-2.5">
                    <h2 className="text-sm font-extrabold text-[#0054e3] tracking-wide font-sans">
                      Bienvenido al canal de Yorch y El ANALyzer
                    </h2>
                    
                    <p className="text-gray-900 font-medium">
                      Esta es mi herramienta predilecta para <strong className="text-red-700 font-bold">criticar sitios web de una forma soez</strong>, directa y sin filtros (nuestro querido <strong className="text-blue-900">Tóxico Mode</strong>). ¡Un baño de realidad para tu UX/UI!
                    </p>

                    <p className="text-gray-900">
                      Mi canal de YouTube trata sobre <strong className="font-bold">UX y UI, Dirección de Producto</strong> y cómo aprender a usar la <strong className="font-semibold text-emerald-800">Inteligencia Artificial</strong> en el proceso de diseño para dominar el sector.
                    </p>
                  </div>
                </div>

                {/* Nice boxed link panel */}
                <fieldset className="win-border-inset p-3 bg-white mt-1">
                  <legend className="bg-[#ece9d8] px-1.5 font-bold text-gray-700 flex items-center gap-1 select-none">
                    <Youtube size={12} className="text-red-600 fill-red-600" /> Canal de YouTube Oficial
                  </legend>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-gray-600 font-medium">Aprende diseño de producto real con IA:</span>
                    <a 
                      href="https://www.youtube.com/@Yorch.Design" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-700 hover:text-blue-900 hover:underline font-extrabold flex items-center gap-1 text-[11px] w-fit"
                    >
                      <span>👉 youtube.com/@Yorch.Design</span>
                    </a>
                  </div>
                </fieldset>

                {/* Checkbox "No volver a mostrar" and Aceptar Button */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-350 select-none">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-gray-850 font-semibold text-[11px]">
                    <input 
                      type="checkbox" 
                      className="accent-[#0054e3] w-4 h-4 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) {
                          localStorage.setItem('hide_welcome_modal', 'true');
                        } else {
                          localStorage.removeItem('hide_welcome_modal');
                        }
                      }}
                    />
                    <span>No volver a mostrar</span>
                  </label>

                  <button 
                    type="button" 
                    className="win-btn font-bold px-6 py-1 select-none shrink-0 text-xs min-w-[90px]" 
                    style={{ textShadow: 'none' }}
                    onClick={() => {
                      setShowWelcomeModal(false);
                    }}
                  >
                    Aceptar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Taskbar */}
      <div 
        className="h-9 flex items-center gap-1 z-50 text-white select-none overflow-hidden relative border-t border-[#0d2e80]"
        style={{
          background: 'linear-gradient(to bottom, #245dd7 0%, #2f74e7 12%, #225ad5 85%, #184dbd 100%)',
          boxShadow: '0 -2px 5px rgba(0,0,0,0.2)'
        }}
      >
        <button 
          type="button"
          className="font-bold flex items-center gap-1.5 italic text-white px-4 h-full shrink-0"
          style={{
            background: 'linear-gradient(to bottom, #388a10 0%, #61b812 10%, #4cb813 15%, #388a10 85%, #235208 100%)',
            borderRight: '1.5px solid #1e3a07',
            borderTopRightRadius: '14px',
            borderBottomRightRadius: '14px',
            boxShadow: 'inset 0px 1.5px 2px rgba(255, 255, 255, 0.45), 1px 0 3px rgba(0,0,0,0.3)',
            textShadow: '1px 1.5px 1px #153006',
            cursor: 'pointer'
          }}
          onClick={() => {
            playXpBootSound();
            alert("UX ANALyzer - El Dios del UX en edición Windows XP Luna.");
          }}
        >
          {/* XP start logo flag */}
          <div className="grid grid-cols-2 gap-0.5 w-3 h-3 scale-110 mr-0.5 relative top-[-0.5px]">
            <div className="bg-[#f05026] w-1.5 h-1.5 rounded-sm"></div>
            <div className="bg-[#3cb813] w-1.5 h-1.5 rounded-sm"></div>
            <div className="bg-[#03a9f4] w-1.5 h-1.5 rounded-sm"></div>
            <div className="bg-[#ffeb3b] w-1.5 h-1.5 rounded-sm"></div>
          </div>
          <span className="text-xs tracking-wider not-italic font-extrabold pr-0.5 lowercase text-white">start</span>
        </button>

        <div className="h-full w-0.5 bg-[#1748b5] border-r border-[#3a7fe4]"></div>

        <div className="flex items-center gap-1.5 flex-1 px-2 h-full py-1 overflow-hidden">
          {openWindows.map(w => {
            const isPressed = activeWindow === w && !minimizedWindows.includes(w);
            return (
              <button 
                key={w} 
                type="button"
                onClick={() => toggleWindowMinimizeRestore(w)} 
                className="text-left flex items-center px-2.5 min-w-28 max-w-44 text-white text-[11px] font-bold rounded-sm h-7 cursor-pointer"
                style={isPressed ? {
                  background: '#193f93',
                  border: '1px solid #112d6a',
                  boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.45)'
                } : {
                  background: 'linear-gradient(to bottom, #3c82eb 0%, #2968db 15%, #1c5dc7 85%, #103ba3 100%)',
                  border: '1px solid #17429b',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25)'
                }}
              >
                <div className="w-full truncate drop-shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 inline-block"></span>
                  {w === 'analyzer' ? 'UX ANALyzer' : 'Panel de ...'}
                </div>
              </button>
            );
          })}
        </div>

        <div 
          className="px-3.5 flex items-center justify-center h-full text-white font-mono text-[11px] select-none shrink-0"
          style={{
            background: 'linear-gradient(to bottom, #0c4dc5 0%, #0d46b5 100%)',
            borderLeft: '1px solid #092e80',
            color: '#def0ff',
            boxShadow: 'inset 1.5px 0px 1px rgba(255, 255, 255, 0.15)'
          }}
        >
          {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    </div>
  );
}
