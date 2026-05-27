import { useState, useRef, ChangeEvent, FormEvent, useEffect } from 'react';
import { Upload, Volume2, CheckCircle } from 'lucide-react';
import { ChatMessage, Critique } from '../types';
import ReactMarkdown from 'react-markdown';

interface ArthurChatProps {
  onAnalyze: (prompt: string, imageBase64: string | null, mimeType: string | null) => void;
  isLoading: boolean;
  messages: ChatMessage[];
  onClear: () => void;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  isSpeaking: boolean;
  onEnrage?: () => void;
  customInstructions?: string;
  onLocalInsult?: (userText: string, insultText: string) => void;
  customGeminiKey: string;
  onSaveGeminiKey: (key: string) => void;
  freeChatsCount: number;
}

export default function ArthurChat({ 
  onAnalyze, 
  isLoading, 
  messages, 
  onClear, 
  onSpeak, 
  onStopSpeaking,
  isSpeaking, 
  onEnrage, 
  customInstructions, 
  onLocalInsult,
  customGeminiKey,
  onSaveGeminiKey,
  freeChatsCount
}: ArthurChatProps) {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gemini API Key setup state
  const [tempKey, setTempKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showWarning, setShowWarning] = useState(true);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const processFile = (file: File) => {
    // 1. PDF File restriction
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (onLocalInsult) {
        onLocalInsult(
          `Subió un archivo PDF: ${file.name}`,
          "¡¿Un PDF?! ¡¿Acaso crees que tengo cara de secretario o de mesa de partes para estar abriendo reportes corporativos aburridos o manuales de microondas?! ¡Bota esa cojudez a la basura de una vez! Sube una captura de pantalla (PNG, JPG) de tu diseño, animal, ¡no me hagas perder el tiempo! [VOMITO]"
        );
      } else {
        alert("Solo imágenes, por favor. No me jodas con PDFs.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Heavy File weight limit (1MB)
    if (file.size > 1024 * 1024) { // 1 MB
      if (onLocalInsult) {
        onLocalInsult(
          `Subió una imagen pesada: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
          "¡¿Más de 1 MB?! ¡Oye, huachafo, ¿acaso tu página está cargada de scripts pesados de Angular del 2012 que pesa una tonelada?! Máximo 1 MB, desecha esa porquería pesada de Wilson, comprímela bien antes de mandármelo, ¡no me satures el servidor con imágenes gigantes!"
        );
      } else {
        alert("Archivo demasiado pesado (máximo 1 MB).");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. Image validation fallback
    if (!file.type.startsWith('image/')) {
      alert("Solo imágenes, por favor. No me jodas con otros formatos ranciados.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = compressedDataUrl.split(',')[1];
          setSelectedImage(base64Data);
          setImageMime('image/jpeg');
        } else {
          const result = event.target?.result as string;
          const base64Data = result.split(',')[1];
          setSelectedImage(base64Data);
          setImageMime(file.type);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImageMime(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!inputText.trim() && !selectedImage) return;
    onAnalyze(inputText, selectedImage, imageMime);
    setInputText('');
    removeImage();
  };

  const handleSpeakRoast = (critique: Critique) => {
    if (isSpeaking) {
      onStopSpeaking();
      return;
    }
    if (critique.is_chat) {
      onSpeak(critique.chat_response || '');
      return;
    }
    const roastsText = (critique.roasts || []).map(r => `${r.title}. ${r.roast} ${r.remedio}`).join('. ');
    onSpeak(`${critique.suspiro}. ${roastsText}. ${critique.veredicto}`);
  };

  const freeLimitExceeded = !customGeminiKey && freeChatsCount >= 25;

  if (freeLimitExceeded) {
    const handleSaveKey = (e: FormEvent) => {
      e.preventDefault();
      if (!tempKey.trim()) {
        setErrorText('Por favor, ingresa una clave de API de Gemini válida para continuar.');
        return;
      }
      if (!tempKey.trim().startsWith('AIzaSy')) {
        setErrorText('Las claves de Gemini válidas de Google suelen empezar con "AIzaSy". Por favor, verifica tu clave.');
        return;
      }
      setErrorText('');
      onSaveGeminiKey(tempKey.trim());
    };

    return (
      <div className="flex flex-col h-full bg-[#d4d0c8] text-black font-win text-xs select-none">
        {/* Header segment of the installation window */}
        <div className="bg-[#a80000] text-white font-bold p-1.5 px-2 flex justify-between items-center select-none">
          <span className="flex items-center gap-1">🚨 CRITICAL_LIMIT_EXCEEDED.EXE - Cuota Agotada</span>
          <span className="font-mono text-[10px]">Error 429</span>
        </div>

        <div className="flex flex-1 min-h-0 bg-white border border-gray-400 m-2 flex-col md:flex-row">
          {/* Left classic red-orange gradient panel of Windows error setup */}
          <div className="w-full md:w-1/3 bg-gradient-to-b from-[#800000] to-[#e4a0a0] p-4 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
            <div>
              <h2 className="text-lg font-bold tracking-tight mb-2">Cuota Bloqueada</h2>
              <p className="text-[10px] text-[#fbf0f0] leading-tight font-mono">SE DETECTARON DEMASIADOS ROASTS GRATUITOS.</p>
            </div>
            
            {/* Retro icon decorations */}
            <div className="font-mono text-[56px] opacity-15 absolute -bottom-3 -right-3 select-none leading-none">
              🔥
            </div>
            
            <div className="text-[9px] text-[#fbf0f0] font-mono mt-8 md:mt-0 select-none">
              LIMIT OVERFLOW<br />
              LOCKOUT CODE 95
            </div>
          </div>

          {/* Right interactive panel with key fields and directions */}
          <div className="flex-1 p-4 flex flex-col justify-between overflow-y-auto">
            <div className="flex flex-col gap-3">
              <h1 className="text-sm font-bold text-black border-b border-gray-300 pb-1.5 flex items-center gap-1.5">
                <span>☠️</span> ¡Cuota Gratuita Agotada!
              </h1>
              
              {/* Highlighted Warning message required */}
              <div className="bg-[#fff3cd] border-2 border-[#ffc107] p-3 text-[11.5px] text-black leading-normal flex items-start gap-2.5" style={{ boxShadow: '2px 2px 0px #000' }}>
                <span className="text-2xl pt-0.5 select-none shrink-0">🐒</span>
                <div>
                  <p className="font-bold text-red-800 leading-snug">
                    "Sobrepasaste la cuota gratuita de Gemini, no seas pendejo, pon tu propia API Key para poder seguir chateando conmigo"
                  </p>
                </div>
              </div>

              <div className="bg-[#f0f0f0] win-border-inset p-2.5 mt-1 flex flex-col gap-1 text-[10px] leading-snug">
                <span className="font-bold text-gray-800">🔒 TU CONEXIÓN ES PRIVADA:</span>
                <p className="text-gray-600">
                  Tu clave de API se guarda <strong>sólamente en tu navegador actual (sessionStorage)</strong>. Arthur no la almacena en sus servidores.
                </p>
              </div>

              {/* Get Key block */}
              <div className="mt-1">
                <a 
                  href="https://aistudio.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="win-btn font-bold inline-flex items-center gap-1 px-2 py-1 text-blue-800 hover:text-blue-900 bg-white"
                >
                  🚀 Consultar mi Gemini API Key (100% Gratis)
                </a>
              </div>

              {/* Input section */}
              <form onSubmit={handleSaveKey} className="flex flex-col gap-1.5 mt-1">
                <label className="font-bold flex flex-col gap-1 text-[11px]">
                  <span>Introduce tu clave de API para desbloquear el Chat:</span>
                  <div className="flex gap-1">
                    <input 
                      type={showKey ? "text" : "password"} 
                      placeholder="AIzaSy..." 
                      className="win-border-inset p-1.5 flex-1 bg-white font-mono text-xs outline-none"
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowKey(!showKey)} 
                      className="win-btn font-bold px-2 shrink-0"
                    >
                      {showKey ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </label>
                {errorText && (
                  <p className="text-red-700 font-bold bg-red-100 text-[10px] p-1 border border-red-400 mt-0.5">
                    ⚠️ {errorText}
                  </p>
                )}
              </form>
            </div>

            {/* Bottom standard buttons */}
            <div className="border-t border-gray-300 pt-3 mt-4 flex justify-end gap-2 shrink-0">
              <button disabled className="win-btn text-gray-400 cursor-not-allowed px-4 py-1">
                &lt; Atrás
              </button>
              <button onClick={handleSaveKey} className="win-btn font-bold px-4 py-1">
                Desbloquear &gt;
              </button>
              <button 
                type="button" 
                onClick={() => alert("Debes ingresar tu propia clave de API de Gemini para poder seguir usando el UX Analyzer gratis.")} 
                className="win-btn px-4 py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full font-win text-black">
      {/* Action bar menu simulated */}
      <div className="flex items-center justify-between border-b border-gray-400 pb-1 mb-1 gap-2 flex-wrap">
        <div className="flex gap-2 items-center">
          <button onClick={onClear} className="win-btn">Limpiar Historial</button>
          {customInstructions && customInstructions.trim() && (
            <div className="text-[11px] bg-yellow-100 border border-yellow-400 px-2 py-0.5 rounded flex items-center gap-1 text-gray-800 self-center">
              <span>✨</span>
              <span className="font-bold">Modo:</span> 
              <span className="truncate max-w-[120px] sm:max-w-[170px]" title={customInstructions}>"{customInstructions}"</span>
            </div>
          )}
        </div>
      </div>

      {/* Warning Alert about Web Links Limitation */}
      {showWarning && (
        <div className="bg-[#ffffe1] border border-gray-400 p-2 text-[11px] leading-relaxed flex items-start gap-2 text-black select-none relative pr-8" style={{ boxShadow: 'inset -1px -1px #fff, inset 1px 1px #808080' }}>
          <span className="text-sm shrink-0">⚠️</span>
          <div className="flex-1">
            <span className="font-bold text-red-700">Aviso sobre enlaces:</span> Arthur <strong>no puede leer ni analizar páginas web activas o URLs externas de forma directa</strong>. En su lugar, es mucho mejor que tomes una <strong>captura de pantalla (PNG/JPG)</strong> del flujo, menú o sección que deseas criticar, la subas usando el botón <strong>Adjuntar</strong> y le preguntes sobre ella.
          </div>
          <button 
            type="button"
            onClick={() => setShowWarning(false)} 
            className="absolute top-1.5 right-1.5 win-btn font-bold text-[9px] w-4 h-4 flex items-center justify-center p-0"
            title="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Messages Feed */}
      <div className="win-border-inset bg-white flex-1 overflow-y-auto p-2" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-gray-500 italic text-center mt-4">Esperando enviar diseño a análisis...</div>
        ) : (
          <div className="flex flex-col gap-3 font-win">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="text-[10px] text-gray-500 mb-0.5">{msg.role === 'user' ? 'Tú' : 'Arthur Vance'} - {msg.timestamp}</div>
                
                {msg.role === 'user' ? (
                  <div className="bg-[#d4d0c8] win-border-outset p-2 max-w-[80%] text-left">
                    {msg.image && (
                      <img src={msg.image} alt="User upload" className="max-w-[200px] mb-2 border border-gray-500" />
                    )}
                    <div>{msg.content}</div>
                  </div>
                ) : (
                  <div className={`${msg.critique?.es_bueno ? 'bg-[#e0ffe0]' : 'bg-[#ffffe1]'} win-border-outset p-2 w-[95%] text-left`}>
                    {msg.critique ? (
                      msg.critique.is_chat ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center bg-gray-200 border border-gray-400 p-1">
                            <h3 className="font-bold flex items-center gap-1">🔊 Arthur Vance (Tío UX) {msg.critique.es_bueno && '✨'}</h3>
                            <div className="flex gap-1">
                              <button type="button" onClick={() => onEnrage && onEnrage()} className="win-btn font-bold text-red-600 px-2" title="Enojarse">🤬</button>
                              <button type="button" onClick={() => handleSpeakRoast(msg.critique!)} className={`win-btn flex items-center gap-1 ${isSpeaking ? 'bg-gray-400' : ''}`}>
                                 <Volume2 size={12}/> {isSpeaking ? "Silenciar" : "Oír"}
                              </button>
                            </div>
                          </div>
                          <div className="font-win text-[12px] leading-relaxed text-black whitespace-pre-wrap">
                            {msg.critique.chat_response?.replace(/\[V[OÓ]MITO\]/gi, '🤮').replace(/\[PEDO\]/gi, '💨').replace(/\[LLANTO\]/gi, '😭').replace(/\[RISA\]/gi, '😂').replace(/\[MILAGRO\]/gi, '🙌')}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center bg-gray-200 border border-gray-400 p-1">
                            <h3 className="font-bold flex items-center gap-1">🔊 Analysis Output {msg.critique.es_bueno && '✨'}</h3>
                            <div className="flex gap-1">
                              <button type="button" onClick={() => onEnrage && onEnrage()} className="win-btn font-bold text-red-600 px-2" title="Enojarse">🤬</button>
                              <button type="button" onClick={() => handleSpeakRoast(msg.critique!)} className={`win-btn flex items-center gap-1 ${isSpeaking ? 'bg-gray-400' : ''}`}>
                                 <Volume2 size={12}/> {isSpeaking ? "Silenciar" : "Oír Roast"}
                              </button>
                            </div>
                          </div>

                          <div className="font-win text-[12px] leading-relaxed text-black">
                             <div className="mb-4 italic text-gray-800 text-[11px]">"{msg.critique.suspiro.replace(/\[V[OÓ]MITO\]/gi, '🤮').replace(/\[PEDO\]/gi, '💨').replace(/\[LLANTO\]/gi, '😭').replace(/\[RISA\]/gi, '😂').replace(/\[MILAGRO\]/gi, '🙌')}"</div>
                             
                             {msg.critique.roasts && msg.critique.roasts.length > 0 && (
                               <div className="flex flex-col gap-2">
                                 {msg.critique.roasts.map((roast, idx) => (
                                   <div key={idx} className={`${msg.critique?.es_bueno ? 'bg-white' : 'bg-white'} win-border-inset p-2`}>
                                     <div className={`font-bold ${msg.critique?.es_bueno ? 'text-green-800' : 'text-red-800'} border-b border-gray-300 pb-1 mb-1`}>
                                       [{roast.pilar}] {roast.title}
                                     </div>
                                     <div className="mb-2 text-black">
                                       <span className="font-bold text-gray-700">Roast: </span> 
                                       {roast.roast.replace(/\[V[OÓ]MITO\]/gi, '🤮').replace(/\[PEDO\]/gi, '💨').replace(/\[LLANTO\]/gi, '😭').replace(/\[RISA\]/gi, '😂').replace(/\[MILAGRO\]/gi, '🙌')}
                                     </div>
                                     <div className={`${msg.critique?.es_bueno ? 'bg-[#f0fff0]' : 'bg-[#ffffe1]'} p-1 border border-gray-300`}>
                                       <span className="font-bold text-green-700">La Cura: </span>
                                       <span>{roast.remedio.replace(/\[V[OÓ]MITO\]/gi, '🤮').replace(/\[PEDO\]/gi, '💨').replace(/\[LLANTO\]/gi, '😭').replace(/\[RISA\]/gi, '😂').replace(/\[MILAGRO\]/gi, '🙌')}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}

                             <div className="mt-4 pt-2 border-t border-dashed border-gray-400">
                               <span className="font-bold text-red-700">VEREDICTO: </span> 
                               <span className="font-bold uppercase">"{msg.critique.veredicto.replace(/\[V[OÓ]MITO\]/gi, '🤮').replace(/\[PEDO\]/gi, '💨').replace(/\[LLANTO\]/gi, '😭').replace(/\[RISA\]/gi, '😂').replace(/\[MILAGRO\]/gi, '🙌')}"</span>
                             </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div>{msg.content}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="text-[10px] text-gray-500 mb-0.5">Arthur Vance - Escribiendo...</div>
                <div className="bg-[#ffffe1] win-border-outset p-2 max-w-[80%] italic">
                  Analizando el desastre...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-1">
        {/* Upload box */}
        <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="win-btn flex items-center gap-1">
              <Upload size={12}/> Adjuntar...
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" multiple={false} className="hidden" />
            <span className="text-gray-600 italic">
              {selectedImage ? '1 imagen lista' : ''}
            </span>
            {selectedImage && (
              <button type="button" onClick={removeImage} className="win-btn px-1 ml-auto">X Remover</button>
            )}
        </div>

        {/* Input Text Box */}
        <div className="flex gap-2 h-14">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribe tu mensaje para el consultorio..."
            className="win-border-inset flex-1 px-2 py-1 outline-none resize-none h-full"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button type="submit" disabled={isLoading || (!inputText.trim() && !selectedImage)} className="win-btn px-4 font-bold flex flex-col items-center justify-center h-full">
            <span>Enviar</span>
          </button>
        </div>
      </form>
    </div>
  );
}
