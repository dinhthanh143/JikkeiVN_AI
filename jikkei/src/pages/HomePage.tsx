import "../styles/HomePage.css";
import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LegalBlockingModal from "@/components/legal/LegalBlockingModal";
import {
  LEGAL_BUNDLE_VERSION,
  LEGAL_STORAGE_KEY,
} from "@/config/legalVersions";
import { useAuth } from "@/hooks/useAuth";
import { acceptLatestLegal, fetchLegalStatus } from "@/services/backendApi";
import { playHover, playClick } from "@/audio/sfx";

type MenuId =
  | "home"
  | "play"
  | "publicStories"
  | "theHub"
  | "marketplace"
  | "community"
  | "settings"
  | "adminOverview"
  | "adminUsers"
  | "adminActivity"
  | "adminScenes"
  | "adminReports"
  | "adminRoles"
  | "adminSystem";

interface MenuItem {
  id: MenuId;
  label: string;
  icon: string;
  path: string;
  tag?: string;
  requiresAuth?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "home", label: "HOME", icon: "◈", path: "/", tag: "INFO" },
  { id: "play", label: "PLAY", icon: "▶", path: "/play", tag: "NEW", requiresAuth: true },
  { id: "publicStories", label: "PUBLIC STORIES", icon: "◈", path: "/public_stories" },
  { id: "theHub", label: "THE HUB", icon: "✦", path: "/hub", requiresAuth: true },
  { id: "marketplace", label: "MARKETPLACE", icon: "◈", path: "/marketplace", requiresAuth: true },
  { id: "community", label: "COMMUNITY", icon: "⬡", path: "/community" },
];

const ADMIN_MENU_ITEMS: MenuItem[] = [
  { id: "adminOverview", label: "OVERVIEW", icon: "◆", path: "/admin/overview", requiresAuth: true },
  { id: "adminUsers", label: "USERS", icon: "◈", path: "/admin/users", requiresAuth: true },
  { id: "adminActivity", label: "ACTIVITY", icon: "⬡", path: "/admin/activity", requiresAuth: true },
  { id: "adminScenes", label: "SCENES", icon: "✦", path: "/admin/scenes", requiresAuth: true },
  { id: "adminReports", label: "REPORTS", icon: "⬡", path: "/admin/reports", requiresAuth: true },
  { id: "adminRoles", label: "ROLES", icon: "☰", path: "/admin/roles", requiresAuth: true },
  { id: "adminSystem", label: "SYSTEM", icon: "⚙", path: "/admin/system", requiresAuth: true },
];

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, authResolved, username, role } = useAuth();
  const timeoutRef = useRef<number | null>(null);

  const [transitioning, setTransitioning] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [ripple, setRipple] = useState<MenuId | null>(null);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [requiredLegalVersion, setRequiredLegalVersion] = useState(LEGAL_BUNDLE_VERSION);

  const isAdmin = isAuthenticated && role === "admin";
  const selectedMenu = isAdmin ? ADMIN_MENU_ITEMS : MENU_ITEMS;

  const visibleMenuItems = selectedMenu.filter((item) => {
    if (item.requiresAuth && !isAuthenticated) return false;
    return true;
  });

  const active: MenuId | null =
    location.pathname === "/admin/overview" ? "adminOverview"
    : location.pathname === "/admin/users" ? "adminUsers"
    : location.pathname === "/admin/activity" ? "adminActivity"
    : location.pathname === "/admin/scenes" ? "adminScenes"
    : location.pathname === "/admin/reports" ? "adminReports"
    : location.pathname === "/admin/roles" ? "adminRoles"
    : location.pathname === "/admin/system" ? "adminSystem"
    : (location.pathname === "/play" ||
       location.pathname === "/create" ||
       /^\/story\/[^/]+\/edit$/.test(location.pathname)) ? "play"
    : location.pathname === "/public_stories" ? "publicStories"
    : location.pathname === "/hub" ? "theHub"
    : location.pathname === "/marketplace" ? "marketplace"
    : location.pathname === "/community" ? "community"
    : (location.pathname === "/settings" || location.pathname === "/options") ? "settings"
    : location.pathname === "/" ? "home"
    : null;

  const isAuthRoute = location.pathname === "/auth";

  useEffect(() => {
    if (!isAdmin) return;
    const isAdminPath = location.pathname.startsWith("/admin/");
    const isAdminAllowedUtilityPath = location.pathname === "/settings" || location.pathname === "/options";
    if (!isAdminPath && !isAdminAllowedUtilityPath) {
      navigate("/admin/overview", { replace: true });
    }
  }, [isAdmin, location.pathname, navigate]);

  useEffect(() => {
    return () => { if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current) };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkLegalCompatibility = async () => {
      if (!isAuthenticated) { if (isMounted) setShowLegalModal(false); return; }
      const localAcceptedVersion = localStorage.getItem(LEGAL_STORAGE_KEY);
      const backendStatus = await fetchLegalStatus();
      const requiresBackendReaccept = backendStatus?.requires_reaccept ?? false;
      const requiredVersion = backendStatus?.required_legal_version ?? LEGAL_BUNDLE_VERSION;
      const requiresLocalReaccept = localAcceptedVersion !== requiredVersion;
      if (isMounted) { setRequiredLegalVersion(requiredVersion); setShowLegalModal(requiresLocalReaccept || requiresBackendReaccept); }
    };
    void checkLegalCompatibility();
    return () => { isMounted = false };
  }, [isAuthenticated]);

  const handleAcceptLegal = async () => {
    try {
      const accepted = await acceptLatestLegal(requiredLegalVersion);
      localStorage.setItem(LEGAL_STORAGE_KEY, accepted.required_legal_version);
      setShowLegalModal(false);
    } catch { setShowLegalModal(true) }
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.requiresAuth && !isAuthenticated) return;
    playClick();
    if (item.id === active) return;
    setRipple(item.id);
    setTransitioning(true);
    timeoutRef.current = window.setTimeout(() => { navigate(item.path); setTransitioning(false); setRipple(null); }, 220);
  };

  const handleSettingsClick = () => {
    if (!isAuthenticated) return;
    playClick();
    if (active === "settings") return;
    setRipple("settings");
    setTransitioning(true);
    timeoutRef.current = window.setTimeout(() => { navigate("/settings"); setTransitioning(false); setRipple(null); }, 220);
  };

  if (!authResolved) {
    return (
      <div className="jk-auth-loading-screen" role="status" aria-live="polite" aria-busy="true">
        <div className="jk-auth-loading-grid" />
        <div className="jk-auth-loading-orb jk-auth-loading-orb-left" />
        <div className="jk-auth-loading-orb jk-auth-loading-orb-right" />
        <div className="jk-auth-loading-card">
          <p className="jk-auth-loading-kicker">SESSION BOOTSTRAP</p>
          <h1 className="jk-auth-loading-title">LOADING</h1>
          <p className="jk-auth-loading-copy">Restoring your Jikkei identity and route access.</p>
          <div className="jk-auth-loading-progress" aria-hidden="true">
            <span className="jk-auth-loading-progress-bar" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`jk-root ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {showLegalModal && isAuthenticated ? (
          <LegalBlockingModal requiredVersion={requiredLegalVersion} onAccept={handleAcceptLegal} />
        ) : null}

        <aside className="sidebar">
          <div className="logo-block">
            <div className="logo-row">
              <div className="logo-mark">
                <span className="logo-text">JIKKEI</span>
                <span className="logo-dot" />
              </div>
              <button type="button" className="taskbar-toggle-btn" onMouseEnter={playHover} onClick={() => { playClick(); setIsSidebarCollapsed((prev) => !prev); }} aria-label={isSidebarCollapsed ? "Expand taskbar" : "Minimize taskbar"} title={isSidebarCollapsed ? "Expand" : "Minimize"}>
                {isSidebarCollapsed ? ">>" : "<<"}
              </button>
            </div>
            <span className="logo-version">V0.1</span>
          </div>

          <nav className="menu">
            {visibleMenuItems.map((item) => {
              const isActive = active === item.id;
              return (
                <button key={item.id} className={`menu-btn ${isActive ? "menu-btn-active" : ""} ${ripple === item.id ? "menu-btn-ripple" : ""}`} onMouseEnter={playHover} onClick={() => handleMenuClick(item)}>
                  <span className="btn-outline-3" />
                  <span className="btn-outline-2" />
                  <span className="btn-outline-1" />
                  <span className="btn-inner">
                    <span className="btn-icon-wrap">{item.icon}</span>
                    <span className="btn-label">{item.label}</span>
                    {item.tag && <span className="btn-tag">{item.tag}</span>}
                  </span>
                  {isActive && <span className="btn-active-bar" />}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            {isAuthenticated ? (
              <div className="user-row">
                <div
                  className="user-avatar"
                  onClick={() => { playClick(); navigate(`/profile/${username}`); }}
                  style={{ cursor: 'pointer' }}
                  title="View your profile"
                >
                  {(username ?? "O").charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <p className="user-name">{username ?? "OPERATOR_01"}</p>
                  <span className="user-tier user-tier-free">Free</span>
                </div>
                <button type="button" className={`user-settings-btn ${active === "settings" ? "user-settings-btn-active" : ""}`} onMouseEnter={playHover} onClick={handleSettingsClick} aria-label="Settings" title="Settings">⚙</button>
              </div>
            ) : (
              <button type="button" className="btn-primary login-cta-btn" onMouseEnter={playHover} onClick={() => { playClick(); navigate("/auth"); }}>Login / Sign Up</button>
            )}
          </div>
        </aside>

        <main
          className={`main-panel ${transitioning ? "panel-exit" : "panel-enter"}`}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100vh', overflow: 'hidden' }}
        >
          <div
            className={`panel-scroll ${isAuthRoute ? "panel-scroll-auth" : ""}`}
            style={{
              flex: '1 1 0',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
