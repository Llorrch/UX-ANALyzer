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
  const [engine, setEngine] = useState<string>('browser');
  const [lang, setLang] = useState<string>('es-419');
  const [voiceName, setVoiceName] = useState<string>('Puck');
  const [browserVoiceURI, setBrowserVoiceURI] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

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

      if (engine === 'browser' && 'speechSynthesis' in window) {
        return new Promise<void>((resolve) => {
           const utterance = new SpeechSynthesisUtterance(cleanText);
           utterance.rate = 1.1;
           const voicesList = window.speechSynthesis.getVoices();
           let selectedVoice = voicesList.find(v => v.voiceURI === browserVoiceURI);
           
           console.log("TTS Browser Mode - Selected Voice URI:", browserVoiceURI);
           
           if (!selectedVoice) {
             // Prioritize macOS premium/enhanced voices for Spanish
             const macPremium = voicesList.find(v => v.lang.toLowerCase().startsWith('es') && (v.name.includes('Premium') || v.name.includes('Enhanced') || ['Monica', 'Paulina', 'Jorge', 'Diego'].some(n => v.name.includes(n))));
             selectedVoice = macPremium || voicesList.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase())) || voicesList.find(v => v.lang.toLowerCase().startsWith('es-')) || voicesList[0];
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
      
      // Split into logically complete sentences/phrases
      const sentences = cleanText
        .split(/[.!?；;:]+/)
        .map(s => s.trim())
        .filter(s => s.length > 2);

      if (sentences.length === 0) return;

      setIsSpeaking(true);

      const audioBuffers: { [index: number]: AudioBuffer } = {};
      const fetchPromiseCache: { [index: number]: Promise<AudioBuffer | null> } = {};

      const fetchSentenceBuffer = (index: number): Promise<AudioBuffer | null> => {
        if (index >= sentences.length) return Promise.resolve(null);
        if (audioBuffers[index]) return Promise.resolve(audioBuffers[index]);
        if (fetchPromiseCache[index]) return fetchPromiseCache[index];

        const promise = (async () => {
          try {
            const response = await fetch('/api/speak', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ textToSpeak: sentences[index] + '.', voiceName, engine, lang })
            });

            if (!response.ok) return null;
            const data = await response.json();
            if (!data.audio || !globalAudioContext) return null;

            const binaryString = atob(data.audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const audioBuffer = await globalAudioContext.decodeAudioData(bytes.buffer);
            audioBuffers[index] = audioBuffer;
            return audioBuffer;
          } catch (e) {
            console.error(`Error decoding audio for sentence ${index}:`, e);
            return null;
          }
        })();

        fetchPromiseCache[index] = promise;
        return promise;
      };

      // Prefetch the first two sentences immediately for ultra fast starting
      fetchSentenceBuffer(0);
      if (sentences.length > 1) {
        fetchSentenceBuffer(1);
      }

      // Sequential playback chain
      for (let i = 0; i < sentences.length; i++) {
        if (mySessionId !== currentSpeechSessionId) return;

        const buffer = await fetchSentenceBuffer(i);
        if (!buffer) continue;

        if (mySessionId !== currentSpeechSessionId) return;

        // Prefetch upcoming sentences
        if (i + 1 < sentences.length) {
          fetchSentenceBuffer(i + 1);
        }
        if (i + 2 < sentences.length) {
          fetchSentenceBuffer(i + 2);
        }

        await new Promise<void>((resolve) => {
          if (mySessionId !== currentSpeechSessionId || !globalAudioContext) {
            resolve();
            return;
          }

          const source = globalAudioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(globalAudioContext.destination);
          source.onended = () => {
            resolve();
          };

          currentAudioSource = source;
          source.start(0);
        });
      }

      if (mySessionId === currentSpeechSessionId) {
        setIsSpeaking(false);
      }

    } catch (e) {
      console.error("Speech Synthesis Error:", e);
      setIsSpeaking(false);
    }
  }, [voiceName, engine, lang, browserVoiceURI]);

  const handleClearHistory = () => {
    setMessages([]);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    currentSpeechSessionId++;
    if (currentAudioSource) {
      try { currentAudioSource.stop(); } catch(e) {}
      currentAudioSource = null;
    }
    setIsSpeaking(false);
  };

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
      const response = await fetch('/api/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image: imageBase64, mimeType, customInstructions })
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
    setActiveWindow(id);
  };

  const closeWindow = (id: WindowId) => {
    setOpenWindows(openWindows.filter(w => w !== id));
    if (activeWindow === id) {
       const remaining = openWindows.filter(w => w !== id);
       setActiveWindow(remaining.length > 0 ? remaining[0] : null as any);
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
            <span className={`text-white text-center font-bold text-[11px] leading-tight px-1 ${activeWindow === 'analyzer' ? 'bg-blue-800 border-dotted border border-white' : ''}`} style={{ textShadow: '1px 1px 1px black' }}>UX_Analyzer</span>
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
        {openWindows.includes('settings') && (
          <WinWindow 
             id="settings" title="Panel de Control - Tío UX" icon={<Settings size={12} />}
             isActive={activeWindow === 'settings'} onFocus={() => setActiveWindow('settings')}
             onClose={() => closeWindow('settings')}
             defaultPosition={{x: 50, y: 50}} width={400} height={350}
          >
             <div className="p-4 bg-win-gray h-full flex flex-col gap-4 text-black text-sm">
                <div className="flex items-center gap-2 mb-2">
                   <Volume2 size={32} className="text-gray-700" />
                   <h2 className="font-bold text-lg">Opciones de Voz e Idioma</h2>
                </div>
                
                <fieldset className="win-border-inset p-3 bg-white">
                   <legend className="bg-win-gray px-1 font-bold">Voz y Tono</legend>
                   <div className="flex flex-col gap-3 mt-2">
                      <label className="flex flex-col">
                        <span className="font-bold mb-1">Motor TTS</span>
                        <select 
                          className="win-border-inset p-1 bg-white" 
                          value={engine} 
                          onChange={(e) => setEngine(e.target.value)}
                        >
                          <option value="google">Google Básico / Cloud (Gratis o Premium si hay API Key)</option>
                          <option value="gemini">Gemini Premium (Más lento, Alta Calidad)</option>
                          <option value="browser">Navegador Local (Instantáneo, Web Speech API)</option>
                        </select>
                      </label>
                      
                      {engine === 'gemini' && (
                        <label className="flex flex-col">
                          <span className="font-bold mb-1">Modelo de Voz (Gemini TTS)</span>
                          <select 
                            className="win-border-inset p-1 bg-white" 
                            value={voiceName} 
                            onChange={(e) => setVoiceName(e.target.value)}
                          >
                            <option value="Puck">Puck (Masculino, Profundo)</option>
                            <option value="Charon">Charon (Masculino, Grave)</option>
                            <option value="Fenrir">Fenrir (Masculino)</option>
                            <option value="Aoede">Aoede (Femenino)</option>
                            <option value="Kore">Kore (Femenino)</option>
                          </select>
                        </label>
                      )}

                      {engine === 'google' && (
                        <label className="flex flex-col">
                          <span className="font-bold mb-1">Acento (Google TTS)</span>
                          <select 
                            className="win-border-inset p-1 bg-white" 
                            value={lang} 
                            onChange={(e) => setLang(e.target.value)}
                          >
                            <option value="es-419">Latinoamericano Neutral</option>
                            <option value="es-ES">España</option>
                            <option value="es-MX">México</option>
                            <option value="es-AR">Argentina</option>
                            <option value="es-US">Estados Unidos (Español)</option>
                          </select>
                        </label>
                      )}

                      {engine === 'browser' && (
                        <label className="flex flex-col">
                          <span className="font-bold mb-1">Voz Local del Navegador</span>
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
                      )}
                   </div>
                </fieldset>

                <fieldset className="win-border-inset p-3 bg-white flex-1">
                   <legend className="bg-win-gray px-1 font-bold">Instrucciones Adicionales</legend>
                   <div className="flex flex-col gap-2 mt-2 h-full">
                      <label className="flex flex-col h-full">
                        <span className="mb-1 text-xs text-gray-700">Dile a Arthur cómo debe comportarse o con qué acento hablar (ej. "Habla con dejo argentino", "Usa spanglish excesivo").</span>
                        <textarea 
                          className="win-border-inset p-1 resize-none h-24"
                          placeholder="Ej: Habla con acento argentino che"
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                        />
                      </label>
                   </div>
                </fieldset>
                
                <div className="flex justify-end mt-auto">
                   <button className="win-btn font-bold px-6 py-1" onClick={() => closeWindow('settings')}>Aceptar</button>
                </div>
             </div>
          </WinWindow>
        )}

        {isAnalyzerOpen && (
          <WinWindow 
             id="analyzer" title="UX_ANALYZER.EXE (Tóxico Mode)" icon={<Terminal size={12}/>}
             isActive={activeWindow === 'analyzer'} onFocus={() => setActiveWindow('analyzer')}
             onClose={() => closeWindow('analyzer')}
             defaultPosition={{x: 140, y: 30}} width={600} height={520}
             className={isEnraged ? 'animate-rage border-4 border-red-500' : ''}
          >
             <ArthurChat 
               onAnalyze={handleAnalyzeCritique} 
               isLoading={isLoading} 
               messages={messages} 
               onClear={handleClearHistory}
               onSpeak={speakText}
               isSpeaking={isSpeaking}
               onEnrage={() => {
                 setIsEnraged(true);
                 setTimeout(() => setIsEnraged(false), 500);
               }}
               customInstructions={customInstructions}
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
          {openWindows.map(w => (
            <button key={w} onClick={() => openWindow(w)} 
              className={`win-btn text-left flex items-center px-2 py-0 min-w-24 max-w-40 truncate h-6 ${activeWindow === w ? 'bg-gray-300' : ''}`}
              style={activeWindow === w ? {boxShadow: 'inset 1px 1px #000, inset -1px -1px #dfdfdf', paddingTop: 2, paddingLeft: 8} : {}}
            >
              <div className="w-full truncate">{w === 'analyzer' ? 'UX_ANALYZER' : 'Panel de ...'}</div>
            </button>
          ))}
        </div>
        <div className="win-border-inset px-2 flex flex-col justify-center h-6 mr-1 bg-win-gray text-black font-mono relative top-[1px]">
          {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    </div>
  );
}
