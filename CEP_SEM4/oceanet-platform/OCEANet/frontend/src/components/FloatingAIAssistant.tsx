'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Minus, MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/utils/api';
import { TypingIndicator } from '@/components/Animations';

const OPEN_STATE_STORAGE_KEY = 'nerexis:floating-ai-open';
const OPEN_EVENT_NAME = 'nerexis:open-ai-workspace';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  type: 'assistant',
  content:
    "Hi, I'm Nerexis AI. Ask me about ocean science, climate, marine biodiversity, and environmental insights.",
  timestamp: new Date(),
};

function normalizeAssistantText(content: string): string {
  return content
    .replace(/\u00A0/g, ' ')
    .replace(/Â·/g, ' - ')
    .replace(/â€¢/g, '- ')
    .replace(/â€”/g, ' - ')
    .replace(/â€¦/g, '...')
    .replace(/[^\S\r\n]{2,}/g, ' ')
    .trim();
}

function formatMessageTime(timestamp: Date): string {
  const hours = timestamp.getHours();
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const hour12 = String(((hours + 11) % 12) + 1).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${suffix}`;
}

export default function FloatingAIAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const previousAssistantCountRef = useRef(1);
  const hasInteractedRef = useRef(false);

  const shouldHide = useMemo(() => pathname === '/sign-in' || pathname === '/ai-assistant', [pathname]);

  const playNotificationSound = useCallback(() => {
    if (!hasInteractedRef.current || typeof window === 'undefined') return;

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const audioContext = new AudioContextCtor();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.22);
      oscillator.onended = () => {
        void audioContext.close();
      };
    } catch {
      // Ignore audio errors (autoplay restrictions or unsupported API).
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedOpenState = window.localStorage.getItem(OPEN_STATE_STORAGE_KEY);
      if (savedOpenState === 'true') {
        setIsOpen(true);
      }
    } catch {
      // Ignore storage read errors.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(OPEN_STATE_STORAGE_KEY, String(isOpen));
    } catch {
      // Ignore storage write errors.
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const openWorkspace = () => {
      hasInteractedRef.current = true;
      setIsOpen(true);
    };

    window.addEventListener(OPEN_EVENT_NAME, openWorkspace);
    return () => window.removeEventListener(OPEN_EVENT_NAME, openWorkspace);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const assistantCount = messages.reduce((count, item) => count + (item.type === 'assistant' ? 1 : 0), 0);
    if (assistantCount > previousAssistantCountRef.current) {
      const incomingAssistantMessages = assistantCount - previousAssistantCountRef.current;
      if (!isOpen) {
        setUnreadCount((prev) => prev + incomingAssistantMessages);
        playNotificationSound();
      }
    }
    previousAssistantCountRef.current = assistantCount;
  }, [isOpen, messages, playNotificationSound]);

  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      setUnreadCount(0);
    }
  }, [isOpen, unreadCount]);

  useEffect(() => {
    if (!isOpen) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages, isLoading]);

  const sendMessage = useCallback(async () => {
    hasInteractedRef.current = true;
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      type: 'user',
      content: text,
      timestamp: new Date(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const history = nextMessages.slice(-12).map((item) => ({
        role: item.type === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      }));

      const response = await apiFetch('/ai/chat', {
        method: 'POST',
        timeoutMs: 30000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          type: 'assistant',
          content: normalizeAssistantText(data.reply || 'I could not generate a response right now.'),
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          type: 'assistant',
          content:
            error instanceof TypeError
              ? 'Unable to reach the AI backend. Please ensure the backend is running on port 8000.'
              : error instanceof Error
                ? error.message
                : 'Something went wrong while generating the response.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, messages]);

  if (shouldHide) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 right-4 z-[70] w-[calc(100vw-2rem)] max-w-sm sm:right-6"
          >
            <div className="glass overflow-hidden rounded-2xl border border-white/20 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-cyan to-teal px-4 py-3 text-white">
                <div className="flex min-w-0 items-center gap-2">
                  <Bot size={16} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Nerexis AI</p>
                    <p className="truncate text-[11px] text-white/85">Floating assistant</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-md p-1.5 text-white/90 hover:bg-white/20"
                    title="Minimize"
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setMessages([INITIAL_MESSAGE]);
                      setIsOpen(false);
                    }}
                    className="rounded-md p-1.5 text-white/90 hover:bg-white/20"
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="h-[380px] overflow-y-auto bg-white/70 p-3">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          message.type === 'user'
                            ? 'rounded-br-sm bg-gradient-to-br from-cyan to-teal font-medium text-white'
                            : 'rounded-bl-sm border border-white/30 bg-white text-text-primary'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <p className={`mt-1 text-[10px] ${message.type === 'user' ? 'text-white/80' : 'text-text-secondary/80'}`}>
                          {formatMessageTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-sm border border-white/30 bg-white px-3 py-2">
                        <TypingIndicator />
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              </div>

              <div className="border-t border-white/20 bg-white/85 p-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask Nerexis AI..."
                    disabled={isLoading}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/70 focus:border-cyan focus:outline-none disabled:opacity-60"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan to-teal text-white disabled:cursor-not-allowed disabled:opacity-50"
                    title="Send"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        onClick={() => {
          hasInteractedRef.current = true;
          setIsOpen((prev) => !prev);
        }}
        className="fixed bottom-5 right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-teal text-white shadow-[0_18px_38px_rgba(15,23,42,0.28)] transition-transform hover:scale-105 sm:right-6"
        aria-label="Toggle AI assistant"
      >
        <MessageCircle size={22} />
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
