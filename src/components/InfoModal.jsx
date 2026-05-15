import React, { useState } from 'react';
import {
  X, Zap, Cpu, Globe, ShieldCheck, GitBranch,
  HelpCircle, ChevronDown, ChevronUp,
  AlertTriangle, Send, Loader2, CheckCircle2,
  Radio, BarChart3, CreditCard, FileText
} from 'lucide-react';

// ─── Shared styles ────────────────────────────────────────────────────────────
const OVERLAY = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 50, padding: '16px',
};
const MODAL_BASE = {
  background: 'linear-gradient(135deg,#0a0e1a 0%,#0d1425 100%)',
  border: '1px solid rgba(0,255,170,0.15)',
  borderRadius: '6px',
  width: '100%',
  position: 'relative',
  maxHeight: '88vh',
  overflowY: 'auto',
  boxShadow: '0 0 60px rgba(0,0,0,0.7), 0 0 30px rgba(0,255,170,0.04)',
  fontFamily: '"Inter","Segoe UI",sans-serif',
};
const LBL  = { fontFamily: '"JetBrains Mono",monospace', fontSize: '10px', letterSpacing: '0.12em', color: '#4a6080', textTransform: 'uppercase' };
const CARD = { background: 'rgba(0,255,170,0.03)', border: '1px solid rgba(0,255,170,0.09)', borderRadius: '4px', padding: '14px' };

// ─── TOP ACCENT LINE (reused) ─────────────────────────────────────────────────
const TopLine = () => (
  <div style={{ position:'absolute', top:0, left:0, right:0, height:'1px', background:'linear-gradient(90deg,transparent,rgba(0,255,170,0.5),transparent)' }} />
);

// ─── CLOSE BUTTON ─────────────────────────────────────────────────────────────
const CloseBtn = ({ onClose }) => (
  <button onClick={onClose} style={{
    position:'absolute', top:'14px', right:'14px',
    background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
    color:'#4a6080', width:'28px', height:'28px', borderRadius:'3px',
    display:'flex', alignItems:'center', justifyContent:'center',
    cursor:'pointer', transition:'all 0.2s',
  }}
    onMouseEnter={e => { e.currentTarget.style.color='#ff6666'; e.currentTarget.style.borderColor='rgba(255,68,68,0.3)'; }}
    onMouseLeave={e => { e.currentTarget.style.color='#4a6080'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; }}
  >
    <X size={13} />
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ABOUT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const AboutContent = () => {
  const stats = [
    { label: 'System Uptime',   value: '99.94%',  icon: <ShieldCheck size={13} color="#00ffaa" /> },
    { label: 'Active Routes',   value: '3',        icon: <Globe       size={13} color="#00aaff" /> },
    { label: 'ESP32 Nodes',     value: '2',        icon: <Cpu         size={13} color="#ffd700" /> },
    { label: 'Platform Ver.',   value: 'v1.2.0',   icon: <GitBranch   size={13} color="#00ffaa" /> },
  ];

  const steps = [
    { n:'01', text:'Vehicle registers on Pantograph platform and links RFID card to wallet account.' },
    { n:'02', text:'At entry gate, RFID card is scanned — balance is verified (min ₹1000) and charging session begins.' },
    { n:'03', text:'INA219 sensor measures voltage, current and power every 200ms. Live data streams to Firebase every 5s.' },
    { n:'04', text:'At exit gate, same RFID card ends session. ESP32 calculates bill and instantly deducts from wallet.' },
    { n:'05', text:'Dashboard syncs final bill to Firestore. PDF invoice is auto-generated for the vehicle operator.' },
  ];

  const tech = ['React + Vite', 'Firebase RTDB', 'Firestore', 'ESP32', 'INA219', 'MFRC522 RFID', 'jsPDF', 'Recharts', 'Tailwind CSS'];

  return (
    <div style={{ padding: '24px', paddingTop: '0' }}>

      {/* Description */}
      <p style={{ color:'#7a9ab0', fontSize:'13px', lineHeight:'1.8', marginBottom:'20px' }}>
        Pantograph is a real-time electric highway billing platform for heavy and light motor vehicles.
        Vehicles charge via overhead pantograph contact — energy is measured live using INA219 current sensors
        on ESP32 hardware and billed automatically at the exit gate via dual RFID authentication.
      </p>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...CARD, textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'8px' }}>{s.icon}</div>
            <div style={{ fontFamily:'"Inter",sans-serif', fontWeight:'800', fontSize:'16px', color:'#e0e6f0' }}>{s.value}</div>
            <div style={{ ...LBL, marginTop:'3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{ ...CARD, marginBottom:'16px' }}>
        <div style={{ ...LBL, marginBottom:'14px' }}>How It Works</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {steps.map(s => (
            <div key={s.n} style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:'10px', color:'#00ffaa', background:'rgba(0,255,170,0.08)', padding:'2px 6px', borderRadius:'2px', flexShrink:0, marginTop:'1px' }}>{s.n}</span>
              <p style={{ color:'#6a8a9a', fontSize:'12px', lineHeight:'1.7', margin:0 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Billing formula */}
      <div style={{ background:'rgba(0,170,255,0.04)', border:'1px solid rgba(0,170,255,0.1)', borderRadius:'4px', padding:'14px', marginBottom:'16px' }}>
        <div style={{ ...LBL, color:'#4a80a0', marginBottom:'10px' }}>Billing Formula</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          {[
            ['Energy Used',      'kWh = (exit total_Wh − entry total_Wh) / 1000'],
            ['Base Amount',      'kWh × Rate  (HMV ₹9/kWh · LMV ₹7/kWh)'],
            ['Service Charge',   'Base × 2%'],
            ['GST',              'Base × 18%'],
            ['Total Bill',       'Base + Service + GST  →  deducted from wallet'],
          ].map(([k, v]) => (
            <div key={k} style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
              <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:'10px', color:'#00aaff', flexShrink:0, width:'110px' }}>{k}</span>
              <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:'10px', color:'#4a6080' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div style={CARD}>
        <div style={{ ...LBL, marginBottom:'10px' }}>Technology Stack</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {tech.map(t => (
            <span key={t} style={{ fontSize:'10px', padding:'3px 10px', borderRadius:'2px', background:'rgba(0,255,170,0.06)', border:'1px solid rgba(0,255,170,0.15)', color:'#00ffaa', fontFamily:'"JetBrains Mono",monospace', letterSpacing:'0.05em' }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELP MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const HelpContent = () => {
  const [open, setOpen] = useState(null);

  const faqs = [
    {
      q: 'What is the minimum wallet balance required to start charging?',
      a: 'Your wallet must have at least ₹1,000 to initiate a charging session. If balance is below this threshold, the entry gate RFID scan will be rejected and access will not be granted.'
    },
    {
      q: 'How does the RFID entry/exit work?',
      a: 'Two separate RFID readers are installed — one at the entry gate and one at the exit gate. Tap your registered RFID card at the entry to start the session. Tap the same card at the exit gate to end the session and trigger automatic billing.'
    },
    {
      q: 'How is my bill calculated?',
      a: 'Energy consumed (kWh) = (exit meter reading − entry meter reading). Base amount = kWh × rate (HMV ₹9/kWh, LMV ₹7/kWh). A 2% service charge and 18% GST are added on top of the base amount. Total is deducted from your wallet at exit.'
    },
    {
      q: 'What is HMV vs LMV and how does it affect my rate?',
      a: 'HMV (Heavy Motor Vehicle) includes trucks, buses, and commercial freight vehicles — billed at ₹9/kWh. LMV (Light Motor Vehicle) includes cars and small commercial vehicles — billed at ₹7/kWh. Your vehicle type is set during registration.'
    },
    {
      q: 'Can I recharge my wallet from the dashboard?',
      a: 'Yes. Click the "Recharge" button in the Wallet Balance section on your dashboard. You can select preset amounts (₹500, ₹1000, ₹2000) or enter a custom amount. Balance is updated instantly in real-time.'
    },
    {
      q: 'How do I download my invoice?',
      a: 'Click "Export PDF Invoice" at the bottom of the right panel on your dashboard. The invoice includes your vehicle ID, energy consumed, rate applied, GST breakdown, and final bill amount.'
    },
    {
      q: 'What happens if the ESP32 loses connection mid-session?',
      a: 'The ESP32 accumulates energy locally and resumes uploads when reconnected. The dashboard detects connection loss and shows OFFLINE status. Billing only triggers when the exit RFID card is scanned — not on disconnection.'
    },
    {
      q: 'My RFID card was not recognized at the entry gate. What should I do?',
      a: 'Ensure your RFID card is registered and linked to your account. Check that your wallet balance is ≥ ₹1,000. If the issue persists, use the Grievance option in the navbar to report it with your vehicle number.'
    },
  ];

  const quickLinks = [
    { icon: <CreditCard size={13} color="#00aaff" />, label: 'Recharge Wallet',    hint: 'Top up your balance' },
    { icon: <BarChart3  size={13} color="#00ffaa" />, label: 'View Session History', hint: 'Past charging records' },
    { icon: <FileText   size={13} color="#ffd700" />, label: 'Export Invoice',      hint: 'PDF billing summary' },
    { icon: <Radio      size={13} color="#ff9900" />, label: 'Check Live Data',     hint: 'Real-time sensor feed' },
  ];

  return (
    <div style={{ padding:'24px', paddingTop:'0' }}>

      {/* Quick links */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'20px' }}>
        {quickLinks.map(l => (
          <div key={l.label} style={{ ...CARD, textAlign:'center', cursor:'default' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'6px' }}>{l.icon}</div>
            <div style={{ fontSize:'11px', color:'#c0d0e0', fontWeight:'600', marginBottom:'2px' }}>{l.label}</div>
            <div style={{ ...LBL, fontSize:'9px' }}>{l.hint}</div>
          </div>
        ))}
      </div>

      {/* FAQ accordion */}
      <div style={{ ...LBL, marginBottom:'12px' }}>Frequently Asked Questions</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {faqs.map((f, i) => (
          <div key={i} style={{ background: open===i ? 'rgba(0,255,170,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${open===i ? 'rgba(0,255,170,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius:'4px', overflow:'hidden', transition:'all 0.2s' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', gap:'12px' }}
            >
              <span style={{ fontSize:'12px', color: open===i ? '#00ffaa' : '#c0d0e0', fontWeight:'500', lineHeight:'1.5' }}>{f.q}</span>
              {open === i ? <ChevronUp size={14} color="#00ffaa" style={{flexShrink:0}} /> : <ChevronDown size={14} color="#4a6080" style={{flexShrink:0}} />}
            </button>
            {open === i && (
              <div style={{ padding:'0 14px 14px', color:'#6a8a9a', fontSize:'12px', lineHeight:'1.8', borderTop:'1px solid rgba(0,255,170,0.08)', paddingTop:'12px' }}>
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Support note */}
      <div style={{ marginTop:'16px', background:'rgba(0,170,255,0.04)', border:'1px solid rgba(0,170,255,0.1)', borderRadius:'4px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
        <HelpCircle size={14} color="#00aaff" style={{flexShrink:0}} />
        <p style={{ fontSize:'12px', color:'#4a7090', margin:0, lineHeight:'1.6' }}>
          Still stuck? Use the <strong style={{color:'#00aaff'}}>Grievance</strong> option in the navbar to raise a support ticket with your vehicle number and issue description.
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GRIEVANCE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const GrievanceContent = ({ onClose }) => {
  const [form, setForm]       = useState({ name:'', vehicle:'', email:'', category:'', description:'' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    'RFID Card Not Recognized',
    'Incorrect Billing / Overcharge',
    'Wallet Balance Not Updating',
    'Session Did Not End Properly',
    'PDF Invoice Not Generated',
    'ESP32 / Sensor Hardware Issue',
    'Login / Account Access Problem',
    'Other',
  ];

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.vehicle || !form.category || !form.description) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500)); // simulate API
    setLoading(false);
    setSubmitted(true);
  };

  const INPUT = {
    width:'100%', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
    borderRadius:'4px', padding:'10px 14px', fontFamily:'"JetBrains Mono",monospace',
    fontSize:'12px', color:'#e0e6f0', outline:'none', letterSpacing:'0.04em', boxSizing:'border-box',
  };

  if (submitted) return (
    <div style={{ padding:'40px 24px', textAlign:'center' }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:'16px' }}>
        <CheckCircle2 size={48} color="#00ffaa" />
      </div>
      <h3 style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:'14px', color:'#00ffaa', letterSpacing:'0.1em', marginBottom:'10px' }}>TICKET SUBMITTED</h3>
      <p style={{ fontSize:'13px', color:'#6a8a9a', lineHeight:'1.8', marginBottom:'6px' }}>
        Your grievance has been logged. Our support team will review it within <strong style={{color:'#c0d0e0'}}>24–48 hours</strong>.
      </p>
      <p style={{ fontSize:'12px', color:'#4a6080', marginBottom:'24px' }}>
        Ticket ID: <span style={{color:'#00ffaa', fontFamily:'"JetBrains Mono",monospace'}}>PG-{Date.now().toString().slice(-6)}</span>
      </p>
      <button onClick={onClose} style={{ background:'rgba(0,255,170,0.1)', border:'1px solid rgba(0,255,170,0.3)', color:'#00ffaa', padding:'10px 28px', borderRadius:'4px', cursor:'pointer', fontFamily:'"JetBrains Mono",monospace', fontSize:'11px', letterSpacing:'0.1em' }}>
        CLOSE
      </button>
    </div>
  );

  return (
    <div style={{ padding:'24px', paddingTop:'0' }}>
      <p style={{ color:'#7a9ab0', fontSize:'12px', lineHeight:'1.7', marginBottom:'20px' }}>
        Use this form to report billing issues, RFID failures, sensor problems, or any other concern.
        Our team will respond within 24–48 hours. Please include your vehicle number for faster resolution.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
          <div>
            <div style={{ ...LBL, marginBottom:'6px' }}>Full Name <span style={{color:'rgba(0,255,170,0.5)'}}>*</span></div>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Your full name" required
              style={INPUT} onFocus={e => { e.target.style.borderColor='rgba(0,255,170,0.35)'; e.target.style.background='rgba(0,255,170,0.03)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.07)'; e.target.style.background='rgba(255,255,255,0.03)'; }} />
          </div>
          <div>
            <div style={{ ...LBL, marginBottom:'6px' }}>Vehicle Number <span style={{color:'rgba(0,255,170,0.5)'}}>*</span></div>
            <input name="vehicle" value={form.vehicle} onChange={handleChange} placeholder="MH 40 RT 2046" required
              style={INPUT} onFocus={e => { e.target.style.borderColor='rgba(0,255,170,0.35)'; e.target.style.background='rgba(0,255,170,0.03)'; }}
              onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.07)'; e.target.style.background='rgba(255,255,255,0.03)'; }} />
          </div>
        </div>

        <div style={{ marginBottom:'12px' }}>
          <div style={{ ...LBL, marginBottom:'6px' }}>Email Address</div>
          <input name="email" value={form.email} onChange={handleChange} placeholder="name@email.com" type="email"
            style={INPUT} onFocus={e => { e.target.style.borderColor='rgba(0,255,170,0.35)'; e.target.style.background='rgba(0,255,170,0.03)'; }}
            onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.07)'; e.target.style.background='rgba(255,255,255,0.03)'; }} />
        </div>

        <div style={{ marginBottom:'12px' }}>
          <div style={{ ...LBL, marginBottom:'6px' }}>Issue Category <span style={{color:'rgba(0,255,170,0.5)'}}>*</span></div>
          <select name="category" value={form.category} onChange={handleChange} required
            style={{ ...INPUT, appearance:'none', cursor:'pointer' }}
            onFocus={e => { e.target.style.borderColor='rgba(0,255,170,0.35)'; }}
            onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.07)'; }}
          >
            <option value="" style={{background:'#0d1425'}}>Select a category...</option>
            {categories.map(c => <option key={c} value={c} style={{background:'#0d1425'}}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:'16px' }}>
          <div style={{ ...LBL, marginBottom:'6px' }}>Issue Description <span style={{color:'rgba(0,255,170,0.5)'}}>*</span></div>
          <textarea name="description" value={form.description} onChange={handleChange}
            placeholder="Describe the issue in detail — include date/time, session details, and what you expected vs what happened..."
            required rows={4}
            style={{ ...INPUT, resize:'vertical', minHeight:'90px', lineHeight:'1.6' }}
            onFocus={e => { e.target.style.borderColor='rgba(0,255,170,0.35)'; e.target.style.background='rgba(0,255,170,0.03)'; }}
            onBlur={e => { e.target.style.borderColor='rgba(255,255,255,0.07)'; e.target.style.background='rgba(255,255,255,0.03)'; }}
          />
        </div>

        {/* Warning note */}
        <div style={{ background:'rgba(255,153,0,0.05)', border:'1px solid rgba(255,153,0,0.15)', borderRadius:'4px', padding:'10px 14px', display:'flex', alignItems:'flex-start', gap:'10px', marginBottom:'16px' }}>
          <AlertTriangle size={13} color="#ff9900" style={{flexShrink:0, marginTop:'1px'}} />
          <p style={{ fontSize:'11px', color:'#7a6030', margin:0, lineHeight:'1.6' }}>
            For billing disputes, please note the session date, entry/exit time, and the amount charged. Tickets without vehicle numbers may take longer to resolve.
          </p>
        </div>

        <button type="submit" disabled={loading} style={{
          width:'100%', background:'rgba(0,255,170,0.1)', border:'1px solid rgba(0,255,170,0.35)',
          color:'#00ffaa', padding:'12px', borderRadius:'4px', cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily:'"JetBrains Mono",monospace', fontWeight:'700', fontSize:'11px',
          letterSpacing:'0.15em', textTransform:'uppercase',
          display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
          opacity: loading ? 0.6 : 1, transition:'all 0.2s',
        }}>
          {loading
            ? <><Loader2 size={14} style={{animation:'spin 1s linear infinite'}} /> SUBMITTING...</>
            : <><Send size={13} /> SUBMIT GRIEVANCE</>
          }
        </button>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN InfoModal
// ═══════════════════════════════════════════════════════════════════════════════
const HEADERS = {
  about: {
    icon: <Zap size={17} color="#00ffaa" />,
    iconBg: 'rgba(0,255,170,0.08)', iconBorder: 'rgba(0,255,170,0.2)',
    title: 'PANTOGRAPH', subtitle: 'E-HIGHWAY BILLING PLATFORM · v1.2.0',
  },
  help: {
    icon: <HelpCircle size={17} color="#00aaff" />,
    iconBg: 'rgba(0,170,255,0.08)', iconBorder: 'rgba(0,170,255,0.2)',
    title: 'HELP CENTER', subtitle: 'GUIDES · FAQ · QUICK ACTIONS',
  },
  grievance: {
    icon: <AlertTriangle size={17} color="#ff9900" />,
    iconBg: 'rgba(255,153,0,0.08)', iconBorder: 'rgba(255,153,0,0.2)',
    title: 'GRIEVANCE', subtitle: 'REPORT AN ISSUE · SUPPORT TICKET',
  },
};

const InfoModal = ({ isOpen, onClose, type = 'about' }) => {
  if (!isOpen) return null;
  const h = HEADERS[type] || HEADERS.about;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap');
      `}</style>

      <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...MODAL_BASE, maxWidth: type === 'about' ? '600px' : type === 'help' ? '640px' : '560px' }}>
          <TopLine />
          <CloseBtn onClose={onClose} />

          {/* Header */}
          <div style={{ padding:'22px 24px 18px', borderBottom:'1px solid rgba(0,255,170,0.07)', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ background: h.iconBg, border: `1px solid ${h.iconBorder}`, padding:'9px', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {h.icon}
            </div>
            <div>
              <div style={{ fontFamily:'"JetBrains Mono",monospace', fontWeight:'700', fontSize:'16px', color:'#e0e6f0', letterSpacing:'0.1em' }}>{h.title}</div>
              <div style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:'9px', color:'#3a5068', letterSpacing:'0.15em', textTransform:'uppercase', marginTop:'2px' }}>{h.subtitle}</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ paddingTop:'20px' }}>
            {type === 'about'     && <AboutContent />}
            {type === 'help'      && <HelpContent />}
            {type === 'grievance' && <GrievanceContent onClose={onClose} />}
          </div>

          {/* Footer (not shown for grievance — it has its own submit) */}
          {type !== 'grievance' && (
            <div style={{ padding:'14px 24px', borderTop:'1px solid rgba(255,255,255,0.04)', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={onClose} style={{
                background:'rgba(0,255,170,0.07)', border:'1px solid rgba(0,255,170,0.2)',
                color:'#00ffaa', padding:'8px 24px', borderRadius:'3px', cursor:'pointer',
                fontFamily:'"JetBrains Mono",monospace', fontSize:'11px', letterSpacing:'0.12em', textTransform:'uppercase',
                transition:'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(0,255,170,0.14)'; e.currentTarget.style.borderColor='rgba(0,255,170,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(0,255,170,0.07)'; e.currentTarget.style.borderColor='rgba(0,255,170,0.2)'; }}
              >
                CLOSE
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InfoModal;