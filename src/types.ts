export interface RoastItem {
  title: string;
  pilar: string;
  roast: string;
  remedio: string;
}

export interface Critique {
  es_bueno: boolean;
  suspiro: string;
  roasts: RoastItem[];
  veredicto: string;
  is_chat?: boolean;
  chat_response?: string;
}

export interface PresetDisaster {
  id: string;
  name: string;
  url?: string;
  description: string;
  category: string;
  imageUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  critique?: Critique;
  image?: string;
  timestamp: string;
}
