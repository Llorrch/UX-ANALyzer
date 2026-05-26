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
  isSpeaking: boolean;
  onEnrage?: () => void;
  customInstructions?: string;
}

export default function ArthurChat({ onAnalyze, isLoading, messages, onClear, onSpeak, isSpeaking, onEnrage, customInstructions }: ArthurChatProps) {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Solo imágenes, por favor. No me jodas con otros formatos.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setSelectedImage(base64Data);
      setImageMime(file.type);
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
    if (critique.is_chat) {
      onSpeak(critique.chat_response || '');
      return;
    }
    const roastsText = (critique.roasts || []).map(r => `${r.title}. ${r.roast} ${r.remedio}`).join('. ');
    onSpeak(`${critique.suspiro}. ${roastsText}. ${critique.veredicto}`);
  };

  return (
    <div className="flex flex-col gap-2 h-full font-win text-black">
      {/* Action bar menu simulated */}
      <div className="flex items-center justify-between border-b border-gray-400 pb-1 mb-1 gap-2 flex-wrap">
        <button onClick={onClear} className="win-btn">Limpiar Historial</button>
        {customInstructions && customInstructions.trim() && (
          <div className="text-[11px] bg-yellow-100 border border-yellow-400 px-2 py-0.5 rounded flex items-center gap-1 text-gray-800 self-center">
            <span>✨</span>
            <span className="font-bold">Modo:</span> 
            <span className="truncate max-w-[170px]" title={customInstructions}>"{customInstructions}"</span>
            <span className="text-[10px] text-gray-500">(Afectará comportamiento e hilo de voz)</span>
          </div>
        )}
      </div>

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
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
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
