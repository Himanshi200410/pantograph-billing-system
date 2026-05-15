import React from 'react';
import { LogOut, User, Zap } from 'lucide-react';

const Navbar = ({ 
  onLoginClick, 
  onSignupClick, 
  onLogoutClick, 
  onNavClick,   // called with 'about' | 'help' | 'grievance' (lowercase)
  user,
  userName 
}) => {

  const handleTabClick = (tab) => {
    if (tab === 'Home') {
      window.location.reload();
    } else {
      // Pass lowercase type so InfoModal can match: 'about' | 'help' | 'grievance'
      onNavClick(tab.toLowerCase());
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

        .nav-root {
          position: sticky; top: 0; z-index: 50; width: 100%;
          background: rgba(6,10,20,0.97);
          border-bottom: 1px solid rgba(0,255,170,0.12);
          backdrop-filter: blur(16px);
          font-family: 'Share Tech Mono','Courier New',monospace;
        }
        .nav-root::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg,transparent 0%,rgba(0,255,170,0.3) 50%,transparent 100%);
        }
        .nav-inner {
          width: 100%; padding: 0 16px;
          height: 52px; display: flex; justify-content: space-between; align-items: center;
        }
        .nav-logo {
          display: flex; align-items: center; gap: 10px; cursor: pointer; text-decoration: none;
        }
        .nav-logo-icon {
          background: rgba(0,255,170,0.1); border: 1px solid rgba(0,255,170,0.25);
          padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .nav-logo:hover .nav-logo-icon {
          background: rgba(0,255,170,0.18); box-shadow: 0 0 12px rgba(0,255,170,0.2);
        }
        .nav-logo-text {
          font-family: 'Orbitron',monospace; font-weight: 900; font-size: 15px;
          color: #e0e6f0; letter-spacing: 0.15em;
        }
        .nav-logo-text span { color: #00ffaa; }
        .nav-center {
          display: flex; align-items: center; gap: 0;
          flex: 1; justify-content: space-evenly;
          margin: 0 40px;
        }
        .nav-tab {
          background: none; border: none; cursor: pointer;
          font-family: 'Share Tech Mono',monospace; font-size: 11px;
          letter-spacing: 0.15em; text-transform: uppercase; color: #a0b4c8;
          padding: 4px 0; position: relative; transition: color 0.2s;
        }
        .nav-tab::after {
          content: ''; position: absolute; bottom: -2px; left: 0; right: 0;
          height: 1px; background: #00ffaa; transform: scaleX(0); transition: transform 0.2s;
        }
        .nav-tab:hover { color: #00ffaa; }
        .nav-tab:hover::after { transform: scaleX(1); }
        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-divider { width: 1px; height: 20px; background: rgba(0,255,170,0.1); }
        .nav-user-chip {
          display: flex; align-items: center; gap: 8px;
          background: rgba(0,255,170,0.05); border: 1px solid rgba(0,255,170,0.12);
          padding: 4px 12px; border-radius: 3px;
        }
        .nav-user-name {
          font-family: 'Orbitron',monospace; font-size: 11px; font-weight: 700;
          color: #00ffaa; max-width: 120px; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.08em;
        }
        .nav-logout-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,68,68,0.06); border: 1px solid rgba(255,68,68,0.2);
          color: #ff6666; padding: 5px 14px; border-radius: 3px; cursor: pointer;
          font-family: 'Share Tech Mono',monospace; font-size: 11px;
          letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.2s;
        }
        .nav-logout-btn:hover {
          background: rgba(255,68,68,0.12); border-color: rgba(255,68,68,0.4); color: #ff4444;
        }
        .nav-login-btn {
          background: none; border: 1px solid rgba(0,255,170,0.2); color: #4a8070;
          padding: 5px 16px; border-radius: 3px; cursor: pointer;
          font-family: 'Share Tech Mono',monospace; font-size: 11px;
          letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.2s;
        }
        .nav-login-btn:hover {
          border-color: rgba(0,255,170,0.4); color: #00ffaa; background: rgba(0,255,170,0.05);
        }
        .nav-signup-btn {
          background: rgba(0,255,170,0.1); border: 1px solid rgba(0,255,170,0.35);
          color: #00ffaa; padding: 5px 16px; border-radius: 3px; cursor: pointer;
          font-family: 'Share Tech Mono',monospace; font-size: 11px;
          letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.2s;
        }
        .nav-signup-btn:hover {
          background: rgba(0,255,170,0.18); border-color: rgba(0,255,170,0.6);
          box-shadow: 0 0 12px rgba(0,255,170,0.15);
        }
        @media (max-width: 768px) {
          .nav-center { display: none; }
          .nav-user-name { display: none; }
        }
      `}</style>

      <nav className="nav-root">
        <div className="nav-inner">

          {/* LOGO */}
          <div className="nav-logo" onClick={() => handleTabClick('Home')}>
            <div className="nav-logo-icon">
              <Zap size={16} color="#00ffaa" />
            </div>
            <span className="nav-logo-text">PANTO<span>GRAPH</span></span>
          </div>

          {/* CENTER TABS */}
          <div className="nav-center">
            {['Home', 'About', 'Help', 'Grievance'].map(item => (
              <button key={item} onClick={() => handleTabClick(item)} className="nav-tab">
                {item}
              </button>
            ))}
          </div>

          {/* RIGHT: AUTH */}
          <div className="nav-right">
            {user ? (
              <>
                <div className="nav-user-chip">
                  <User size={13} color="#00ffaa" />
                  <span className="nav-user-name">{userName || 'USER'}</span>
                </div>
                <div className="nav-divider" />
                <button className="nav-logout-btn" onClick={onLogoutClick}>
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <button className="nav-login-btn"  onClick={onLoginClick}>Login</button>
                <button className="nav-signup-btn" onClick={onSignupClick}>Sign Up</button>
              </>
            )}
          </div>

        </div>
      </nav>
    </>
  );
};

export default Navbar;