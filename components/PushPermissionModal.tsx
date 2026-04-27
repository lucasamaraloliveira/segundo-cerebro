'use client';

import React from 'react';
import { Bell, X } from 'lucide-react';

interface PushPermissionModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PushPermissionModal({ onConfirm, onCancel }: PushPermissionModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-black text-white border-2 border-[#FF4F00] shadow-[8px_8px_0px_0px_rgba(255,79,0,1)] p-8 relative animate-in zoom-in-95 duration-300">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#FF4F00] flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <Bell size={32} className="text-black" />
          </div>

          <h2 className="text-2xl font-bold uppercase tracking-tighter mb-4">
            Ativar Alertas Neurais?
          </h2>
          
          <p className="text-sm text-white/70 leading-relaxed mb-8 font-mono">
            Receba lembretes diretamente no seu sistema. 
            Mantenha suas conexões cerebrais ativas mesmo fora da aplicação.
          </p>

          <div className="flex flex-col w-full gap-4">
            <button
              onClick={onConfirm}
              className="w-full py-4 bg-[#FF4F00] text-black font-bold uppercase tracking-widest hover:bg-white transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Ativar Notificações
            </button>
            
            <button
              onClick={onCancel}
              className="w-full py-2 text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
