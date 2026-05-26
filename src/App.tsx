import { useState, useEffect, useCallback } from 'react';
import ArthurChat from './components/ArthurChat';
import WinWindow from './components/WinWindow';
import { Critique, ChatMessage } from './types';
import { Terminal, Crosshair, Swords, Globe, Settings, Volume2 } from 'lucide-react';

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

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isEnraged, setIsEnraged] = useState<boolean>(false);

  type WindowId = 'analyzer' | 'settings';
  const [openWindows, setOpenWindows] = useState<WindowId[]>(['analyzer']);
  const [activeWindow, setActiveWindow] = useState<WindowId>('analyzer');
  const [minimizedWindows, setMinimizedWindows] = useState<WindowId[]>([]);
  const [appLanguage, setAppLanguage] = useState<string>(() => localStorage.getItem('app_language') || 'es');
  const [browserVoiceURI, setBrowserVoiceURI] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
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
        
        // Auto-select a high quality Spanish voice if none is explicitly set
        setBrowserVoiceURI(prev => {
          if (prev) return prev;
          if (list.length > 0) {
            // Check macOS Siri or Premium Spanish voices
            const premiumEs = list.find(v => v.lang.toLowerCase().startsWith('es') && (v.name.includes('Premium') || v.name.includes('Enhanced') || ['Monica', 'Paulina', 'Jorge', 'Diego'].some(n => v.name.includes(n))));
            if (premiumEs) return premiumEs.voiceURI;
            
            // Check any standard Spanish voice
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
             // Prioritize macOS premium/enhanced voices for Spanish
             const macPremium = voicesList.find(v => v.lang.toLowerCase().startsWith('es') && (v.name.includes('Premium') || v.name.includes('Enhanced') || ['Monica', 'Paulina', 'Jorge', 'Diego'].some(n => v.name.includes(n))));
             selectedVoice = macPremium || voicesList.find(v => v.lang.toLowerCase().startsWith('es-')) || voicesList.find(v => v.lang.toLowerCase().startsWith('es')) || voicesList[0];
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
    <div className="w-[100dvw] h-[100dvh] flex flex-col font-win text-black" style={{ backgroundColor: '#008080' }}>
      
      {/* Desktop Area */}
      <div className="flex-1 relative overflow-hidden" onClick={() => setActiveWindow(null as any)}>
        {/* Desktop Icons */}
        <div className="flex flex-col gap-6 p-4 absolute top-0 left-0 w-32 h-full z-0">
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={(e) => {e.stopPropagation(); openWindow('analyzer')}}>
            <Terminal size={36} className={`text-white p-1 ${activeWindow === 'analyzer' ? 'bg-blue-800' : ''}`} />
            <span className={`text-white text-center font-bold text-[11px] leading-tight px-1 ${activeWindow === 'analyzer' ? 'bg-blue-800 border-dotted border border-white' : ''}`} style={{ textShadow: '1px 1px 1px black' }}>UX ANALyzer</span>
          </div>

          <div className="flex flex-col items-center gap-1 cursor-pointer mt-2" onClick={(e) => {e.stopPropagation(); openWindow('settings')}}>
            <div className={`p-1 ${activeWindow === 'settings' ? 'bg-blue-800' : ''}`}>
              <Settings size={34} className="text-white" />
            </div>
            <span className={`text-white text-center font-bold text-[11px] leading-tight px-1 ${activeWindow === 'settings' ? 'bg-blue-800 border-dotted border border-white' : ''}`} style={{ textShadow: '1px 1px 1px black' }}>Panel de Control</span>
          </div>

          <div className="mt-8"></div>

          <div className="flex flex-col items-center gap-1 cursor-pointer opacity-70">
            <Globe size={36} className="text-white p-1 fill-blue-300" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1" style={{ textShadow: '1px 1px 1px black' }}>Internet Explorer</span>
          </div>

          <div className="flex flex-col items-center gap-1 cursor-pointer opacity-70">
            <Crosshair size={36} className="text-black bg-orange-200 rounded-full p-2" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1" style={{ textShadow: '1px 1px 1px black' }}>Counter-Strike</span>
          </div>

          <div className="flex flex-col items-center gap-1 cursor-pointer opacity-70">
            <Swords size={36} className="text-yellow-400 p-1" />
            <span className="text-white text-center font-bold text-[11px] leading-tight px-1" style={{ textShadow: '1px 1px 1px black' }}>WoW TBC</span>
          </div>
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
                               setAppLanguage(e.target.value);
                               localStorage.setItem('app_language', e.target.value);
                             }}
                           >
                             <option value="es">Español (Peruvian Criollo Roast)</option>
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
                           <span className="mb-1 text-[10px] text-gray-700">Dile a Arthur cómo debe comportarse o con qué acento hablar (ej. "Habla con dejo argentino", "Usa spanglish excesivo").</span>
                           <textarea 
                             className="win-border-inset p-1 resize-none h-14"
                             placeholder="Ej: Habla con acento argentino che"
                             value={customInstructions}
                             onChange={(e) => setCustomInstructions(e.target.value)}
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
      </div>

      {/* Taskbar */}
      <div className="h-8 bg-win-gray border-t-2 border-t-[#ffffff] flex items-center px-1 gap-2 z-50 text-black">
        <button className="win-btn font-bold flex items-center gap-1 italic" style={{boxShadow: 'inset -1px -1px #000, inset 1px 1px #fff', textShadow: 'none'}}>
          <span className="text-[#ea3838]">U</span>
          <span className="text-[#39FF14]">X</span>
          <span className="text-blue-800">Inicio</span>
        </button>
        <div className="h-full w-0 border-l border-gray-400 border-r border-[#ffffff] my-[2px]"></div>
        <div className="flex items-center gap-1 flex-1 px-1 h-full py-0.5 overflow-hidden">
          {openWindows.map(w => {
            const isPressed = activeWindow === w && !minimizedWindows.includes(w);
            return (
              <button key={w} onClick={() => toggleWindowMinimizeRestore(w)} 
                className={`win-btn text-left flex items-center px-2 py-0 min-w-24 max-w-40 truncate h-6 ${isPressed ? 'bg-gray-300' : ''}`}
                style={isPressed ? {boxShadow: 'inset 1px 1px #000, inset -1px -1px #dfdfdf', paddingTop: 2, paddingLeft: 8} : {}}
              >
                <div className="w-full truncate">{w === 'analyzer' ? 'UX ANALyzer' : 'Panel de ...'}</div>
              </button>
            );
          })}
        </div>
        <div className="win-border-inset px-2 flex flex-col justify-center h-6 mr-1 bg-win-gray text-black font-mono relative top-[1px]">
          {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    </div>
  );
}
