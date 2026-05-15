import React, { useState } from 'react';
import {
  X, CreditCard, Loader2, Zap, CheckCircle2,
  Smartphone, Building2, ChevronRight, Lock,
  ShieldCheck, ArrowLeft
} from 'lucide-react';
import { db_realtime } from "../firebase/firebaseConfig";
import { ref, update, get } from "firebase/database";

const PRESETS = [500, 1000, 2000, 5000];

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 60, padding: '16px',
  },
  modal: {
    background: 'linear-gradient(145deg,#0a0e1a 0%,#0d1528 100%)',
    border: '1px solid rgba(0,255,170,0.2)', borderRadius: '8px',
    width: '100%', maxWidth: '460px', position: 'relative',
    boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(0,255,170,0.06)',
    fontFamily: '"Inter","Inter",sans-serif', overflow: 'hidden',
  },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)', borderRadius: '5px',
    padding: '12px 14px', fontFamily: '"Inter",sans-serif',
    fontSize: '13px', color: '#f0f4ff', outline: 'none',
    letterSpacing: '0.05em', boxSizing: 'border-box', transition: 'all 0.2s',
  },
  lbl: {
    fontFamily: '"Inter",sans-serif', fontSize: '10px',
    letterSpacing: '0.14em', color: '#b0c8d8', textTransform: 'uppercase',
    display: 'block', marginBottom: '6px',
  },
};

const focusIn  = e => { e.target.style.borderColor = 'rgba(0,255,170,0.4)'; e.target.style.background = 'rgba(0,255,170,0.04)'; };
const focusOut = e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)'; };

const UPI_APPS = [
  { name: 'Google Pay',  color: '#4285F4', letter: 'G' },
  { name: 'PhonePe',     color: '#5F259F', letter: 'P' },
  { name: 'Paytm',       color: '#00BAF2', letter: 'P' },
  { name: 'BHIM',        color: '#00529B', letter: 'B' },
];

const BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda', 'Other',
];

const STEPS = ['amount', 'method', 'details'];

// ── Find RFID cardId in RTDB vehicles node ────────────────────────────────────
// Priority: prop → session===1 (active vehicle) → first available
const findCardId = async (propCardId) => {
  if (propCardId) return propCardId;
  try {
    const snap = await get(ref(db_realtime, 'vehicles'));
    const vehicles = snap.val();
    if (!vehicles) return null;
    for (const cid of Object.keys(vehicles)) {
      if (vehicles[cid].session === 1) return cid;
    }
    return Object.keys(vehicles)[0] || null;
  } catch (e) {
    console.error('[findCardId] Error:', e);
    return null;
  }
};

const RechargeModal = ({ isOpen, onClose, userId, rfidCardId: propCardId }) => {
  const [step,     setStep]     = useState('amount');
  const [amount,   setAmount]   = useState('');
  const [method,   setMethod]   = useState('card');
  const [upiApp,   setUpiApp]   = useState('');
  const [bank,     setBank]     = useState('');
  const [progress, setProgress] = useState(0);
  const [txnId,    setTxnId]    = useState('');
  const [cardNo,   setCardNo]   = useState('');
  const [expiry,   setExpiry]   = useState('');
  const [cvv,      setCvv]      = useState('');
  const [cardName, setCardName] = useState('');
  const [upiId,    setUpiId]    = useState('');

  if (!isOpen) return null;

  const amt = parseFloat(amount);
  const validAmount = !isNaN(amt) && amt > 0;

  const formatCard   = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const formatExpiry = v => { const d = v.replace(/\D/g,'').slice(0,4); return d.length >= 3 ? d.slice(0,2)+'/'+d.slice(2) : d; };

  const canProceed = () => {
    if (method === 'card') return cardNo.replace(/\s/g,'').length === 16 && expiry.length === 5 && cvv.length === 3 && cardName.length > 2;
    if (method === 'upi') return upiApp !== '' || upiId.includes('@');
    if (method === 'netbanking') return bank !== '';
    return false;
  };

  // ── PAY: simulate progress bar, then write new balance to RTDB ───────────
  const handlePay = async () => {
    setStep('processing');
    setProgress(0);

    // Progress bar animation
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18;
      setProgress(Math.min(p, 95));
      if (p >= 95) clearInterval(iv);
    }, 220);

    await new Promise(r => setTimeout(r, 2800));
    clearInterval(iv);
    setProgress(100);

    try {
      // ── Find which RFID card to update ──────────────────────────────────
      const cardId = await findCardId(propCardId);

      if (cardId) {
        // Read current balance, add recharged amount, write back to RTDB
        const balSnap = await get(ref(db_realtime, `vehicles/${cardId}/balance`));
        const currentBalance = Number(balSnap.val() ?? 0);
        const newBalance = currentBalance + amt;

        await update(ref(db_realtime, `vehicles/${cardId}`), { balance: newBalance });

        console.log(`[Recharge] ✓ Card: ${cardId} | +₹${amt} | ${currentBalance} → ${newBalance}`);
      } else {
        console.warn('[Recharge] No vehicle found in RTDB. Balance not updated.');
      }
    } catch (e) {
      console.error('[Recharge] RTDB write failed:', e);
    }

    setTxnId('PG' + Date.now().toString().slice(-10).toUpperCase());
    setStep('success');
  };

  const handleClose = () => {
    setStep('amount'); setAmount(''); setMethod('card');
    setCardNo(''); setExpiry(''); setCvv(''); setCardName('');
    setUpiId(''); setUpiApp(''); setBank(''); setProgress(0);
    onClose();
  };

  const stepIdx = STEPS.indexOf(step);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin   { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer{ 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes glow-pulse { 0%,100%{box-shadow:0 0 20px rgba(0,255,170,0.08)} 50%{box-shadow:0 0 40px rgba(0,255,170,0.18),0 0 60px rgba(0,255,170,0.06)} }
        .pay-fade { animation: fadeUp 0.22s ease; }
        .pgbar {
          height:3px; border-radius:2px;
          background:linear-gradient(90deg,#00ffaa,#00aaff,#00ffaa);
          background-size:200% 100%;
          animation:shimmer 1.2s linear infinite;
          transition:width 0.3s ease;
        }
        .rch-modal-glow { animation: glow-pulse 3s ease-in-out infinite; }
        .rch-input::placeholder { color: #4a6a80; }
        .rch-input:focus { border-color: rgba(0,255,170,0.4); background: rgba(0,255,170,0.04); box-shadow: 0 0 0 3px rgba(0,255,170,0.06); }
        .rch-title {
          font-family: 'Inter', sans-serif;
          font-size: 15px; color: #e0e6f0; letter-spacing: 0.1em;
        }
        .rch-sub {
          font-family: 'Inter', sans-serif;
          font-size: 9px; color: #3a5068; letter-spacing: 0.12em; margin-top: 3px;
        }
      `}</style>

      <div style={S.overlay} onClick={e => { if (e.target===e.currentTarget && step!=='processing') handleClose(); }}>
        <div style={S.modal} className="rch-modal-glow">

          {/* Top accent line */}
          <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:'linear-gradient(90deg,transparent,rgba(0,255,170,0.6),transparent)'}}/>

          {/* Close button */}
          {step!=='processing' && (
            <button onClick={handleClose}
              style={{position:'absolute',top:'14px',right:'14px',zIndex:10,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',color:'#4a6080',width:'28px',height:'28px',borderRadius:'4px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all 0.2s'}}
              onMouseEnter={e=>{e.currentTarget.style.color='#ff6666';e.currentTarget.style.borderColor='rgba(255,68,68,0.35)';}}
              onMouseLeave={e=>{e.currentTarget.style.color='#4a6080';e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';}}>
              <X size={13}/>
            </button>
          )}

          {/* Step indicator */}
          {!['processing','success'].includes(step) && (
            <div style={{padding:'18px 56px 0 24px',display:'flex',alignItems:'center',gap:'6px'}}>
              {STEPS.map((s,i)=>(
                <React.Fragment key={s}>
                  <div style={{width:'22px',height:'22px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontFamily:'"Inter",sans-serif',fontWeight:'700',background:step===s?'rgba(0,255,170,0.2)':stepIdx>i?'rgba(0,255,170,0.12)':'rgba(255,255,255,0.04)',border:step===s?'1px solid rgba(0,255,170,0.5)':'1px solid rgba(255,255,255,0.08)',color:step===s?'#00ffaa':stepIdx>i?'#00ffaa':'#4a6080'}}>{i+1}</div>
                  {i<2 && <div style={{flex:1,height:'1px',background:stepIdx>i?'rgba(0,255,170,0.3)':'rgba(255,255,255,0.06)'}}/>}
                </React.Fragment>
              ))}
              <div style={{marginLeft:'8px',fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#4a6080',letterSpacing:'0.01em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                {step==='amount'?'Select Amount':step==='method'?'Payment Method':'Enter Details'}
              </div>
            </div>
          )}

          {/* ── STEP 1: AMOUNT ─────────────────────────────────────────────── */}
          {step==='amount' && (
            <div className="pay-fade" style={{padding:'20px 24px 24px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
                <div style={{background:'rgba(0,170,255,0.08)',border:'1px solid rgba(0,170,255,0.2)',padding:'8px',borderRadius:'5px',display:'flex'}}>
                  <CreditCard size={17} color="#00aaff"/>
                </div>
                <div>
                  <div className="rch-title">RECHARGE WALLET</div>
                  <div className="rch-sub">SECURE PAYMENT · MIN ₹1,000 FOR ACCESS</div>
                </div>
              </div>

              <span style={S.lbl}>Quick Select</span>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'16px'}}>
                {PRESETS.map(p=>(
                  <button key={p} type="button" onClick={()=>setAmount(p.toString())}
                    style={{padding:'12px 0',borderRadius:'5px',cursor:'pointer',fontFamily:'"Inter",sans-serif',fontSize:'12px',fontWeight:'700',transition:'all 0.15s',background:amount===p.toString()?'rgba(0,255,170,0.15)':'rgba(255,255,255,0.08)',border:amount===p.toString()?'1px solid rgba(0,255,170,0.5)':'1px solid rgba(255,255,255,0.2)',color:amount===p.toString()?'#00ffaa':'#f0f4ff',boxShadow:amount===p.toString()?'0 0 12px rgba(0,255,170,0.1)':'none'}}>
                    ₹{p.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              <span style={S.lbl}>Custom Amount</span>
              <div style={{position:'relative',marginBottom:'16px'}}>
                <span style={{position:'absolute',left:'14px',top:'50%',transform:'translateY(-50%)',color:'#8ab0c8',fontFamily:'"Inter",sans-serif',fontSize:'14px'}}>₹</span>
                <input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"
                  style={{...S.input,paddingLeft:'30px',fontSize:'15px',fontWeight:'700'}} onFocus={focusIn} onBlur={focusOut}/>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'18px',padding:'10px 12px',background:'rgba(0,255,170,0.03)',border:'1px solid rgba(0,255,170,0.08)',borderRadius:'4px'}}>
                <Zap size={11} color="#00ffaa" style={{flexShrink:0}}/>
                <span style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#8ab0c8',letterSpacing:'0.01em'}}>Balance updates instantly after payment · HMV ₹100/kWh · LMV ₹7/kWh</span>
              </div>

              <button onClick={()=>validAmount&&setStep('method')} disabled={!validAmount}
                style={{width:'100%',background:validAmount?'rgba(0,255,170,0.12)':'rgba(255,255,255,0.06)',border:validAmount?'1px solid rgba(0,255,170,0.4)':'1px solid rgba(255,255,255,0.15)',color:validAmount?'#00ffaa':'#6a8aaa',padding:'13px',borderRadius:'5px',cursor:validAmount?'pointer':'not-allowed',fontFamily:'"Inter",sans-serif',fontWeight:'700',fontSize:'11px',letterSpacing:'0.04em',textTransform:'uppercase',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'all 0.2s'}}>
                {validAmount?`PROCEED · ₹${parseFloat(amount).toLocaleString('en-IN')}`:'SELECT AN AMOUNT'}
                {validAmount&&<ChevronRight size={14}/>}
              </button>
            </div>
          )}

          {/* ── STEP 2: METHOD ─────────────────────────────────────────────── */}
          {step==='method' && (
            <div className="pay-fade" style={{padding:'20px 24px 24px'}}>
              <button onClick={()=>setStep('amount')} style={{background:'none',border:'none',color:'#8aaabb',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',marginBottom:'16px',padding:0,fontFamily:'"Inter",sans-serif',fontSize:'10px',letterSpacing:'0.01em',color:'#8aaabb'}}>
                <ArrowLeft size={12}/> BACK
              </button>
              <div style={{marginBottom:'20px'}}>
                <div style={{fontFamily:'"Inter",sans-serif',fontSize:'13px',color:'#e0e6f0',fontWeight:'700',letterSpacing:'0.01em'}}>Payment Method</div>
                <div style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#7a9ab0',letterSpacing:'0.01em',marginTop:'3px'}}>AMOUNT: <span style={{color:'#00ffaa'}}>₹{parseFloat(amount).toLocaleString('en-IN')}</span></div>
              </div>

              {[
                {id:'card',       icon:<CreditCard size={16}/>, label:'Debit / Credit Card', sub:'Visa, Mastercard, RuPay'},
                {id:'upi',        icon:<Smartphone size={16}/>, label:'UPI',                  sub:'GPay, PhonePe, Paytm, BHIM'},
                {id:'netbanking', icon:<Building2  size={16}/>, label:'Net Banking',           sub:'All major banks supported'},
              ].map(m=>(
                <button key={m.id} onClick={()=>setMethod(m.id)}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px',borderRadius:'5px',marginBottom:'8px',cursor:'pointer',background:method===m.id?'rgba(0,255,170,0.07)':'rgba(255,255,255,0.06)',border:method===m.id?'1px solid rgba(0,255,170,0.35)':'1px solid rgba(255,255,255,0.18)',transition:'all 0.15s',textAlign:'left'}}>
                  <div style={{color:method===m.id?'#00ffaa':'#8aaabb',transition:'color 0.15s'}}>{m.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'"Inter",sans-serif',fontSize:'13px',fontWeight:'600',color:method===m.id?'#ffffff':'#d0dde8'}}>{m.label}</div>
                    <div style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#7a9ab0',marginTop:'2px',letterSpacing:'0.01em'}}>{m.sub}</div>
                  </div>
                  <div style={{width:'16px',height:'16px',borderRadius:'50%',border:method===m.id?'5px solid #00ffaa':'1px solid rgba(255,255,255,0.4)',transition:'all 0.15s'}}/>
                </button>
              ))}

              <button onClick={()=>setStep('details')}
                style={{width:'100%',marginTop:'8px',background:'rgba(0,255,170,0.12)',border:'1px solid rgba(0,255,170,0.4)',color:'#00ffaa',padding:'13px',borderRadius:'5px',cursor:'pointer',fontFamily:'"Inter",sans-serif',fontWeight:'700',fontSize:'11px',letterSpacing:'0.04em',textTransform:'uppercase',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                CONTINUE <ChevronRight size={14}/>
              </button>
            </div>
          )}

          {/* ── STEP 3: DETAILS ────────────────────────────────────────────── */}
          {step==='details' && (
            <div className="pay-fade" style={{padding:'20px 24px 24px'}}>
              <button onClick={()=>setStep('method')} style={{background:'none',border:'none',color:'#8aaabb',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',marginBottom:'16px',padding:0,fontFamily:'"Inter",sans-serif',fontSize:'10px',letterSpacing:'0.01em',color:'#8aaabb'}}>
                <ArrowLeft size={12}/> BACK
              </button>
              <div style={{marginBottom:'18px'}}>
                <div style={{fontFamily:'"Inter",sans-serif',fontSize:'13px',color:'#e0e6f0',fontWeight:'700',letterSpacing:'0.01em'}}>{method==='card'?'Card Details':method==='upi'?'UPI Payment':'Net Banking'}</div>
                <div style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#7a9ab0',letterSpacing:'0.01em',marginTop:'3px'}}>PAYING: <span style={{color:'#00ffaa'}}>₹{parseFloat(amount).toLocaleString('en-IN')}</span></div>
              </div>

              {/* CARD */}
              {method==='card' && (
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  <div>
                    <span style={S.lbl}>Cardholder Name</span>
                    <input value={cardName} onChange={e=>setCardName(e.target.value)} placeholder="Name as on card" style={S.input} onFocus={focusIn} onBlur={focusOut}/>
                  </div>
                  <div>
                    <span style={S.lbl}>Card Number</span>
                    <input value={cardNo} onChange={e=>setCardNo(formatCard(e.target.value))} placeholder="0000 0000 0000 0000" maxLength={19} style={{...S.input,letterSpacing:'0.02em'}} onFocus={focusIn} onBlur={focusOut}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                    <div>
                      <span style={S.lbl}>Expiry (MM/YY)</span>
                      <input value={expiry} onChange={e=>setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} style={S.input} onFocus={focusIn} onBlur={focusOut}/>
                    </div>
                    <div>
                      <span style={S.lbl}>CVV</span>
                      <input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,3))} placeholder="•••" maxLength={3} type="password" style={S.input} onFocus={focusIn} onBlur={focusOut}/>
                    </div>
                  </div>
                </div>
              )}

              {/* UPI */}
              {method==='upi' && (
                <div>
                  <span style={S.lbl}>Select UPI App</span>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'16px'}}>
                    {UPI_APPS.map(app=>(
                      <button key={app.name} onClick={()=>{setUpiApp(app.name);setUpiId('');}}
                        style={{padding:'12px 6px',borderRadius:'5px',cursor:'pointer',textAlign:'center',background:upiApp===app.name?'rgba(0,255,170,0.08)':'rgba(255,255,255,0.07)',border:upiApp===app.name?'1px solid rgba(0,255,170,0.4)':'1px solid rgba(255,255,255,0.2)',display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'}}>
                        <div style={{width:'28px',height:'28px',borderRadius:'50%',background:app.color,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'800',fontSize:'12px'}}>{app.letter}</div>
                        <span style={{fontFamily:'"Inter",sans-serif',fontSize:'8px',color:upiApp===app.name?'#00ffaa':'#a0bcd0',letterSpacing:'0.01em'}}>{app.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                  <span style={S.lbl}>Or Enter UPI ID</span>
                  <input value={upiId} onChange={e=>{setUpiId(e.target.value);setUpiApp('');}} placeholder="yourname@upi" style={S.input} onFocus={focusIn} onBlur={focusOut}/>
                </div>
              )}

              {/* NET BANKING */}
              {method==='netbanking' && (
                <div style={{maxHeight:'220px',overflowY:'auto'}}>
                  <span style={S.lbl}>Select Your Bank</span>
                  <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                    {BANKS.map(b=>(
                      <button key={b} onClick={()=>setBank(b)}
                        style={{width:'100%',padding:'11px 14px',borderRadius:'4px',cursor:'pointer',textAlign:'left',background:bank===b?'rgba(0,255,170,0.07)':'rgba(255,255,255,0.06)',border:bank===b?'1px solid rgba(0,255,170,0.3)':'1px solid rgba(255,255,255,0.18)',color:bank===b?'#ffffff':'#c0d4e0',fontFamily:'"Inter",sans-serif',fontSize:'12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        {b}
                        {bank===b && <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#00ffaa'}}/>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'14px 0',padding:'8px 12px',background:'rgba(0,255,170,0.02)',border:'1px solid rgba(0,255,170,0.07)',borderRadius:'4px'}}>
                <Lock size={10} color="#00ffaa" style={{flexShrink:0}}/>
                <span style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#7a9ab0',letterSpacing:'0.04em'}}>256-bit SSL encrypted · PCI DSS compliant · Safe & Secure</span>
              </div>

              <button onClick={handlePay} disabled={!canProceed()}
                style={{width:'100%',background:canProceed()?'rgba(0,255,170,0.12)':'rgba(255,255,255,0.06)',border:canProceed()?'1px solid rgba(0,255,170,0.4)':'1px solid rgba(255,255,255,0.15)',color:canProceed()?'#00ffaa':'#6a8aaa',padding:'13px',borderRadius:'5px',cursor:canProceed()?'pointer':'not-allowed',fontFamily:'"Inter",sans-serif',fontWeight:'700',fontSize:'11px',letterSpacing:'0.04em',textTransform:'uppercase',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'all 0.2s'}}>
                <ShieldCheck size={14}/> PAY ₹{parseFloat(amount).toLocaleString('en-IN')} SECURELY
              </button>
            </div>
          )}

          {/* ── PROCESSING ─────────────────────────────────────────────────── */}
          {step==='processing' && (
            <div className="pay-fade" style={{padding:'48px 28px',textAlign:'center'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:'20px'}}>
                <Loader2 size={40} color="#00ffaa" style={{animation:'spin 1s linear infinite'}}/>
              </div>
              <div style={{fontFamily:'"Inter",sans-serif',fontSize:'12px',color:'#00ffaa',letterSpacing:'0.04em',marginBottom:'6px'}}>PROCESSING PAYMENT</div>
              <div style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#3a5068',letterSpacing:'0.01em',marginBottom:'24px'}}>₹{parseFloat(amount).toLocaleString('en-IN')} · DO NOT CLOSE THIS WINDOW</div>
              <div style={{width:'100%',height:'3px',background:'rgba(255,255,255,0.05)',borderRadius:'2px',overflow:'hidden',marginBottom:'16px'}}>
                <div className="pgbar" style={{width:`${Math.min(progress,100)}%`}}/>
              </div>
              <div style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#2a4060',letterSpacing:'0.01em'}}>
                {progress<30?'INITIATING TRANSACTION...':progress<60?'VERIFYING PAYMENT...':progress<85?'CONFIRMING WITH BANK...':'UPDATING WALLET...'}
              </div>
            </div>
          )}

          {/* ── SUCCESS ────────────────────────────────────────────────────── */}
          {step==='success' && (
            <div className="pay-fade" style={{padding:'40px 28px',textAlign:'center'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:'16px'}}>
                <div style={{width:'64px',height:'64px',borderRadius:'50%',background:'rgba(0,255,170,0.1)',border:'2px solid rgba(0,255,170,0.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <CheckCircle2 size={34} color="#00ffaa"/>
                </div>
              </div>
              <div style={{fontFamily:'"Inter",sans-serif',fontSize:'11px',color:'#00ffaa',letterSpacing:'0.04em',marginBottom:'6px'}}>PAYMENT SUCCESSFUL</div>
              <div style={{fontFamily:'"Inter",sans-serif',fontWeight:'800',fontSize:'34px',color:'#e0e6f0',marginBottom:'4px'}}>₹{parseFloat(amount).toLocaleString('en-IN')}</div>
              <div style={{fontSize:'12px',color:'#4a6080',marginBottom:'20px'}}>added to your Pantograph wallet</div>

              <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'5px',padding:'14px',marginBottom:'20px',textAlign:'left'}}>
                {[
                  ['Transaction ID',  txnId],
                  ['Payment Method',  method==='card'?'Debit/Credit Card':method==='upi'?(upiApp||'UPI'):`Net Banking · ${bank}`],
                  ['Amount Paid',     `₹${parseFloat(amount).toLocaleString('en-IN')}`],
                  ['Status',          'SUCCESS ✓'],
                ].map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    <span style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:'#4a6080',letterSpacing:'0.01em'}}>{k}</span>
                    <span style={{fontFamily:'"Inter",sans-serif',fontSize:'9px',color:k==='Status'?'#00ffaa':'#a0b4c8',letterSpacing:'0.01em'}}>{v}</span>
                  </div>
                ))}
              </div>

              <button onClick={handleClose}
                style={{width:'100%',background:'rgba(0,255,170,0.1)',border:'1px solid rgba(0,255,170,0.3)',color:'#00ffaa',padding:'12px',borderRadius:'5px',cursor:'pointer',fontFamily:'"Inter",sans-serif',fontSize:'11px',letterSpacing:'0.02em',textTransform:'uppercase'}}>
                BACK TO DASHBOARD
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default RechargeModal;