import { useAuth } from '../context/AuthContext';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Home, Users, Building, LogOut, Menu, X, Package, Truck,
  MessageSquare, Calendar, FileText, WashingMachine,
  ChevronLeft, ChevronRight, Bell, Search, Activity,
  Shield, ChevronDown
} from 'lucide-react';

export function MainLayout() {
  const { user, checkExpiry, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState({});

  useEffect(() => {
    if (!user || !checkExpiry()) {
      navigate('/login', { replace: true });
    }
  }, [user, checkExpiry, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!checkExpiry()) navigate('/login', { replace: true });
    }, 60_000);
    return () => clearInterval(interval);
  }, [checkExpiry, navigate]);

  // Open the parent menu automatically based on current location
  useEffect(() => {
    if (user) {
      const activeParent = getNavItems(user.role === 'Admin').find(item =>
        item.subItems?.some(sub =>
          sub.path === '/' ? location.pathname === '/' : location.pathname.startsWith(sub.path)
        )
      );
      if (activeParent && !isCollapsed) {
        setOpenMenus(prev => ({ ...prev, [activeParent.label]: true }));
      }
    }
  }, [location.pathname, user, isCollapsed]);

  if (!user) return null;
  const isAdmin = user.role === 'Admin';

  const getNavItems = (admin) => {
    const items = [
      { label: 'Dashboard', path: '/', icon: Home },
      { label: 'Calendar of Event', path: '/calendar', icon: Calendar },
      {
        label: 'Mess Management',
        icon: Building,
        subItems: [
          { label: 'Dashboard Mess', path: '/mess/dashboard' },
          { label: 'Matriks Okupansi', path: '/mess/matrix' },
          { label: 'Master Setup', path: '/mess/setup' },
          { label: 'Transfer / Simulasi', path: '/mess/transfer' },
        ]
      },
      { label: 'Travel & Transport', path: '/transport', icon: Truck },
      {
        label: 'Assets',
        icon: Package,
        subItems: [
          { label: 'Kontrak Vendor', path: '/assets/vendor' },
          { label: 'Data Unit Asset', path: '/assets/unit' },
        ]
      },
      {
        label: 'Docs',
        icon: FileText,
        subItems: [
          { label: 'All Documents', path: '/docs' },
          { label: 'Invoice', path: '/invoice' },
        ]
      },
    ];

    if (admin) {
      items.push({
        label: 'Administrator',
        icon: Shield,
        subItems: [
          { label: 'Karyawan', path: '/karyawan' },
          { label: 'Audit Log', path: '/audit-log' }
        ]
      });
    }
    return items;
  };

  const navItems = getNavItems(isAdmin);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = (label) => {
    if (isCollapsed) setIsCollapsed(false);
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Breadcrumb tracking logic
  let activeParent = null;
  let activeChild = null;

  for (const item of navItems) {
    if (item.subItems) {
      const child = item.subItems.find(sub =>
        sub.path === '/' ? location.pathname === '/' : location.pathname.startsWith(sub.path)
      );
      if (child) {
        activeParent = item;
        activeChild = child;
        break;
      }
    } else {
      if (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)) {
        activeParent = item;
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col md:flex-row overflow-hidden">

      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-20">
        <h1 className="text-xl font-bold text-[var(--primary)] font-display tracking-tight">GA-Core</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-[var(--muted-foreground)] focus:outline-none transition-transform active:scale-95">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className={`
        hidden md:flex flex-col relative bg-[var(--card)] border-r border-[var(--border)] shrink-0
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] h-screen
        ${isCollapsed ? 'w-[72px]' : 'w-64'}
      `}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[var(--background)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] shadow-sm z-40 transition-transform hover:scale-110 active:scale-95"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
          {!isCollapsed ? (
            <h1 className="text-2xl font-bold text-[var(--primary)] font-display tracking-tight whitespace-nowrap overflow-hidden animate-in fade-in duration-300">
              GA-Core
            </h1>
          ) : (
            <div className="w-full flex justify-center animate-in fade-in duration-300" title="GA-Core">
              <span className="text-xl font-bold text-[var(--primary)] font-display cursor-default">GA</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasSub = !!item.subItems;

            // Check if active
            const isSelfActive = !hasSub && (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path));
            const isChildActive = hasSub && item.subItems.some(sub =>
              sub.path === '/' ? location.pathname === '/' : location.pathname.startsWith(sub.path)
            );
            const isActive = isSelfActive || isChildActive;
            const isOpen = openMenus[item.label] || false;

            return (
              <div key={item.label} className="flex flex-col">
                {hasSub ? (
                  // Parent menu wrapper (button)
                  <button
                    onClick={() => toggleMenu(item.label)}
                    title={isCollapsed ? item.label : undefined}
                    className={`
                      w-full flex items-center justify-between rounded-[var(--radius-md)] text-sm font-medium transition-all duration-200 relative group
                      ${isCollapsed ? 'justify-center py-3' : 'px-3 py-2.5'}
                      ${(isActive && !isOpen) ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'}
                    `}
                  >
                    {(isActive && !isOpen) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent)] rounded-r-full" />
                    )}
                    <div className="flex items-center">
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-[var(--accent)]' : ''} ${isCollapsed ? '' : 'mr-3'}`} />
                      {!isCollapsed && (
                        <span className="whitespace-nowrap animate-in fade-in duration-300">
                          {item.label}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                ) : (
                  // Direct Link
                  <Link
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={`
                      flex items-center rounded-[var(--radius-md)] text-sm font-medium transition-all duration-200 relative group active:scale-95
                      ${isCollapsed ? 'justify-center py-3' : 'px-3 py-2.5'}
                      ${isActive ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'}
                    `}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent)] rounded-r-full" />
                    )}
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-[var(--accent)]' : ''} ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && (
                      <span className="whitespace-nowrap animate-in fade-in duration-300">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )}

                {/* Sub Items */}
                {hasSub && isOpen && !isCollapsed && (
                  <div className="mt-1 space-y-1 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 pl-4">
                    <div className="pl-3 border-l-2 border-[var(--border)] ml-2 space-y-1">
                      {item.subItems.map(sub => {
                        const isSubActive = sub.path === '/' ? location.pathname === '/' : location.pathname.startsWith(sub.path);
                        return (
                          <Link
                            key={sub.label}
                            to={sub.path}
                            className={`
                              flex items-center w-full px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors relative
                              ${isSubActive ? 'text-[var(--primary)] font-medium bg-[var(--primary)]/5' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'}
                            `}
                          >
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--border)] flex flex-col gap-2 shrink-0">
          <Link to="/profile" title={isCollapsed ? 'Profil' : undefined} className={`flex items-center rounded-[var(--radius-md)] hover:bg-[var(--muted)] transition-all ${isCollapsed ? 'justify-center p-2 mb-2' : 'px-2 py-2 mb-2 mt-2'}`}>
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold shrink-0">
              {user.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden animate-in fade-in duration-300">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{user.name}</p>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{user.role}</p>
              </div>
            )}
          </Link>

          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Keluar' : undefined}
            className={`flex items-center text-sm font-medium text-[var(--destructive)] rounded-[var(--radius-md)] hover:bg-[var(--destructive)]/10 transition-colors active:scale-95
              ${isCollapsed ? 'justify-center p-2' : 'w-full px-3 py-2'}
            `}
          >
            <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && <span className="animate-in fade-in duration-300">Keluar</span>}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div className={`
        md:hidden fixed inset-y-0 left-0 z-30 w-64 bg-[var(--card)] border-r border-[var(--border)] flex flex-col
        transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-4 border-b border-[var(--border)] shrink-0">
          <h1 className="text-2xl font-bold text-[var(--primary)] font-display tracking-tight">GA-Core</h1>
        </div>
        <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasSub = !!item.subItems;

            const isSelfActive = !hasSub && (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path));
            const isChildActive = hasSub && item.subItems.some(sub =>
              sub.path === '/' ? location.pathname === '/' : location.pathname.startsWith(sub.path)
            );
            const isActive = isSelfActive || isChildActive;
            const isOpen = openMenus[item.label] || false;

            return (
              <div key={item.label} className="flex flex-col">
                {hasSub ? (
                  <button
                    onClick={() => setOpenMenus(prev => ({ ...prev, [item.label]: !prev[item.label] }))}
                    className={`
                      w-full flex items-center justify-between rounded-[var(--radius-md)] text-sm font-medium px-3 py-2.5 transition-colors
                      ${isActive && !isOpen ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'}
                    `}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-[var(--accent)]' : ''}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors relative
                      ${isActive ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'}
                    `}
                  >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent)] rounded-r-full" />}
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-[var(--accent)]' : ''}`} />
                    <span>{item.label}</span>
                  </Link>
                )}
                {hasSub && isOpen && (
                  <div className="mt-1 space-y-1 pl-4">
                    <div className="pl-3 border-l-2 border-[var(--border)] ml-2 space-y-1">
                      {item.subItems.map(sub => {
                        const isSubActive = sub.path === '/' ? location.pathname === '/' : location.pathname.startsWith(sub.path);
                        return (
                          <Link
                            key={sub.label}
                            to={sub.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`
                              flex items-center w-full px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors
                              ${isSubActive ? 'text-[var(--primary)] font-medium bg-[var(--primary)]/5' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}
                            `}
                          >
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[var(--border)] flex flex-col gap-2 shrink-0">
          <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center px-2 py-2 mb-2 mt-2 rounded-[var(--radius-md)] hover:bg-[var(--muted)] transition-colors">
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold shrink-0">{user.name.charAt(0)}</div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">{user.name}</p>
              <p className="text-xs text-[var(--muted-foreground)] truncate">{user.role}</p>
            </div>
          </Link>
          <button onClick={handleLogout} className="flex items-center w-full px-3 py-2 text-sm font-medium text-[var(--destructive)] rounded-[var(--radius-md)] hover:bg-[var(--destructive)]/10 transition-colors">
            <LogOut className="w-5 h-5 mr-3" /> <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/20 z-20 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[var(--background)]">

        {/* Desktop Topbar */}
        <header className="hidden md:flex h-16 border-b border-[var(--border)] bg-[var(--background)] items-center justify-between px-6 shrink-0 transition-colors">
          <div className="flex items-center">
            {/* Breadcrumbs */}
            <div className="flex items-center text-sm font-medium text-[var(--muted-foreground)]">
              {activeParent ? (
                <>
                  {activeChild ? (
                    <>
                      <span className="text-[var(--muted-foreground)] cursor-default transition-colors">{activeParent.label}</span>
                      <ChevronRight className="w-4 h-4 mx-2 text-[var(--muted-foreground)] opacity-50" />
                      <span className="text-[var(--foreground)] cursor-default drop-shadow-sm">{activeChild.label}</span>
                    </>
                  ) : (
                    <span className="text-[var(--foreground)] cursor-default drop-shadow-sm">{activeParent.label}</span>
                  )}
                </>
              ) : (
                <span className="text-[var(--foreground)] cursor-default">Page Not Found</span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="flex items-center px-3 py-1.5 text-sm text-[var(--muted-foreground)] bg-[var(--muted)] hover:bg-[var(--border)] rounded-[var(--radius-md)] transition-colors border border-[var(--border)] group">
              <Search className="w-4 h-4 mr-2 group-hover:text-[var(--foreground)] transition-colors" />
              <span className="mr-4 group-hover:text-[var(--foreground)] transition-colors">Cari...</span>
              <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded shadow-sm font-mono">⌘K</kbd>
            </button>

            <button className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-full hover:bg-[var(--muted)] transition-colors relative active:scale-95">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--destructive)] rounded-full border-2 border-[var(--background)]"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
