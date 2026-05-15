import React, { useState, useEffect } from "react";
import { X, Loader2, Zap, User, Phone, Car, Mail, Lock, Truck } from "lucide-react";
import { auth, db } from "../firebase/firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const AuthModal = ({ isOpen, onClose, initialMode }) => {
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [fullName,      setFullName]      = useState("");
  const [phone,         setPhone]         = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType,   setVehicleType]   = useState("HMV"); // HMV | LMV

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  if (!isOpen) return null;

  const isLogin = mode === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Login successful!");
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        try {
          // Firestore user document — only fields used by the system:
          // fullName, email, phone, vehicleNumber, vehicleType,
          // walletBalance (starts at 0), role, createdAt
          await setDoc(doc(db, "users", user.uid), {
            fullName,
            email,
            phone,
            vehicleNumber,
            vehicleType,       // "HMV" or "LMV" — used for billing rate
            walletBalance: 0,  // user recharges via Recharge modal
            role: "user",
            createdAt: new Date(),
          });
          alert("Account created successfully!");
        } catch (dbError) {
          await deleteUser(user);
          throw new Error("Failed to save profile. Please try again.");
        }
      }
      onClose();
    } catch (error) {
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') message = "This email is already registered.";
      if (error.code === 'auth/weak-password')        message = "Password should be at least 6 characters.";
      if (error.code === 'auth/invalid-credential')   message = "Invalid email or password.";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

        .auth-overlay {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 16px;
        }
        .auth-modal {
          background: #0d1425;
          border: 1px solid rgba(0,255,170,0.15);
          border-radius: 6px;
          width: 100%; max-width: 460px;
          padding: 36px;
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 0 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,170,0.04);
        }
        .auth-modal::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,170,0.5), transparent);
        }
        .auth-close {
          position: absolute; top: 16px; right: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #4a6080;
          width: 30px; height: 30px;
          border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .auth-close:hover { color: #ff6666; border-color: rgba(255,68,68,0.3); background: rgba(255,68,68,0.06); }

        .auth-header { margin-bottom: 28px; }
        .auth-header-top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .auth-icon-wrap {
          background: rgba(0,255,170,0.08); border: 1px solid rgba(0,255,170,0.2);
          padding: 7px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
        }
        .auth-title {
          font-family: 'Orbitron', monospace; font-weight: 900; font-size: 22px;
          color: #e0e6f0; letter-spacing: 0.08em;
        }
        .auth-subtitle {
          font-family: 'Share Tech Mono', monospace; font-size: 10px;
          letter-spacing: 0.15em; color: #3a5068; text-transform: uppercase;
          margin-left: 46px;
        }
        .auth-field { margin-bottom: 14px; }
        .auth-label {
          display: block; font-family: 'Share Tech Mono', monospace;
          font-size: 10px; letter-spacing: 0.15em; color: #4a6080;
          text-transform: uppercase; margin-bottom: 6px;
        }
        .auth-label span { color: rgba(0,255,170,0.5); margin-left: 3px; }
        .auth-input-wrap { position: relative; display: flex; align-items: center; }
        .auth-input-icon {
          position: absolute; left: 12px; color: #2a4060;
          pointer-events: none; display: flex; align-items: center;
        }
        .auth-input {
          width: 100%; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 4px;
          padding: 11px 14px 11px 38px;
          font-family: 'Share Tech Mono', monospace; font-size: 12px;
          color: #e0e6f0; outline: none; transition: all 0.2s; letter-spacing: 0.05em;
        }
        .auth-input::placeholder { color: #2a3a50; }
        .auth-input:focus {
          border-color: rgba(0,255,170,0.35); background: rgba(0,255,170,0.03);
          box-shadow: 0 0 0 3px rgba(0,255,170,0.05);
        }
        .auth-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        /* Vehicle type toggle */
        .vtype-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .vtype-btn {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 4px; padding: 10px 8px; cursor: pointer;
          font-family: 'Share Tech Mono', monospace; font-size: 11px;
          color: #4a6080; letter-spacing: 0.1em; text-align: center;
          transition: all 0.2s;
        }
        .vtype-btn.active-hmv {
          background: rgba(251,146,60,0.12); border-color: rgba(251,146,60,0.4);
          color: #fb923c;
        }
        .vtype-btn.active-lmv {
          background: rgba(0,170,255,0.1); border-color: rgba(0,170,255,0.4);
          color: #00aaff;
        }
        .vtype-btn:hover { border-color: rgba(0,255,170,0.25); color: #a0c8d8; }

        .auth-divider { border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 20px 0; }

        .auth-submit {
          width: 100%; background: rgba(0,255,170,0.1);
          border: 1px solid rgba(0,255,170,0.35); color: #00ffaa;
          padding: 13px; border-radius: 4px; cursor: pointer;
          font-family: 'Orbitron', monospace; font-weight: 700;
          font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s; margin-top: 8px;
        }
        .auth-submit:hover:not(:disabled) {
          background: rgba(0,255,170,0.18); border-color: rgba(0,255,170,0.6);
          box-shadow: 0 0 20px rgba(0,255,170,0.12);
        }
        .auth-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .auth-switch {
          text-align: center; margin-top: 20px;
          font-family: 'Share Tech Mono', monospace; font-size: 11px;
          color: #3a5068; letter-spacing: 0.05em;
        }
        .auth-switch-btn {
          background: none; border: none; color: #00ffaa; cursor: pointer;
          font-family: 'Share Tech Mono', monospace; font-size: 11px;
          letter-spacing: 0.05em; text-decoration: underline; text-underline-offset: 3px;
          padding: 0; margin-left: 4px; transition: color 0.2s;
        }
        .auth-switch-btn:hover { color: #80ffcc; }
        .auth-switch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
        <div className="auth-modal">
          <button className="auth-close" onClick={onClose} disabled={loading}>
            <X size={14} />
          </button>

          <div className="auth-header">
            <div className="auth-header-top">
              <div className="auth-icon-wrap">
                <Zap size={18} color="#00ffaa" />
              </div>
              <h2 className="auth-title">{isLogin ? "LOGIN" : "SIGN UP"}</h2>
            </div>
            <div className="auth-subtitle">
              {isLogin ? "Access your pantograph dashboard" : "Register vehicle to the network"}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                {/* Full Name */}
                <div className="auth-field">
                  <label className="auth-label">Full Name <span>*</span></label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><User size={14} /></span>
                    <input className="auth-input" type="text" placeholder="Enter your full name"
                      value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                </div>

                {/* Phone + Vehicle Number */}
                <div className="auth-grid">
                  <div className="auth-field">
                    <label className="auth-label">Phone <span>*</span></label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon"><Phone size={14} /></span>
                      <input className="auth-input" type="tel" placeholder="9876543210"
                        value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Vehicle No. <span>*</span></label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon"><Car size={14} /></span>
                      <input className="auth-input" type="text" placeholder="MH 35 WE 2586"
                        value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} required />
                    </div>
                  </div>
                </div>

                {/* Vehicle Type — determines billing rate (HMV ₹9 / LMV ₹7) */}
                <div className="auth-field">
                  <label className="auth-label">Vehicle Type <span>*</span></label>
                  <div className="vtype-row">
                    <button type="button"
                      className={`vtype-btn ${vehicleType === 'HMV' ? 'active-hmv' : ''}`}
                      onClick={() => setVehicleType('HMV')}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>🚛</div>
                      <div>HMV — ₹9/kWh</div>
                      <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '2px' }}>Heavy Motor Vehicle</div>
                    </button>
                    <button type="button"
                      className={`vtype-btn ${vehicleType === 'LMV' ? 'active-lmv' : ''}`}
                      onClick={() => setVehicleType('LMV')}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>🚐</div>
                      <div>LMV — ₹7/kWh</div>
                      <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '2px' }}>Light Motor Vehicle</div>
                    </button>
                  </div>
                </div>

                <hr className="auth-divider" />
              </>
            )}

            {/* Email */}
            <div className="auth-field">
              <label className="auth-label">Email Address <span>*</span></label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Mail size={14} /></span>
                <input className="auth-input" type="email" placeholder="name@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label">Password <span>*</span></label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={14} /></span>
                <input className="auth-input" type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> PROCESSING...</>
                : <>{isLogin ? "ACCESS DASHBOARD →" : "CREATE ACCOUNT →"}</>}
            </button>
          </form>

          <div className="auth-switch">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button className="auth-switch-btn" onClick={() => setMode(isLogin ? "signup" : "login")} disabled={loading}>
              {isLogin ? "Sign Up" : "Login"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthModal;