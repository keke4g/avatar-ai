"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSwap } from '../lib/context/SwapContext';
import { useTranslation } from '../lib/context/LanguageContext';
import { MessageSquare, Compass, Grid, Menu, X, Bell, Shield, User, LogOut, Check, Plus, CalendarCheck2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileAvatar from './ProfileAvatar';
import BrandLogo from './BrandLogo';

export default function Navbar() {
  const pathname = usePathname();
  const { 
    swaps, 
    currentUser: sessionUser,
    logoutMock, 
    notifications, 
    messages, 
    markAllNotificationsAsRead,
    logoutToast,
    setLogoutToast
  } = useSwap();
  const { t, language, setLanguage } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notiDropdownOpen, setNotiDropdownOpen] = useState(false);
  const [isHomeDark, setIsHomeDark] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const currentUser = isHydrated ? sessionUser : null;
  const publishHref = currentUser
    ? '/dashboard?tab=publish'
    : '/login?mode=register&intent=publish&next=%2Fdashboard%3Ftab%3Dpublish';
  const isAdminUser = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isAppointmentStaff = isAdminUser || currentUser?.role === 'INTERNAL_ADVISOR';

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('home_theme');
      setIsHomeDark(storedTheme === 'dark');
    }

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsHomeDark(customEvent.detail === 'dark');
    };

    window.addEventListener('home-theme-change', handleThemeChange);
    return () => window.removeEventListener('home-theme-change', handleThemeChange);
  }, []);

  const notiRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);

  // Close dropdowns on click outside or Escape key press
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close notifications dropdown if clicking outside of it and outside the trigger button
      if (
        notiDropdownOpen &&
        notiRef.current &&
        !notiRef.current.contains(target) &&
        (!bellBtnRef.current || !bellBtnRef.current.contains(target))
      ) {
        setNotiDropdownOpen(false);
      }

      // Close profile dropdown if clicking outside of it and outside the trigger button
      if (
        dropdownOpen &&
        profileRef.current &&
        !profileRef.current.contains(target) &&
        (!profileBtnRef.current || !profileBtnRef.current.contains(target))
      ) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotiDropdownOpen(false);
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notiDropdownOpen, dropdownOpen]);

  // Close dropdowns on route changes
  useEffect(() => {
    setNotiDropdownOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  // Check scroll position to adjust navbar style
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Compute pending count (unread notifications count)
  const pendingCount = currentUser
    ? notifications.filter((n) => !n.isRead).length 
    : 0;

  // Reactively calculate notification cards list from PostgreSQL persistent notifications
  const notificationsList = React.useMemo(() => {
    if (!currentUser) return [];

    return notifications.map(n => {
      const avatar = '/avatar.png';
      let link = '/dashboard';
      if (n.title.includes('mensaje') || n.title.includes('Message') || n.title.includes('💬')) {
        link = '/messages';
      } else if (n.title.includes('intercambio') || n.title.includes('Swap') || n.title.includes('🤝') || n.title.includes('✅') || n.title.includes('❌')) {
        link = '/dashboard?tab=incoming';
      } else if (n.title.includes('Perfil') || n.title.includes('Profile') || n.title.includes('✨')) {
        link = '/profile';
      }

      // Format elapsed time
      const createdDate = new Date(n.createdAt);
      // eslint-disable-next-line react-hooks/purity
      const diffMs = Date.now() - createdDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      let timeText = 'Reciente';
      if (diffMins < 60) {
        timeText = `${Math.max(1, diffMins)}m`;
      } else if (diffHrs < 24) {
        timeText = `${diffHrs}h`;
      } else {
        timeText = `${Math.floor(diffHrs / 24)}d`;
      }

      return {
        id: n.id,
        title: n.title,
        body: n.content,
        avatar,
        time: timeText,
        link,
        isRead: n.isRead
      };
    });
  }, [notifications, currentUser]);

  // Calculate actual global unread message count
  const totalUnreadMessages = React.useMemo(() => {
    if (!currentUser) return 0;
    return messages.filter((m) => m.senderId !== currentUser.id && !m.isRead).length;
  }, [messages, currentUser]);

  // Compute pending review incoming swaps count for dashboard badge
  const pendingSwapsCount = React.useMemo(() => {
    if (!currentUser) return 0;
    return swaps.filter(
      (s) => s.status === 'PENDING' && s.receiverId === currentUser.id
    ).length;
  }, [swaps, currentUser]);

  // Navigation Items using dynamic translation hooks
  const navItems: Array<{
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { label: t('nav.explore'), href: '/explore', icon: Compass },
  ];

  if (currentUser) {
    navItems.push(
      { 
        label: t('nav.dashboard'), 
        href: '/dashboard', 
        icon: Grid,
        badge: pendingSwapsCount > 0 ? pendingSwapsCount : undefined 
      },
      { 
        label: t('nav.messages'), 
        href: '/messages', 
        icon: MessageSquare,
        badge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined
      }
    );

    if (isAppointmentStaff) {
      navItems.push({
        label: language === 'es' ? 'Formato de Citas' : 'Appointment Form',
        href: '/appointments',
        icon: CalendarCheck2
      });
    }
  }

  return (
    <>
      <header
        className={`fixed top-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-7xl -translate-x-1/2 overflow-visible rounded-full transition-all duration-300 ${
          pathname === '/'
            ? (isHomeDark
                ? 'py-2 px-6 bg-transparent border-transparent opacity-40 hover:opacity-100 text-white'
                : 'py-2.5 px-6 shadow-floating glass bg-white/85 border border-zinc-200/80 text-zinc-800')
            : isScrolled
            ? 'py-2.5 px-6 shadow-floating glass bg-white/85 border border-white/35 text-zinc-800'
            : 'py-4 px-8 shadow-premium bg-white/70 border border-white/20 text-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" aria-label="Towers México — Inicio" className="group">
            <BrandLogo
              inverted={pathname === '/' && isHomeDark}
              priority
              markClassName="h-8 w-8 transition-transform duration-200 group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/explore' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                    pathname === '/' && isHomeDark
                      ? isActive
                        ? 'text-white bg-white/10'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                      : isActive
                      ? 'text-brand-black bg-brand-gray-100'
                      : 'text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-50'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  
                  {item.badge !== undefined && (
                    <span className="ml-1 bg-brand-accent text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[14px] text-center shrink-0 shadow-sm animate-pulse flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Profile & Language Menu (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            
            {/* Elegant Glassmorphic Language Switcher Pill */}
            <div className={`flex items-center gap-0.5 border p-1 rounded-full text-[9px] font-black tracking-wide shadow-xs shrink-0 select-none ${
              pathname === '/' && isHomeDark
                ? 'bg-white/5 border-white/10 text-white'
                : 'bg-brand-gray-100/80 border border-brand-gray-200/50 text-brand-black'
            }`}>
              <button
                onClick={() => setLanguage('es')}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition-all duration-200 ${
                  language === 'es'
                    ? pathname === '/' && isHomeDark ? 'bg-white/10 text-white font-black' : 'bg-white text-brand-black shadow-sm font-black'
                    : pathname === '/' && isHomeDark ? 'text-white/45 hover:text-white' : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                ES
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition-all duration-200 ${
                  language === 'en'
                    ? pathname === '/' && isHomeDark ? 'bg-white/10 text-white font-black' : 'bg-white text-brand-black shadow-sm font-black'
                    : pathname === '/' && isHomeDark ? 'text-white/45 hover:text-white' : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                EN
              </button>
            </div>

            <Link
              href={publishHref}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[9px] font-black uppercase tracking-wider shadow-sm transition hover:-translate-y-0.5 ${
                pathname === '/' && isHomeDark
                  ? 'border-white/25 bg-white/10 text-white hover:bg-white/15'
                  : 'border-brand-black bg-white text-brand-black hover:bg-brand-black hover:text-white'
              }`}
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              {language === 'es' ? 'Publicar Gratis' : 'List for Free'}
            </Link>

            {/* Notification Bell & Dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  ref={bellBtnRef}
                  onClick={() => {
                    setNotiDropdownOpen(!notiDropdownOpen);
                    setDropdownOpen(false);
                  }}
                  className={`p-2 rounded-full transition-colors relative cursor-pointer outline-none ${
                    pathname === '/' && isHomeDark
                      ? 'text-white/40 hover:text-white hover:bg-white/5'
                      : 'text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {pendingCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                  )}
                </button>

                <AnimatePresence>
                  {notiDropdownOpen && (
                    <motion.div
                      ref={notiRef}
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute right-0 mt-2.5 w-80 bg-white border border-brand-gray-200 rounded-3xl shadow-floating z-50 p-4 text-left overflow-hidden"
                    >
                      <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-brand-accent/5 filter blur-lg pointer-events-none" />
                      
                      <div className="flex items-center justify-between pb-3 border-b border-brand-gray-100 mb-3 select-none">
                        <span className="text-[10px] uppercase font-black tracking-widest text-brand-black flex items-center gap-1.5">
                          <Bell className="w-4 h-4 text-brand-accent" />
                          <span>{language === 'es' ? 'Notificaciones' : 'Notifications'}</span>
                        </span>
                        
                        <button
                          onClick={() => {
                            markAllNotificationsAsRead();
                            setNotiDropdownOpen(false);
                          }}
                          className="text-[9px] font-black uppercase text-brand-accent hover:underline flex items-center gap-1 cursor-pointer border-0 bg-transparent"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>{language === 'es' ? 'Leer Todo' : 'Clear All'}</span>
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto flex flex-col gap-2.5 scrollbar-thin">
                        {notificationsList.map((noti) => (
                          <Link
                            key={noti.id}
                            href={noti.link}
                            onClick={() => setNotiDropdownOpen(false)}
                            className="flex gap-2.5 p-2 rounded-2xl hover:bg-brand-gray-50 transition-colors text-left"
                          >
                            <ProfileAvatar
                              name="Towers México"
                              className="h-8 w-8 border border-brand-gray-200"
                              textClassName="text-[10px]"
                              alt={language === 'es' ? 'Notificación de Towers México' : 'Towers México notification'}
                            />
                            
                            <div className="overflow-hidden flex-grow select-none">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <p className="text-[10px] font-black text-brand-black truncate">{noti.title}</p>
                                <span className="text-[8px] font-bold text-brand-gray-400 shrink-0">{noti.time}</span>
                              </div>
                              <p className="text-[10px] font-semibold text-brand-gray-500 leading-normal line-clamp-2">{noti.body}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Profile Avatar link & Dropdown */}
            {!currentUser ? (
              <Link 
                href="/login"
                className={`py-2 px-4 rounded-full font-bold text-[10px] uppercase tracking-wider transition-colors shadow-premium cursor-pointer select-none ${
                  pathname === '/' && isHomeDark
                    ? 'bg-white text-brand-black hover:bg-white/90'
                    : 'bg-brand-black text-white hover:bg-brand-black/90'
                }`}
              >
                {language === 'es' ? 'Iniciar Sesión' : 'Log In'}
              </Link>
            ) : (
              <div className="relative">
                <button
                  ref={profileBtnRef}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex items-center gap-2 pl-2 border-l hover:opacity-90 transition-opacity cursor-pointer select-none ${pathname === '/' && isHomeDark ? 'border-white/10' : 'border-brand-gray-200'}`}
                >
                  <ProfileAvatar
                    src={currentUser.avatar}
                    name={currentUser.name}
                    className="h-7 w-7 border border-brand-gray-200"
                    textClassName="text-[10px]"
                  />
                  <span className={`text-[10px] uppercase font-black tracking-wider hidden lg:inline ${pathname === '/' && isHomeDark ? 'text-white' : 'text-brand-black'}`}>
                    {currentUser.name.split(' ')[0]}
                  </span>
                </button>
                
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      ref={profileRef}
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute right-0 mt-2.5 w-52 bg-white border border-brand-gray-200 rounded-2xl shadow-floating z-50 p-2 text-left"
                    >
                      <Link
                        href="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-brand-gray-50 text-[11px] font-bold text-brand-black transition-colors"
                      >
                        <User className="w-4 h-4 text-brand-gray-400" />
                        <span>{language === 'es' ? 'Mi Perfil' : 'My Profile'}</span>
                      </Link>
                      
                      <Link
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-brand-gray-50 text-[11px] font-bold text-brand-black transition-colors"
                      >
                        <Grid className="w-4 h-4 text-brand-gray-400" />
                        <span>Dashboard</span>
                      </Link>
                      
                      <Link
                        href="/messages"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-brand-gray-50 text-[11px] font-bold text-brand-black transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-brand-gray-400" />
                        <span>{language === 'es' ? 'Mensajes' : 'Messages'}</span>
                      </Link>

                      {isAdminUser && (
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-brand-gray-50 text-[11px] font-bold text-brand-black transition-colors"
                        >
                          <Shield className="w-4 h-4 text-brand-gray-400" />
                          <span>{language === 'es' ? 'Consola Admin' : 'Admin Console'}</span>
                        </Link>
                      )}
                      
                      <div className="h-px bg-brand-gray-100 my-1" />
                      
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          logoutMock();
                        }}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-brand-rose/5 text-[11px] font-black text-brand-rose transition-colors cursor-pointer text-left border-0 bg-transparent"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{language === 'es' ? 'Cerrar Sesión' : 'Log Out'}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            {pendingCount > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-pulse mr-1" />
            )}
            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen
                ? (language === 'es' ? 'Cerrar menú' : 'Close menu')
                : (language === 'es' ? 'Abrir menú' : 'Open menu')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                pathname === '/' && isHomeDark
                  ? 'text-white/40 hover:text-white hover:bg-white/5'
                  : 'text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100'
              }`}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label={language === 'es' ? 'Cerrar menú' : 'Close menu'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[4990] cursor-default bg-slate-950/35 backdrop-blur-[2px] md:hidden"
            />
            <motion.div
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label={language === 'es' ? 'Menú de navegación' : 'Navigation menu'}
              initial={{ opacity: 0, y: -18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-3 right-3 top-4 z-[5000] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[30px] border border-white/75 bg-white/98 p-4 shadow-[0_28px_90px_-28px_rgba(2,8,23,0.72)] md:hidden"
            >
              <div className="flex flex-col">
                <div className="flex items-start justify-between gap-4 px-1 pb-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-accent">
                      Towers México
                    </span>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">
                      {language === 'es' ? '¿A dónde quieres ir?' : 'Where would you like to go?'}
                    </h2>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">
                      {language === 'es' ? 'Explora, publica y administra desde un solo lugar.' : 'Explore, publish, and manage from one place.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label={language === 'es' ? 'Cerrar menú' : 'Close menu'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="rounded-[24px] border border-slate-200/80 bg-slate-50/85 p-1.5">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/explore' && pathname?.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex min-h-13 items-center justify-between rounded-[18px] px-3.5 py-3 text-xs font-extrabold transition ${
                          isActive
                            ? 'bg-brand-accent text-white shadow-[0_14px_28px_-18px_rgba(10,119,168,0.9)]'
                            : 'text-slate-600 hover:bg-white hover:text-slate-950'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isActive ? 'bg-white/14 text-white' : 'bg-white text-slate-500 shadow-sm'
                          }`}>
                            <item.icon className="h-4 w-4" />
                          </span>
                          <span>{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.badge !== undefined && (
                            <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[8px] font-black ${
                              isActive ? 'bg-white/18 text-white' : 'bg-brand-accent/10 text-brand-accent'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                          <ChevronRight className={`h-3.5 w-3.5 ${isActive ? 'text-white/70' : 'text-slate-300'}`} />
                        </div>
                      </Link>
                    );
                  })}
                </nav>

                <Link
                  href={publishHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-3 flex min-h-14 w-full items-center justify-between rounded-[20px] bg-slate-950 px-4 text-white shadow-[0_18px_34px_-22px_rgba(2,8,23,0.95)] transition active:scale-[0.99]"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-[0.08em]">
                      {language === 'es' ? 'Publicar gratis' : 'List for free'}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/55" />
                </Link>

                <div className="pt-4">
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                      {language === 'es' ? 'Idioma' : 'Language'}
                    </span>
                    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100/80 p-0.5 text-[9px] font-black">
                      <button
                        type="button"
                        onClick={() => setLanguage('es')}
                        className={`cursor-pointer rounded-full px-3 py-1.5 transition-all ${
                          language === 'es' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        ES
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`cursor-pointer rounded-full px-3 py-1.5 transition-all ${
                          language === 'en' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        EN
                      </button>
                    </div>
                  </div>

                  {currentUser ? (
                    <div className="mt-3 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href="/profile"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex min-w-0 items-center gap-3"
                        >
                          <ProfileAvatar
                            src={currentUser.avatar}
                            name={currentUser.name}
                            className="h-10 w-10"
                            textClassName="text-xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-slate-950">{currentUser.name}</p>
                            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('nav.profile')}</p>
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => { setMobileMenuOpen(false); logoutMock(); }}
                          className="rounded-xl border border-brand-rose/20 bg-brand-rose/5 px-3 py-2 text-[8px] font-black uppercase text-brand-rose"
                        >
                          {language === 'es' ? 'Salir' : 'Log out'}
                        </button>
                      </div>

                      {isAdminUser && (
                        <Link
                          href="/admin"
                          onClick={() => setMobileMenuOpen(false)}
                          className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-800"
                        >
                          <span className="flex items-center gap-3">
                            <Shield className="h-4 w-4 text-slate-500" />
                            {language === 'es' ? 'Consola Admin' : 'Admin Console'}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="mt-3 flex min-h-12 w-full items-center justify-center rounded-[18px] border border-slate-300 bg-white px-4 text-[10px] font-black uppercase tracking-[0.1em] text-slate-950 shadow-sm transition active:bg-slate-50"
                    >
                      {language === 'es' ? 'Iniciar sesión' : 'Log in'}
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Premium Floating Logout Toast */}
      <AnimatePresence>
        {logoutToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-brand-black text-white px-5 py-3.5 rounded-2xl shadow-floating border border-brand-gray-800 flex items-center gap-3"
          >
            <div className="w-5 h-5 rounded-full bg-brand-rose/15 text-brand-rose flex items-center justify-center font-bold text-xs">
              ✓
            </div>
            <span className="text-xs font-semibold tracking-wide">
              {t('guards.signOutSuccess')}
            </span>
            <button
              onClick={() => setLogoutToast(false)}
              className="text-[10px] text-brand-gray-400 hover:text-white ml-2 font-black cursor-pointer bg-transparent border-0"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
