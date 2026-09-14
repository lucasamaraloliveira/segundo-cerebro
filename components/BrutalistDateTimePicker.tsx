'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  getHours,
  getMinutes
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, X, Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BrutalistDateTimePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
}

export default function BrutalistDateTimePicker({
  label,
  value,
  onChange,
  placeholder = 'Definir data...'
}: BrutalistDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => value || new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(value);
  const [selectedHour, setSelectedHour] = useState<number>(() => (value ? getHours(value) : 12));
  const [selectedMinute, setSelectedMinute] = useState<number>(() => (value ? getMinutes(value) : 0));
  const [activeTab, setActiveTab] = useState<'calendar' | 'time'>('calendar');

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom'; width: number }>({
    top: 0,
    left: 0,
    placement: 'bottom',
    width: 320
  });

  const updateCoords = () => {
    if (!triggerButtonRef.current) return;
    const rect = triggerButtonRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const popoverWidth = isMobile ? Math.min(320, window.innerWidth - 16) : 320;
    const popoverEstimatedHeight = 390;

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldDropUp = spaceBelow < popoverEstimatedHeight && rect.top > popoverEstimatedHeight;

    let top: number;
    let placement: 'top' | 'bottom';

    if (shouldDropUp) {
      top = Math.max(8, rect.top - popoverEstimatedHeight - 4);
      placement = 'top';
    } else {
      top = rect.bottom + 4;
      placement = 'bottom';
    }

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(8, rect.right - popoverWidth);
    }
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));

    setCoords({
      top,
      left,
      placement,
      width: popoverWidth
    });
  };

  // Sync external value when prop changes
  const [prevValue, setPrevValue] = useState<Date | null>(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setSelectedDate(value);
    if (value) {
      setViewDate(value);
      setSelectedHour(getHours(value));
      setSelectedMinute(getMinutes(value));
    }
  }

  // Handle window scroll, resize, and Escape
  useEffect(() => {
    if (!isOpen) return;

    updateCoords();

    const handleScroll = (e: Event) => {
      // If scroll happens inside the popover itself (e.g. scroll list of hours/minutes), don't close
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleResize = () => {
      updateCoords();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto-scroll time columns when switching to 'time' tab
  useEffect(() => {
    if (activeTab === 'time' && isOpen) {
      setTimeout(() => {
        if (hourListRef.current) {
          const activeHourEl = hourListRef.current.querySelector('[data-active="true"]') as HTMLElement;
          if (activeHourEl) {
            hourListRef.current.scrollTop = activeHourEl.offsetTop - hourListRef.current.offsetHeight / 2 + activeHourEl.offsetHeight / 2;
          }
        }
        if (minuteListRef.current) {
          const activeMinEl = minuteListRef.current.querySelector('[data-active="true"]') as HTMLElement;
          if (activeMinEl) {
            minuteListRef.current.scrollTop = activeMinEl.offsetTop - minuteListRef.current.offsetHeight / 2 + activeMinEl.offsetHeight / 2;
          }
        }
      }, 50);
    }
  }, [activeTab, isOpen]);

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [viewDate]);

  const handleSelectDay = (day: Date) => {
    let updated = setHours(day, selectedHour);
    updated = setMinutes(updated, selectedMinute);
    setSelectedDate(updated);
    setViewDate(day);
    onChange(updated);
  };

  const handleSelectHour = (h: number) => {
    setSelectedHour(h);
    const base = selectedDate || new Date();
    let updated = setHours(base, h);
    updated = setMinutes(updated, selectedMinute);
    setSelectedDate(updated);
    onChange(updated);
  };

  const handleSelectMinute = (m: number) => {
    setSelectedMinute(m);
    const base = selectedDate || new Date();
    let updated = setHours(base, selectedHour);
    updated = setMinutes(updated, m);
    setSelectedDate(updated);
    onChange(updated);
  };

  const handleSetNow = () => {
    const now = new Date();
    setSelectedDate(now);
    setViewDate(now);
    setSelectedHour(getHours(now));
    setSelectedMinute(getMinutes(now));
    onChange(now);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDate(null);
    onChange(null);
    setIsOpen(false);
  };

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const formattedDisplay = value ? format(value, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">{label}</p>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[9px] font-mono text-[var(--foreground)] opacity-40 hover:opacity-100 hover:text-[var(--accent)] transition-all flex items-center gap-0.5 cursor-pointer"
            title="Remover data"
          >
            <span>Limpar</span>
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Trigger Button */}
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updateCoords();
          setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between gap-2 bg-[var(--muted)] text-[var(--foreground)] px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-mono font-bold tracking-normal rounded-none border border-[var(--border)] hover:border-[var(--accent)]/60 transition-all cursor-pointer ${
          isOpen ? 'ring-1 ring-[var(--accent)] border-[var(--accent)]' : ''
        }`}
      >
        <span className={`truncate ${!value ? 'opacity-40 font-sans uppercase font-medium tracking-wider' : ''}`}>
          {formattedDisplay || placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-[var(--foreground)] opacity-90" />
        </div>
      </button>

      {/* Brutalist Popover Modal via React Portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Invisible Backdrop overlay */}
              <div
                className="fixed inset-0 z-[9990] bg-transparent"
                onClick={() => setIsOpen(false)}
              />
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: coords.placement === 'top' ? 6 : -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: coords.placement === 'top' ? 6 : -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                }}
                className="z-[9999] bg-[var(--background)] border-2 border-[var(--border)] shadow-[8px_8px_0px_rgba(0,0,0,0.5)] dark:shadow-[8px_8px_0px_rgba(0,0,0,0.8)] p-3 text-[var(--foreground)] select-none font-sans"
              >
            {/* Header: Tab Navigation & Controls */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-1 bg-[var(--muted)]/40 p-0.5 border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'calendar'
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('time')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'time'
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>
                    {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
                  </span>
                </button>
              </div>

              <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
                {activeTab === 'calendar' ? 'Dia' : 'Hora'}
              </div>
            </div>

            {/* TAB 1: CALENDAR VIEW */}
            {activeTab === 'calendar' && (
              <div className="space-y-2">
                {/* Month/Year Bar */}
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wide text-[var(--foreground)]">
                    {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewDate(subMonths(viewDate, 1))}
                      className="p-1 hover:bg-[var(--muted)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-all cursor-pointer"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewDate(addMonths(viewDate, 1))}
                      className="p-1 hover:bg-[var(--muted)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-all cursor-pointer"
                      title="Próximo mês"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Days of Week Header */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono font-bold opacity-40 uppercase">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                    <div key={idx} className="py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => {
                    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                    const isCurrentMonth = isSameMonth(day, viewDate);
                    const isCurrentDay = isToday(day);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectDay(day)}
                        className={`aspect-square flex items-center justify-center text-[11px] font-mono transition-all relative cursor-pointer border ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white font-bold border-[var(--accent)] shadow-[2px_2px_0px_rgba(0,0,0,0.2)]'
                            : isCurrentMonth
                            ? 'bg-[var(--muted)]/20 border-transparent hover:border-[var(--accent)]/60 hover:text-[var(--accent)] text-[var(--foreground)]'
                            : 'opacity-20 border-transparent hover:border-[var(--border)] text-[var(--foreground)]'
                        }`}
                      >
                        <span>{format(day, 'd')}</span>
                        {isCurrentDay && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--accent)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: TIME VIEW */}
            {activeTab === 'time' && (
              <div className="space-y-2 py-1">
                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono font-bold uppercase opacity-50 border-b border-[var(--border)] pb-1">
                  <span>Hora</span>
                  <span>Minuto</span>
                </div>

                <div className="grid grid-cols-2 gap-2 h-44">
                  {/* Hours List */}
                  <div ref={hourListRef} className="overflow-y-auto custom-scrollbar border border-[var(--border)] p-1 space-y-1">
                    {hours.map((h) => {
                      const isSelected = selectedHour === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          data-active={isSelected}
                          onClick={() => handleSelectHour(h)}
                          className={`w-full py-1 text-xs font-mono font-bold text-center transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                              : 'border-transparent hover:bg-[var(--muted)] hover:text-[var(--accent)] opacity-80'
                          }`}
                        >
                          {String(h).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>

                  {/* Minutes List */}
                  <div ref={minuteListRef} className="overflow-y-auto custom-scrollbar border border-[var(--border)] p-1 space-y-1">
                    {minutes.map((m) => {
                      const isSelected = selectedMinute === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          data-active={isSelected}
                          onClick={() => handleSelectMinute(m)}
                          className={`w-full py-1 text-xs font-mono font-bold text-center transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                              : 'border-transparent hover:bg-[var(--muted)] hover:text-[var(--accent)] opacity-80'
                          }`}
                        >
                          {String(m).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Actions Footer */}
            <div className="mt-3 pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="px-2 py-1 bg-[var(--muted)]/50 border border-[var(--border)] text-[9px] font-mono font-bold uppercase tracking-wider hover:border-[var(--accent)]/60 hover:text-[var(--accent)] transition-all cursor-pointer"
                >
                  Agora
                </button>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2 py-1 bg-transparent border border-transparent text-[9px] font-mono uppercase tracking-wider opacity-50 hover:opacity-100 hover:text-red-500 transition-all cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 px-3 py-1 bg-[var(--accent)] text-white text-[10px] font-mono font-bold uppercase tracking-wider shadow-[2px_2px_0px_rgba(0,0,0,0.3)] hover:opacity-90 transition-all cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Confirmar</span>
              </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}
  </div>
);
}
