import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard'; 
import InfoModal from './components/InfoModal'; 
import { auth, db } from "./firebase/firebaseConfig"; 
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAuthMode, setActiveAuthMode] = useState(null);
  const [infoModalType, setInfoModalType] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
        setUser(currentUser);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try { await signOut(auth); }
    catch (error) { console.error("Logout Error:", error); }
  };

  // Navbar passes lowercase type: 'about' | 'help' | 'grievance'
  const handleNavClick = (type) => setInfoModalType(type);

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#0a0e1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Share Tech Mono", monospace', color: '#00ffaa',
      fontSize: '13px', letterSpacing: '0.2em'
    }}>
      INITIALIZING...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#e0e6f0' }}>
      <Navbar 
        onLoginClick={() => setActiveAuthMode('login')} 
        onSignupClick={() => setActiveAuthMode('signup')}
        onLogoutClick={handleLogout}
        onNavClick={handleNavClick}
        user={user}
        userName={userData?.fullName}
      />

      <div className="w-full">
        {user ? (
          <Dashboard user={user} />
        ) : (
          <LandingPage onGetStarted={() => setActiveAuthMode('login')} />
        )}
      </div>

      <AuthModal
        isOpen={!!activeAuthMode}
        onClose={() => setActiveAuthMode(null)}
        initialMode={activeAuthMode}
      />
      <InfoModal
        isOpen={!!infoModalType}
        onClose={() => setInfoModalType(null)}
        type={infoModalType}
      />
    </div>
  );
}

// ── LANDING PAGE ──────────────────────────────────────────────────────────────
const LandingPage = ({ onGetStarted }) => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

      .landing-root {
        min-height: calc(100vh - 52px);
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 48px 24px;
        position: relative;
        overflow: hidden;
      }

      /* ── Truck background image ── */
      .landing-root::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: url('/truck-bg.png');
        background-size: cover;
        background-position: center 30%;
        background-repeat: no-repeat;
        z-index: 0;
      }

      /* ── Dark gradient overlay on top of image ── */
      .landing-root::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(to bottom,
            rgba(10,14,26,0.82) 0%,
            rgba(10,14,26,0.65) 40%,
            rgba(10,14,26,0.88) 75%,
            rgba(10,14,26,1.00) 100%
          ),
          linear-gradient(rgba(0,255,170,0.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,170,0.018) 1px, transparent 1px);
        background-size: 100% 100%, 40px 40px, 40px 40px;
        z-index: 1;
      }

      /* Everything inside sits above both overlays */
      .landing-content {
        position: relative;
        z-index: 2;
      }

      .landing-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(0,255,170,0.07);
        border: 1px solid rgba(0,255,170,0.25);
        padding: 6px 16px;
        border-radius: 3px;
        font-family: 'Share Tech Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.2em;
        color: #00ffaa;
        margin-bottom: 32px;
        backdrop-filter: blur(4px);
      }
      .landing-badge-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: #00ffaa;
        animation: badge-pulse 1.5s ease-in-out infinite;
      }
      @keyframes badge-pulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%      { opacity:0.4; transform:scale(0.8); }
      }

      .landing-title {
        font-family: 'Orbitron', monospace;
        font-weight: 900;
        font-size: clamp(36px, 6vw, 72px);
        color: #e0e6f0;
        line-height: 1.1;
        margin-bottom: 10px;
        letter-spacing: 0.05em;
        text-shadow: 0 0 40px rgba(0,0,0,0.8);
      }
      .landing-title span { color: #00ffaa; }

      .landing-sub {
        font-family: 'Orbitron', monospace;
        font-weight: 400;
        font-size: clamp(13px, 2.2vw, 20px);
        color: #4a7090;
        margin-bottom: 22px;
        letter-spacing: 0.18em;
      }

      .landing-desc {
        font-family: 'Share Tech Mono', monospace;
        font-size: 13px;
        color: #8aaabb;
        max-width: 500px;
        margin: 0 auto 48px;
        line-height: 1.9;
        letter-spacing: 0.05em;
      }

      .landing-btn {
        background: rgba(0,255,170,0.1);
        border: 1px solid rgba(0,255,170,0.4);
        color: #00ffaa;
        padding: 14px 42px;
        border-radius: 4px;
        cursor: pointer;
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        transition: all 0.25s;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        backdrop-filter: blur(6px);
      }
      .landing-btn:hover {
        background: rgba(0,255,170,0.2);
        border-color: rgba(0,255,170,0.7);
        box-shadow: 0 0 32px rgba(0,255,170,0.18), 0 4px 24px rgba(0,0,0,0.4);
        transform: translateY(-2px);
      }

      .landing-stats {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0;
        margin-top: 64px;
        flex-wrap: wrap;
      }
      .stat-item {
        text-align: center;
        padding: 0 44px;
      }
      .stat-value {
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 28px;
        color: #00ffaa;
        text-shadow: 0 0 20px rgba(0,255,170,0.3);
      }
      .stat-label {
        font-family: 'Share Tech Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.15em;
        color: #4a7090;
        text-transform: uppercase;
        margin-top: 5px;
      }
      .stat-divider {
        width: 1px;
        height: 40px;
        background: rgba(0,255,170,0.1);
      }
    `}</style>

    <div className="landing-root">
      <div className="landing-content">

        <div className="landing-badge">
          <span className="landing-badge-dot" />
          SYSTEM ONLINE · PANTOGRAPH NETWORK ACTIVE
        </div>

        <div className="landing-title">
          SMART <span>PANTOGRAPH</span>
        </div>

        <div className="landing-sub">
          ELECTRIC HIGHWAY BILLING SYSTEM
        </div>

        <div className="landing-desc">
          Real-time energy monitoring and automated billing for electric
          trucks via overhead pantograph infrastructure.
        </div>

        <button className="landing-btn" onClick={onGetStarted}>
          ACCESS DASHBOARD →
        </button>

        <div className="landing-stats">
          <div className="stat-item">
            <div className="stat-value">₹9.00</div>
            <div className="stat-label">HMV Per kWh Rate</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-value">₹7.00</div>
            <div className="stat-label">LMV Per kWh Rate</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-value">99.9%</div>
            <div className="stat-label">Uptime</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-value">Live</div>
            <div className="stat-label">Net Metering</div>
          </div>
        </div>

      </div>
    </div>
  </>
);

export default App;