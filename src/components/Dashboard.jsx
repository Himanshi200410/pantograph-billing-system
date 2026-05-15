import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  Zap, Activity, Battery, Download, Plus, WifiOff,
  AlertTriangle, BarChart3, Gauge, X
} from 'lucide-react';
import { db_realtime, db } from "../firebase/firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { doc, onSnapshot, collection, addDoc, query, orderBy, getDocs } from "firebase/firestore";
import RechargeModal from './RechargeModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Constants ────────────────────────────────────────────────────────────────
const RATES             = { HMV: 100.0, LMV: 7.0 };
const SERVICE_PCT       = 0.02;   // 2%  — must stay 0.02
const GST_PCT           = 0.18;   // 18% — must stay 0.18
const MIN_BALANCE       = 1000;
const CURRENT_THRESHOLD = 0.05;
const OFFLINE_THRESHOLD = 15000;
const DEMO_BILLING_SCALE = 1000;

// ─── Notification config ──────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = 'service_kgyu6r7';
const EMAILJS_TEMPLATE_ID = 'template_ls7oeos';
const EMAILJS_PUBLIC_KEY  = 'tG9bgGF3pAwoyxZqG';
const TELEGRAM_BOT_TOKEN  = '8632294900:AAGW846i8ZMDSJ6dvLYQCpS4uZeHVvwcvD4';
const TELEGRAM_CHAT_ID    = '1754425825';

const sendEmail = async (params) => {
  if (!params.to_email) {
    console.warn('[EMAIL] Skipped — to_email is empty. User has no email in profile.');
    return;
  }
  const payload = {
    service_id:      EMAILJS_SERVICE_ID,
    template_id:     EMAILJS_TEMPLATE_ID,
    user_id:         EMAILJS_PUBLIC_KEY,
    template_params: params,
  };
  console.log('[EMAIL] Sending to:', params.to_email, '| payload:', JSON.stringify(payload));
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.ok) {
      console.log('[EMAIL] ✅ Sent successfully. Response:', text);
    } else {
      console.error('[EMAIL] ❌ Failed. Status:', res.status, '| Response:', text);
      console.error('[EMAIL] ❌ Check: (1) to_email matches EmailJS template variable, (2) template_id is correct, (3) service is active');
    }
  } catch (e) {
    console.error('[EMAIL] ❌ Network error:', e);
  }
};

const sendTelegram = async (message) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
    if (res.ok) console.log('[TELEGRAM] Sent');
    else console.warn('[TELEGRAM] Failed:', await res.text());
  } catch (e) { console.warn('[TELEGRAM] Error:', e); }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const voltToBattery = (v) => !v || v <= 0 ? 0
  : Math.min(100, Math.max(0, Math.round(((v - 7.6) / (12.6 - 7.6)) * 100)));

const fmt     = (n, d = 2) => (typeof n === 'number' && !isNaN(n) ? n.toFixed(d) : '0.' + '0'.repeat(d));
const fmtINR  = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';

// ─── Daily energy bar chart tooltip ──────────────────────────────────────────
const DailyTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(10,14,26,0.97)', border: '1px solid rgba(0,255,170,0.25)',
        borderRadius: '6px', padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace'
      }}>
        <p style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>{label}</p>
        <p style={{ color: '#00ffaa', fontSize: '13px', fontWeight: 700 }}>{fmt(payload[0].value, 2)} kWh</p>
      </div>
    );
  }
  return null;
};

// ─── PDF generator ────────────────────────────────────────────────────────────

const generateInvoiceFromSession = (session, userData) => {
  const pdoc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, RX = 30, RW = 150;

  const rate       = RATES[session.vehicleType || userData.vehicleType] || RATES['HMV'];

  // ── FIXED: always use saved fields, never recalculate from energy_kWh ──────
  const base       = session.base_amount    ?? 0;
  const svc        = session.service_charge ?? (base * SERVICE_PCT);
  const gst        = session.gst            ?? (base * GST_PCT);
  const totalBill  = session.cost           ?? (base + svc + gst);
  // ──────────────────────────────────────────────────────────────────────────

  // For display only: show raw meter delta in Wh
  const rawDelta_Wh = (session.cumWh_end !== undefined && session.cumWh_start !== undefined)
    ? Math.max(0, session.cumWh_end - session.cumWh_start)
    : null;
  // Billing kWh derived from base_amount (for display only)
  const billing_kWh = rate > 0 ? base / rate : 0;

  const newBalance = session.balance_after  ?? 0;
  const vNum       = session.vehicleNumber  || userData.vehicleNumber || '---';
  const vType      = session.vehicleType    || userData.vehicleType   || 'HMV';
  const fullName   = userData.fullName      || '---';
  const sessionDate = session.startedAt?.toDate ? session.startedAt.toDate() : new Date(session.startedAt);
  const inr = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;
  const invoiceNo = `PG-${Date.now().toString().slice(-8)}`;

  pdoc.setFillColor(252, 252, 252); pdoc.rect(0, 0, W, 297, 'F');
  pdoc.setFillColor(255, 255, 255); pdoc.setDrawColor(200, 200, 200); pdoc.setLineWidth(0.3);
  pdoc.roundedRect(RX, 10, RW, 175, 2, 2, 'FD');
  let y = 22;

  pdoc.setFont('helvetica', 'bold'); pdoc.setFontSize(14); pdoc.setTextColor(20, 20, 20);
  pdoc.text('PANTOGRAPH', W / 2, y, { align: 'center' }); y += 5;
  pdoc.setFont('helvetica', 'normal'); pdoc.setFontSize(7); pdoc.setTextColor(130, 130, 130);
  pdoc.text('E-HIGHWAY BILLING SYSTEM', W / 2, y, { align: 'center' }); y += 3;
  pdoc.setDrawColor(200, 200, 200); pdoc.setLineDashPattern([1, 1], 0); pdoc.setLineWidth(0.2);
  pdoc.line(RX + 4, y, RX + RW - 4, y); y += 5; pdoc.setLineDashPattern([], 0);

  pdoc.setFont('helvetica', 'bold'); pdoc.setFontSize(7.5); pdoc.setTextColor(60, 60, 60);
  pdoc.text('RECEIPT', RX + 4, y);
  pdoc.text(`#${invoiceNo}`, RX + RW - 4, y, { align: 'right' }); y += 4;
  pdoc.setFont('helvetica', 'normal'); pdoc.setFontSize(7); pdoc.setTextColor(130, 130, 130);
  pdoc.text(
    `${sessionDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  ${sessionDate.toLocaleTimeString('en-IN')}`,
    W / 2, y, { align: 'center' }
  ); y += 5;

  pdoc.setFillColor(245, 247, 250); pdoc.rect(RX + 2, y - 1, RW - 4, 14, 'F');
  pdoc.setFont('helvetica', 'bold'); pdoc.setFontSize(9); pdoc.setTextColor(20, 20, 20);
  pdoc.text(vNum, W / 2, y + 4, { align: 'center' });
  pdoc.setFont('helvetica', 'normal'); pdoc.setFontSize(7); pdoc.setTextColor(100, 100, 100);
  pdoc.text(
    `${vType === 'HMV' ? 'Heavy Motor Vehicle' : 'Light Motor Vehicle'}  ·  Rs.${rate}/kWh  ·  ${fullName}`,
    W / 2, y + 9, { align: 'center' }
  ); y += 17;

  [
    ['Energy (Raw Meter)',  rawDelta_Wh !== null ? `${fmt(rawDelta_Wh, 4)} Wh` : `${fmt(billing_kWh, 4)} kWh`],
    [`Rate (${vType})`,    `Rs.${rate}/kWh`],
    ['Base Amount',        inr(base)],
    ['Service (2%)',       inr(svc)],
    ['GST (18%)',          inr(gst)],
  ].forEach(([lbl, val]) => {
    pdoc.setFont('helvetica', 'normal'); pdoc.setFontSize(8); pdoc.setTextColor(80, 80, 80);
    pdoc.text(lbl, RX + 6, y); pdoc.text(val, RX + RW - 6, y, { align: 'right' }); y += 5;
  });

  pdoc.setDrawColor(180, 180, 180); pdoc.setLineWidth(0.4); pdoc.line(RX + 4, y, RX + RW - 4, y); y += 4;
  pdoc.setFont('helvetica', 'bold'); pdoc.setFontSize(10); pdoc.setTextColor(20, 20, 20);
  pdoc.text('TOTAL', RX + 6, y); pdoc.text(inr(totalBill), RX + RW - 6, y, { align: 'right' }); y += 3;
  pdoc.setLineWidth(0.4); pdoc.line(RX + 4, y, RX + RW - 4, y); y += 5;
  pdoc.setFont('helvetica', 'normal'); pdoc.setFontSize(7.5); pdoc.setTextColor(80, 80, 80);
  pdoc.text('Wallet Balance After', RX + 6, y);
  pdoc.setFont('helvetica', 'bold'); pdoc.text(inr(newBalance), RX + RW - 6, y, { align: 'right' }); y += 6;
  pdoc.setDrawColor(200, 200, 200); pdoc.setLineDashPattern([1, 1], 0); pdoc.setLineWidth(0.2);
  pdoc.line(RX + 4, y, RX + RW - 4, y); y += 5; pdoc.setLineDashPattern([], 0);
  pdoc.setFont('helvetica', 'normal'); pdoc.setFontSize(6.5); pdoc.setTextColor(150, 150, 150);
  pdoc.text('System-generated · No signature required', W / 2, y, { align: 'center' }); y += 4;
  pdoc.text('Disputes: pantograph-web-a4e67.web.app', W / 2, y, { align: 'center' });

  pdoc.save(`Pantograph_Receipt_${vNum}_${invoiceNo}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = ({ user }) => {
  const [isRechargeOpen, setIsRechargeOpen]   = useState(false);
  const [dailyChartData, setDailyChartData]   = useState([]);
  const [sessionHistory, setSessionHistory]   = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  const [live, setLive] = useState({
    voltage: 0, current: 0, power_W: 0,
    total_Wh: 0, energy_Wh: 0, energy_kWh: 0,
    isConnected: false, lastUpdated: null
  });

  const [controlAccess, setControlAccess] = useState(0);
  const [rfidCardId, setRfidCardId]       = useState(null);
  const rfidCardIdRef                     = useRef(null);

  const sessionSaved   = useRef(false);
  const sessionStarted = useRef(false);
  const sessionSnap    = useRef({ cumWh_start: 0, startTime: null, balanceAtStart: 0 });
  const prevTotal_Wh   = useRef(0);
  const lastSeenRef    = useRef(null);
  const prevAccessRef  = useRef(0);

  const cumulativeWhRef    = useRef(0);
  const sessionStartCumRef = useRef(0);

  const [espActuallyOnline, setEspActuallyOnline] = useState(false);
  const [lastKnownVoltage, setLastKnownVoltage]   = useState(0);
  const [rtdbBalance, setRtdbBalance]             = useState(null);
  const [meterReading, setMeterReading]           = useState({ cumWh: 0, lastSessionEndWh: 0 });
  const [sessionCumStart, setSessionCumStart]     = useState(0);

  const [userData, setUserData] = useState({
    vehicleNumber: '---', fullName: '', vehicleType: 'HMV', email: ''
  });
  const userDataRef = useRef(userData);
  useEffect(() => { userDataRef.current = userData; }, [userData]);

  const rate          = RATES[userData.vehicleType] || RATES['HMV'];
  const walletBalance = rtdbBalance !== null ? rtdbBalance : 0;
  const walletBalanceRef = useRef(0);
  useEffect(() => { walletBalanceRef.current = walletBalance; }, [walletBalance]);

  const batPct = voltToBattery(lastKnownVoltage || live.voltage);
  const batHex = batPct > 60 ? '#00ffaa' : batPct > 30 ? '#ffd700' : '#ff4444';

  // ─── BILLING CALCULATION (live display only) ──────────────────────────────
  const billing_kWh = (live.energy_Wh * DEMO_BILLING_SCALE) / 1000;
  const baseAmt     = billing_kWh * rate;
  const svcCharge   = baseAmt * SERVICE_PCT;
  const gstAmt      = baseAmt * GST_PCT;
  const totalBill   = baseAmt + svcCharge + gstAmt;
  // ─────────────────────────────────────────────────────────────────────────

  // ── 1. Firestore: user profile ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setUserData({
        vehicleNumber: d.vehicleNumber || '---',
        fullName:      d.fullName      || '',
        vehicleType:   d.vehicleType   || 'HMV',
        email:         d.email         || '',
      });
    });
  }, [user]);

  // ── 2. RTDB: balance + restore meter ──────────────────────────────────────
  const normalizeVehicle = (s) => (s || '').replace(/["'\s]/g, '').toUpperCase();

  useEffect(() => {
    if (!user) return;
    let balanceUnsub = null;

    const cardIdUnsub = onValue(ref(db_realtime, 'control/cardId'), snapCard => {
      const cid = snapCard.val();
      if (cid) {
        setRfidCardId(cid);
        rfidCardIdRef.current = cid;
        if (balanceUnsub) balanceUnsub();
        balanceUnsub = onValue(ref(db_realtime, `vehicles/${cid}/balance`), snapBal => {
          const b = snapBal.val();
          if (b !== null && b !== undefined) {
            const bal = Number(b);
            setRtdbBalance(bal);
            walletBalanceRef.current = bal;
          }
        });
      }
    });

    const vehiclesUnsub = onValue(ref(db_realtime, 'vehicles'), snap => {
      const vehicles = snap.val();
      if (!vehicles) return;
      const vNum = normalizeVehicle(userDataRef.current.vehicleNumber);

      for (const cardId of Object.keys(vehicles)) {
        const v = vehicles[cardId];
        const storedNo       = normalizeVehicle(v.vehicleNo);
        const matchByVehicle = vNum && storedNo && storedNo === vNum;
        const matchBySession = v.session === 1;

        if (matchByVehicle || matchBySession) {
          setRtdbBalance(Number(v.balance ?? 0));
          walletBalanceRef.current = Number(v.balance ?? 0);
          setRfidCardId(cardId);
          rfidCardIdRef.current = cardId;

          if (v.cumulativeWh !== undefined && v.cumulativeWh !== null) {
            cumulativeWhRef.current = Number(v.cumulativeWh);
          }
          const lsew = v.lastSessionEndWh !== undefined ? Number(v.lastSessionEndWh) : 0;
          setMeterReading({ cumWh: cumulativeWhRef.current, lastSessionEndWh: lsew });
          break;
        }
      }
    });

    return () => { cardIdUnsub(); vehiclesUnsub(); if (balanceUnsub) balanceUnsub(); };
  }, [user]);

  // ── PATCH: helper to resolve cardId from vehicles node if missing ──────────
  const resolveCardIdFromVehicles = async () => {
    if (rfidCardIdRef.current) return rfidCardIdRef.current;

    try {
      const vehiclesSnap = await get(ref(db_realtime, 'vehicles'));
      const vehicles = vehiclesSnap.val();
      if (!vehicles) return null;

      const myVehicle = normalizeVehicle(userDataRef.current.vehicleNumber);

      for (const cardId of Object.keys(vehicles)) {
        const v = vehicles[cardId];
        const storedNo = normalizeVehicle(v.vehicleNo);
        const matchByVehicle = myVehicle && storedNo && storedNo === myVehicle;
        const matchBySession = v.session === 1;

        if (matchByVehicle || matchBySession) {
          console.log('[PATCH] Resolved cardId from vehicles scan:', cardId);
          rfidCardIdRef.current = cardId;
          setRfidCardId(cardId);

          if (v.balance !== undefined) {
            setRtdbBalance(Number(v.balance));
            walletBalanceRef.current = Number(v.balance);
          }
          if (v.cumulativeWh !== undefined) {
            cumulativeWhRef.current = Number(v.cumulativeWh);
            setMeterReading(prev => ({ ...prev, cumWh: Number(v.cumulativeWh) }));
          }
          return cardId;
        }
      }
    } catch (e) {
      console.warn('[PATCH] resolveCardIdFromVehicles error:', e);
    }
    return null;
  };

  // ── 3 & 4. RTDB: access gate + live data ──────────────────────────────────
  const controlAccessRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    const accessUnsub = onValue(ref(db_realtime, 'control/access'), async snap => {
      const val = snap.val() ?? 0;

      if (!rfidCardIdRef.current) {
        console.log('[PATCH] cardId missing on access change, scanning vehicles...');
        await resolveCardIdFromVehicles();
      }

      if (prevAccessRef.current === 0 && val === 1 && !sessionStarted.current) {
        sessionStarted.current = true;
        sessionSaved.current   = false;
        const balanceNow       = walletBalanceRef.current;
        sessionStartCumRef.current = cumulativeWhRef.current;
        setSessionCumStart(cumulativeWhRef.current);
        sessionSnap.current = {
          cumWh_start:    cumulativeWhRef.current,
          startTime:      new Date(),
          balanceAtStart: balanceNow,
        };
        console.log('[ENTRY GATE] cumWh_start:', cumulativeWhRef.current, 'Wh');
      }

      if (
        prevAccessRef.current === 1 && val === 0 &&
        sessionStarted.current && !sessionSaved.current
      ) {
        console.log('[EXIT GATE] cumWh_exit:', cumulativeWhRef.current, 'Wh');
        console.log('[EXIT GATE] cardId at exit:', rfidCardIdRef.current);
        sessionStarted.current = false;
        setSessionCumStart(0);
        handleSessionEnd(cumulativeWhRef.current);
      }

      prevAccessRef.current    = val;
      controlAccessRef.current = val;
      setControlAccess(val);
    });

    let fireCount = 0;
    const mountTime = Date.now();

    const dataUnsub = onValue(ref(db_realtime, 'data'), snap => {
      const v = snap.val();
      if (!v) return;

      fireCount++;
      const voltage     = v.voltage  || 0;
      const current     = v.current  || 0;
      const total_Wh    = v.total_Wh || 0;
      const power_W     = parseFloat((voltage * current).toFixed(4));
      const receiveTime = Date.now();
      const isLiveFire  = fireCount > 1 || (receiveTime - mountTime) > 12000;

      if (isLiveFire) {
        lastSeenRef.current = Date.now();
        setEspActuallyOnline(true);
        if (v.voltage > 0) setLastKnownVoltage(v.voltage);
      }

      if (fireCount === 1) {
        prevTotal_Wh.current = total_Wh;
        setLive(prev => ({ ...prev, voltage, current, power_W, total_Wh, energy_Wh: 0, energy_kWh: 0 }));
        return;
      }

      const increment_Wh = Math.max(0, total_Wh - prevTotal_Wh.current);
      if (sessionStarted.current && increment_Wh > 0) {
        cumulativeWhRef.current += increment_Wh;
        const cardId = rfidCardIdRef.current;
        if (cardId) {
          update(ref(db_realtime, `vehicles/${cardId}`), {
            cumulativeWh: parseFloat(cumulativeWhRef.current.toFixed(4))
          }).catch(e => console.warn('[RTDB] cumulativeWh update failed:', e));
        }
        setMeterReading(prev => ({ ...prev, cumWh: cumulativeWhRef.current }));
      }

      const isConn   = voltage > 0 && current > CURRENT_THRESHOLD;
      const delta_Wh = sessionStarted.current
        ? Math.max(0, cumulativeWhRef.current - sessionStartCumRef.current)
        : 0;

      setLive({
        voltage, current, power_W, total_Wh,
        energy_Wh:   delta_Wh,
        energy_kWh:  delta_Wh / 1000,
        isConnected: sessionStarted.current && isConn,
        lastUpdated: (sessionStarted.current && isConn) ? new Date(receiveTime).toISOString() : null,
      });

      prevTotal_Wh.current = total_Wh;
    });

    const stalenessTimer = setInterval(() => {
      if (!lastSeenRef.current) return;
      const age = Date.now() - lastSeenRef.current;
      if (age > OFFLINE_THRESHOLD) {
        setEspActuallyOnline(false);
        setLive(prev => ({ ...prev, isConnected: false, energy_kWh: 0 }));
      }
    }, 8000);

    return () => { accessUnsub(); dataUnsub(); clearInterval(stalenessTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Session End ───────────────────────────────────────────────────────────
  const handleSessionEnd = async (cumWh_exit) => {
    if (sessionSaved.current) return;
    sessionSaved.current = true;

    const ud   = userDataRef.current;
    const snap = sessionSnap.current;
    const r    = RATES[ud.vehicleType] || RATES['HMV'];

    let cardId = rfidCardIdRef.current;
    if (!cardId) {
      console.warn('[SESSION END] cardId still null, doing final vehicle scan...');
      cardId = await resolveCardIdFromVehicles();
    }
    console.log('[SESSION END] using cardId:', cardId);

    const delta_Wh        = Math.max(0, cumWh_exit - snap.cumWh_start);
    const energy_kWh_used = (delta_Wh * DEMO_BILLING_SCALE) / 1000;

    const base      = energy_kWh_used * r;
    const svc       = base * SERVICE_PCT;
    const gst       = base * GST_PCT;
    const finalBill = base + svc + gst;

    let currentBalance = walletBalanceRef.current;
    if (currentBalance <= 0 && cardId) {
      try {
        const snap2 = await get(ref(db_realtime, `vehicles/${cardId}/balance`));
        if (snap2.exists()) currentBalance = Number(snap2.val());
      } catch (e) { console.warn('[SESSION END] balance fetch error:', e); }
    }

    const newBalance = Math.max(0, currentBalance - finalBill);
    setRtdbBalance(newBalance);
    walletBalanceRef.current = newBalance;

    if (cardId) {
      try {
        await update(ref(db_realtime, `vehicles/${cardId}`), {
          balance:          newBalance,
          cumulativeWh:     parseFloat(cumWh_exit.toFixed(4)),
          lastSessionEndWh: parseFloat(cumWh_exit.toFixed(4)),
        });
        setMeterReading({ cumWh: cumWh_exit, lastSessionEndWh: cumWh_exit });
      } catch (e) { console.error('[RTDB] update failed:', e); }
    } else {
      console.error('[SESSION END] cardId still null after all attempts — Firebase write skipped');
    }

    const sessionDoc = {
      startedAt:      snap.startTime || new Date(),
      endedAt:        new Date(),
      vehicleNumber:  ud.vehicleNumber,
      vehicleType:    ud.vehicleType,
      rate_per_kwh:   r,
      energy_kWh:     energy_kWh_used,
      total_Wh:       energy_kWh_used * 1000,
      cumWh_start:    snap.cumWh_start,
      cumWh_end:      cumWh_exit,
      base_amount:    base,
      service_charge: svc,
      gst,
      cost:           finalBill,
      balance_before: snap.balanceAtStart,
      balance_after:  newBalance,
    };

    await addDoc(collection(db, 'users', user.uid, 'sessions'), sessionDoc).catch(console.error);

    getDocs(query(collection(db, 'users', user.uid, 'sessions'), orderBy('startedAt', 'asc')))
      .then(s => {
        const all     = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const last10  = all.slice(-10);
        const indexed = last10.map((sess, i) => ({ ...sess, globalIndex: all.length - last10.length + i + 1 }));
        setSessionHistory(indexed.reverse());
        buildDailyChart(all);
      });

    sendEmail({
      to_email: ud.email || '', user_name: ud.fullName || 'User',
      vehicle_number: ud.vehicleNumber || '---', vehicle_type: ud.vehicleType || 'HMV',
      energy_kwh: energy_kWh_used.toFixed(2), rate: r.toFixed(2),
      base_amount: base.toFixed(2), service_charge: svc.toFixed(2),
      gst: gst.toFixed(2), total_bill: finalBill.toFixed(2), new_balance: newBalance.toFixed(2),
    });

    sendTelegram(
      `⚡ <b>PANTOGRAPH — SESSION ENDED</b>\n\n` +
      `🚛 <b>Vehicle:</b> ${ud.vehicleNumber} (${ud.vehicleType})\n` +
      `📊 <b>Meter Entry :</b> ${snap.cumWh_start.toFixed(4)} Wh\n` +
      `📊 <b>Meter Exit  :</b> ${cumWh_exit.toFixed(4)} Wh\n` +
      `🔋 <b>Energy Used :</b> ${energy_kWh_used.toFixed(2)} kWh\n` +
      `💰 <b>Rate        :</b> ₹${r.toFixed(2)}/kWh\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Base Amount    : ₹${base.toFixed(2)}\n` +
      `Service (2%)   : ₹${svc.toFixed(2)}\n` +
      `GST (18%)      : ₹${gst.toFixed(2)}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💳 <b>Total Deducted : ₹${finalBill.toFixed(2)}</b>\n` +
      `✅ <b>Balance Left   : ₹${newBalance.toFixed(2)}</b>\n\n` +
      `Thank you for using Pantograph E-Highway!`
    );

    sessionSnap.current = { cumWh_start: 0, startTime: null, balanceAtStart: 0 };
    setLive(prev => ({ ...prev, energy_kWh: 0, energy_Wh: 0, isConnected: false }));
  };

  // ── Daily chart ───────────────────────────────────────────────────────────
  const buildDailyChart = (sessions) => {
    const map = {};
    sessions.forEach(s => {
      const date = s.startedAt?.toDate ? s.startedAt.toDate() : new Date(s.startedAt);
      const key  = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      map[key]   = (map[key] || 0) + (s.energy_kWh || 0);
    });
    setDailyChartData(
      Object.entries(map).slice(-7).map(([date, kwh]) => ({ date, kwh: parseFloat(kwh.toFixed(2)) }))
    );
  };

  // ── Load history on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'users', user.uid, 'sessions'), orderBy('startedAt', 'asc')))
      .then(snap => {
        const all     = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const last10  = all.slice(-10);
        const indexed = last10.map((s, i) => ({ ...s, globalIndex: all.length - last10.length + i + 1 }));
        setSessionHistory(indexed.reverse());
        buildDailyChart(all);
      })
      .catch(e => console.warn('History load:', e));
  }, [user]);

  // ─── Style constants ───────────────────────────────────────────────────────
  const balStatus = walletBalance <= 0
    ? { text: '⚠ CRITICAL: NO BALANCE',          cls: 'text-red-400' }
    : walletBalance < MIN_BALANCE
    ? { text: `⚠ BELOW ₹${MIN_BALANCE} MINIMUM`, cls: 'text-yellow-400' }
    : { text: '✓ SUFFICIENT FUNDS',               cls: 'text-slate-500' };

  const CARD  = "relative overflow-hidden rounded bg-[rgba(13,20,37,0.9)] border border-[rgba(0,255,170,0.12)] transition-all duration-300 hover:border-[rgba(0,255,170,0.28)] hover:shadow-[0_0_28px_rgba(0,255,170,0.08),0_2px_16px_rgba(0,0,0,0.4)] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[rgba(0,255,170,0.5)] before:to-transparent";
  const LBL   = "font-['JetBrains_Mono'] text-[10px] tracking-[0.12em] text-slate-500 uppercase";
  const SECT  = "font-['JetBrains_Mono'] text-[11px] tracking-[0.15em] text-slate-500 uppercase border-b border-[rgba(0,255,170,0.08)] pb-2 mb-4";
  const PULSE = { animation: 'pulse-dot 1.5s ease-in-out infinite' };

  const pantoActive    = live.isConnected;
  const espOnline      = espActuallyOnline && live.voltage > 0;
  const displayVoltage = espOnline ? live.voltage : 0;
  const accessGranted  = controlAccess === 1;
  const currentFlowing = live.current > CURRENT_THRESHOLD;

  return (
    <div className="min-h-screen text-slate-200"
      style={{ background: 'linear-gradient(135deg,#0a0e1a 0%,#0d1425 50%,#0a1220 100%)', fontFamily: '"Inter","Segoe UI",sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes pulse-dot    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        @keyframes charge-pulse { 0%,100%{opacity:1;filter:drop-shadow(0 0 6px #00ffaa)} 50%{opacity:0.5;filter:drop-shadow(0 0 2px #00ffaa)} }
        @keyframes zigzag-slide { 0%{stroke-dashoffset:60} 100%{stroke-dashoffset:0} }
        .zz-animated { stroke-dasharray:60; animation:zigzag-slide 1.2s linear infinite; }
        .session-row { cursor:pointer; transition:background 0.2s; }
        .session-row:hover { background:rgba(0,255,170,0.04); border-radius:6px; }
        .modal-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.75);
          display:flex; align-items:center; justify-content:center;
          z-index:9999; backdrop-filter:blur(4px);
        }
        .modal-card {
          background:#0d1425; border:1px solid rgba(0,255,170,0.2);
          border-radius:10px; padding:28px; min-width:360px; max-width:480px; position:relative;
        }
      `}</style>

      {/* ── SUB-HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 h-12 bg-[rgba(6,10,20,0.95)] border-b border-[rgba(0,255,170,0.1)] text-[11px] tracking-wide text-slate-500 font-['Inter']">
        <div className="flex items-center gap-2">
          <span>Dashboard</span>
          <span className="text-slate-700">/</span>
          <span className="text-[#00ffaa]">{userData.vehicleNumber} Status</span>
        </div>
        {pantoActive
          ? <span className="flex items-center gap-2 text-[#00ffaa] text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#00ffaa] inline-block" style={PULSE}/> LIVE · {fmtTime(live.lastUpdated)}
            </span>
          : espOnline && !accessGranted
          ? <span className="flex items-center gap-2 text-yellow-400 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/> ESP32 ONLINE · AWAITING RFID
            </span>
          : <span className="flex items-center gap-2 text-red-400 text-[11px]"><WifiOff size={12}/> OFFLINE</span>}
      </div>

      {/* ── 3-COLUMN GRID ───────────────────────────────────────────────────── */}
      <div className="p-5 grid gap-4 min-h-[calc(100vh-100px)]"
        style={{
          gridTemplateColumns: '280px 1fr 320px',
          backgroundImage: 'linear-gradient(rgba(0,255,170,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,170,.02) 1px,transparent 1px)',
          backgroundSize: '40px 40px'
        }}>

        {/* ══ LEFT COLUMN ═══════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">

          {/* ── 1. Vehicle Card ───────────────────────────────────────────────── */}
          <div className={`${CARD} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontSize: '36px', lineHeight: 1 }}>🚛</div>
              {pantoActive
                ? <span className="inline-flex items-center gap-2 bg-[rgba(0,255,100,0.15)] border border-[rgba(0,255,100,0.4)] text-[#00ff88] text-[10px] tracking-[0.18em] px-3 py-1 rounded-full font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#00ff88]" style={PULSE}/> CHARGING
                  </span>
                : espOnline
                ? <span className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] tracking-[0.15em] px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/> STANDBY
                  </span>
                : <span className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] tracking-[0.15em] px-3 py-1 rounded-full">
                    OFFLINE
                  </span>}
            </div>
            <p className="text-[11px] text-slate-500 font-['JetBrains_Mono'] tracking-widest mb-1">Vehicle ID:</p>
            <p className="font-['Inter'] font-extrabold text-[26px] text-slate-100 leading-tight mb-3">{userData.vehicleNumber}</p>

            <div className="mb-2">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-slate-400 font-['JetBrains_Mono']">
                  Battery{!espOnline && batPct > 0 ? <span className="text-slate-600"> · last known</span> : ''}
                </span>
                <span className="text-[11px] font-bold" style={{ color: batPct > 0 ? batHex : '#2a4060' }}>
                  {batPct > 0 ? `${batPct}%` : '--'}
                </span>
              </div>
              <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{
                  width: batPct > 0 ? `${batPct}%` : '0%',
                  background: batPct > 60 ? 'linear-gradient(90deg,#00cc66,#00ff88)' : batPct > 30 ? 'linear-gradient(90deg,#cc8800,#ffd700)' : 'linear-gradient(90deg,#cc2200,#ff4444)',
                  boxShadow: batPct > 0 ? `0 0 8px ${batHex}${espOnline ? '99' : '44'}` : 'none',
                  opacity: espOnline ? 1 : 0.5
                }}/>
              </div>
            </div>

            <div className={`mt-3 rounded-lg border flex items-center justify-center py-4 ${
              pantoActive ? 'border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.05)]'
              : espOnline ? 'border-[rgba(255,200,0,0.2)] bg-[rgba(255,200,0,0.03)]'
              : 'border-[rgba(255,255,255,0.05)] bg-transparent'}`}>
              {pantoActive
                ? <Zap size={32} color="#00ff88" style={{ animation: 'charge-pulse 1.5s ease-in-out infinite' }}/>
                : espOnline ? <Zap size={32} color="#ffd700" style={{ opacity: 0.5 }}/>
                : <Battery size={32} color="#2a4060"/>}
              <span className="ml-2 text-[11px] font-['JetBrains_Mono'] tracking-wider" style={{
                color: pantoActive ? '#00ff88' : espOnline ? '#ffd700' : '#2a4060'
              }}>
                {pantoActive ? `${fmt(displayVoltage, 2)} V · CONNECTED`
                  : espOnline ? `${fmt(displayVoltage, 2)} V · STANDBY`
                  : 'NO SIGNAL'}
              </span>
            </div>

            <div className="mt-3 flex justify-between items-center bg-black/20 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] px-2 py-0.5 rounded tracking-widest border ${userData.vehicleType === 'HMV' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-[rgba(0,170,255,.1)] border-[rgba(0,170,255,.3)] text-[#00aaff]'}`}>
                  {userData.vehicleType}
                </span>
                <span className="text-[10px] text-slate-500 font-['JetBrains_Mono']">
                  {userData.vehicleType === 'HMV' ? 'Heavy Motor' : 'Light Motor'}
                </span>
              </div>
              <span className={`font-bold text-[13px] ${userData.vehicleType === 'HMV' ? 'text-orange-400' : 'text-[#00aaff]'}`}>
                ₹{rate}/kWh
              </span>
            </div>
          </div>

          {/* ── 2. Connection Status ──────────────────────────────────────────── */}
          <div className={`${CARD} p-4`}>
            <p className={SECT}>Connection Status</p>
            <div className="flex items-center justify-between py-2.5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${espOnline ? 'bg-[#00ffaa]' : 'bg-red-500'}`} style={espOnline ? PULSE : {}}/>
                <span className={LBL}>ESP32 Feed</span>
              </div>
              <span className={`font-['Inter'] font-bold text-[12px] ${espOnline ? 'text-[#00ffaa]' : 'text-red-400'}`}>
                {espOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${accessGranted ? 'bg-[#00ffaa]' : 'bg-red-500'}`} style={accessGranted ? PULSE : {}}/>
                <span className={LBL}>RFID Access</span>
              </div>
              <span className={`font-['Inter'] font-bold text-[12px] ${accessGranted ? 'text-[#00ffaa]' : 'text-red-400'}`}>
                {accessGranted ? 'GRANTED' : 'DENIED'}
              </span>
            </div>
          </div>

          {/* ── 3. Electricity Meter ──────────────────────────────────────────── */}
          <div className={`${CARD} p-4`}>
            <p className={SECT}>Electricity Meter</p>

            <div className="flex items-center justify-between py-2.5 border-b border-white/5">
              <span className={LBL}>Current Reading</span>
              <div className="flex items-center gap-2">
                <span className="font-['JetBrains_Mono'] font-bold text-[15px] text-[#00ffaa]">
                  {fmt(meterReading.cumWh, 2)} Wh
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-['JetBrains_Mono'] tracking-widest border ${
                  accessGranted
                    ? 'bg-[rgba(0,255,170,0.12)] border-[rgba(0,255,170,0.3)] text-[#00ffaa]'
                    : 'bg-white/5 border-white/10 text-slate-600'
                }`} style={accessGranted ? PULSE : {}}>
                  {accessGranted ? 'ACTIVE' : 'IDLE'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className={LBL}>Last Session End</span>
              <span className="font-['JetBrains_Mono'] font-bold text-[15px] text-yellow-400">
                {fmt(meterReading.lastSessionEndWh, 2)} Wh
              </span>
            </div>

            {accessGranted && (
              <div className="flex items-center justify-between pt-1 mt-1 border-t border-white/5">
                <span className={LBL}>Delta (session)</span>
                <span className="font-['JetBrains_Mono'] font-bold text-[15px] text-[#00ccff]">
                  {fmt(meterReading.cumWh - sessionCumStart, 2)} Wh
                </span>
              </div>
            )}
          </div>

          {/* ── 4. Route ─────────────────────────────────────────────────────── */}
          <div className={`${CARD} p-4`}>
            <p className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest mb-1">Current Route:</p>
            <p className="text-[#00ccff] font-['Inter'] font-bold text-[15px] mb-3">Mumbai-Pune Expressway</p>
            <div className="bg-black/40 rounded-lg p-2 h-[70px] overflow-hidden">
              <svg width="100%" height="100%" viewBox="0 0 240 56" preserveAspectRatio="none">
                <defs>
                  <filter id="glow3"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <polyline points="10,48 60,38 110,28 160,16 220,6" fill="none" stroke="rgba(0,204,255,0.15)" strokeWidth="2"/>
                <polyline points="10,48 60,38 130,22" fill="none" stroke="#00ccff" strokeWidth="2.5" filter="url(#glow3)"/>
                <circle cx="130" cy="22" r="5" fill="#00ccff" filter="url(#glow3)"/>
                <circle cx="130" cy="22" r="9" fill="none" stroke="rgba(0,204,255,0.3)" strokeWidth="1"/>
                <circle cx="10"  cy="48" r="3" fill="rgba(0,204,255,0.4)"/>
                <circle cx="220" cy="6"  r="3" fill="rgba(0,204,255,0.25)"/>
              </svg>
            </div>
          </div>

          {/* ── 5. Total Usage ────────────────────────────────────────────────── */}
          <div className={`${CARD} p-5`}>
            <p className={SECT}>Total Usage</p>
            <div className="mb-3">
              <p className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest mb-1">SESSION ENERGY</p>
              <div className="flex items-baseline gap-1.5">
                <span className="font-['Inter'] font-bold text-[26px] text-[#00ccff]">
                  {live.energy_Wh >= 1000 ? fmt(live.energy_kWh, 2) : fmt(live.energy_Wh, 2)}
                </span>
                <span className="text-[11px] text-slate-500 font-['JetBrains_Mono']">
                  {live.energy_Wh >= 1000 ? 'kWh' : 'Wh'}
                </span>
              </div>
            </div>
            <div className="mb-3">
              <p className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest mb-1">POWER (INSTANTANEOUS)</p>
              <div className="flex items-baseline gap-1.5">
                <span className="font-['Inter'] font-bold text-[22px] text-[#00ccff]">{fmt(live.power_W, 2)}</span>
                <span className="text-[11px] text-slate-500 font-['JetBrains_Mono']">W</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest mb-1">RUNNING COST</p>
              <span className="font-['Inter'] font-bold text-[20px] text-yellow-400">{fmtINR(baseAmt)}</span>
            </div>
          </div>
        </div>

        {/* ══ CENTER COLUMN ═════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">

          {/* Real-Time Operational Parameters */}
          <div className={CARD}>
            <div className="px-5 pt-4 pb-2">
              <p className={SECT} style={{ marginBottom: 0 }}>Real-Time Operational Parameters</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">

              <div className="rounded-lg border border-[rgba(0,204,255,0.2)] bg-[rgba(25,24,30,0.93)] p-4 hover:border-[rgba(0,204,255,0.4)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap size={13} color="rgba(0,204,255,0.7)"/>
                    <span className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest">Voltage (V)</span>
                  </div>
                  <svg width="48" height="18" viewBox="0 0 48 18" style={{ overflow: 'visible' }}>
                    <polyline className="zz-animated" points="0,9 8,3 16,15 24,3 32,13 40,5 48,9"
                      fill="none" stroke="rgba(0,204,255,0.55)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Inter'] font-bold text-[30px] text-[#00ccff]">{fmt(displayVoltage, 2)}</span>
                  <span className="text-[14px] text-[#00ccff]"> V</span>
                </div>
              </div>

              <div className="rounded-lg border border-[rgba(255,200,0,0.2)] bg-[rgba(25,24,30,0.93)] p-4 hover:border-[rgba(255,200,0,0.4)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity size={13} color="rgba(255,200,0,0.7)"/>
                    <span className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest">Current (A)</span>
                  </div>
                  <svg width="48" height="18" viewBox="0 0 48 18" style={{ overflow: 'visible' }}>
                    <polyline className="zz-animated" points="0,9 8,15 16,3 24,13 32,5 40,12 48,9"
                      fill="none" stroke="rgba(255,200,0,0.55)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
                      style={{ animationDelay: '0.3s' }}/>
                  </svg>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Inter'] font-bold text-[30px] text-yellow-400">{fmt(live.current, 2)}</span>
                  <span className="text-[14px] text-yellow-400"> A</span>
                </div>
              </div>

              <div className="rounded-lg border border-[rgba(0,204,255,0.2)] bg-[rgba(25,24,30,0.93)] p-4 hover:border-[rgba(0,204,255,0.4)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge size={13} color="rgba(0,204,255,0.7)"/>
                    <span className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest">Power Draw (W)</span>
                  </div>
                  <svg width="48" height="18" viewBox="0 0 48 18" style={{ overflow: 'visible' }}>
                    <polyline className="zz-animated" points="0,9 8,4 16,14 24,6 32,12 40,4 48,9"
                      fill="none" stroke="rgba(0,204,255,0.55)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
                      style={{ animationDelay: '0.6s' }}/>
                  </svg>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Inter'] font-bold text-[30px] text-[#00ccff]">{fmt(live.power_W, 2)}</span>
                  <span className="text-[14px] text-[#00ccff]"> W</span>
                </div>
              </div>

              <div className="rounded-lg border border-[rgba(0,204,255,0.2)] bg-[rgba(25,24,30,0.93)] p-4 hover:border-[rgba(0,204,255,0.4)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={13} color="rgba(0,204,255,0.7)"/>
                    <span className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest">Energy (kWh)</span>
                  </div>
                  <svg width="48" height="18" viewBox="0 0 48 18" style={{ overflow: 'visible' }}>
                    <polyline className="zz-animated" points="0,9 8,13 16,5 24,11 32,7 40,14 48,9"
                      fill="none" stroke="rgba(0,204,255,0.55)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
                      style={{ animationDelay: '0.9s' }}/>
                  </svg>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Inter'] font-bold text-[30px] text-[#00ccff]">
                    {live.energy_Wh >= 1000 ? fmt(live.energy_kWh, 2) : fmt(live.energy_Wh, 2)}
                  </span>
                  <span className="text-[12px] text-[#00ccff]">
                    {live.energy_Wh >= 1000 ? ' kWh' : ' Wh'}
                  </span>
                </div>
              </div>

              <div className={`col-span-1 rounded-lg border p-4 transition-all ${
                pantoActive
                  ? 'border-[rgba(0,255,136,0.3)] bg-[rgba(25,24,30,0.93)] hover:border-[rgba(0,255,136,0.5)]'
                  : espOnline && !accessGranted
                  ? 'border-[rgba(255,200,0,0.2)] bg-[rgba(25,24,30,0.93)]'
                  : 'border-[rgba(255,68,68,0.2)] bg-[rgba(25,24,30,0.93)] hover:border-[rgba(255,68,68,0.4)]'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Zap size={13} color={pantoActive ? 'rgba(0,255,136,0.7)' : espOnline ? 'rgba(255,200,0,0.7)' : 'rgba(255,68,68,0.7)'}/>
                    <span className="text-[10px] text-slate-500 font-['JetBrains_Mono'] tracking-widest">Pantograph Contact</span>
                  </div>
                  <svg width="48" height="18" viewBox="0 0 48 18" style={{ overflow: 'visible' }}>
                    {pantoActive
                      ? <polyline className="zz-animated" points="0,9 8,3 16,15 24,4 32,12 40,5 48,9"
                          fill="none" stroke="rgba(0,255,136,0.6)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
                          style={{ animationDelay: '0.15s' }}/>
                      : <polyline points="0,9 10,9 20,9 30,9 48,9"
                          fill="none" stroke="rgba(255,68,68,0.3)" strokeWidth="1.5" strokeDasharray="4 3"/>}
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`font-['Inter'] font-bold text-[28px] ${
                    pantoActive ? 'text-[#00ff88]'
                    : espOnline && !accessGranted ? 'text-yellow-400'
                    : 'text-red-400'}`}>
                    {pantoActive ? 'STABLE'
                      : accessGranted && !currentFlowing ? 'ACCESS OK · NO CONTACT'
                      : espOnline && !accessGranted ? 'WAITING RFID'
                      : 'INACTIVE'}
                  </span>
                  {pantoActive && <span className="text-[12px] text-[rgba(0,255,136,0.6)]" style={PULSE}>●</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Daily Energy Consumption — Clean Vertical Bars ───────────────── */}
          <div className={`${CARD} p-5`}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className={SECT} style={{ marginBottom: 0 }}>Daily Energy Consumption</p>
                <p className="text-[9px] text-slate-600 font-['JetBrains_Mono'] mt-1 tracking-widest">kWh per day · last 7 days</p>
              </div>
              <span className="text-[10px] tracking-widest text-slate-500 font-['JetBrains_Mono']">
                {dailyChartData.length > 0 ? `${dailyChartData.length} DAY${dailyChartData.length > 1 ? 'S' : ''}` : 'NO DATA'}
              </span>
            </div>
            {dailyChartData.length === 0 ? (
              <div className="h-[180px] flex flex-col items-center justify-center gap-2">
                <BarChart3 size={28} color="#2a4060"/>
                <p className="text-[10px] tracking-[0.15em] text-slate-700 font-['JetBrains_Mono']">— NO SESSION DATA YET —</p>
              </div>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyChartData}
                    barCategoryGap="35%"
                    margin={{ top: 28, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis hide domain={[0, dataMax => Math.ceil(dataMax * 1.25)]}/>
                    <Tooltip content={<DailyTooltip />} cursor={{ fill: 'rgba(0,255,170,0.05)', radius: 4 }}/>
                    <Bar dataKey="kwh" radius={[5, 5, 2, 2]} maxBarSize={52}
                      label={{
                        position: 'top',
                        formatter: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v >= 10 ? v.toFixed(1) : v.toFixed(2),
                        fill: '#00ffaa',
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono',
                        fontWeight: 700,
                        dy: -4,
                      }}
                    >
                      {dailyChartData.map((entry, index) => {
                        const isLatest = index === dailyChartData.length - 1;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isLatest ? '#00ffaa' : 'rgba(0,255,170,0.28)'}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {dailyChartData.length > 0 && (
              <div className="mt-3 flex gap-3 pt-2 border-t border-white/5">
                <div className="flex-1 text-center">
                  <p className={`${LBL} mb-0.5`}>Total</p>
                  <p className="text-[#00ffaa] font-bold text-[13px]">{fmt(dailyChartData.reduce((s, d) => s + d.kwh, 0), 2)} kWh</p>
                </div>
                <div className="flex-1 text-center border-l border-white/5">
                  <p className={`${LBL} mb-0.5`}>Daily Avg</p>
                  <p className="text-[#00ccff] font-bold text-[13px]">{fmt(dailyChartData.reduce((s, d) => s + d.kwh, 0) / dailyChartData.length, 2)} kWh</p>
                </div>
                <div className="flex-1 text-center border-l border-white/5">
                  <p className={`${LBL} mb-0.5`}>Peak Day</p>
                  <p className="text-yellow-400 font-bold text-[13px]">{fmt(Math.max(...dailyChartData.map(d => d.kwh)), 2)} kWh</p>
                </div>
              </div>
            )}
          </div>

          {/* Session History */}
          <div className={`${CARD} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <p className={SECT} style={{ marginBottom: 0 }}>Charging Session History</p>
              <span className="text-[9px] text-slate-600 font-['JetBrains_Mono'] tracking-widest">CLICK ROW TO DOWNLOAD INVOICE</span>
            </div>
            {sessionHistory.length === 0
              ? <p className={`${LBL} text-center py-5 text-slate-700`}>No sessions recorded yet.</p>
              : sessionHistory.map((s, i) => {
                  const num = s.globalIndex || (sessionHistory.length - i);

                  const sBase = s.base_amount    ?? 0;
                  const sSvc  = s.service_charge ?? (sBase * SERVICE_PCT);
                  const sGst  = s.gst            ?? (sBase * GST_PCT);
                  const sCost = s.cost           ?? (sBase + sSvc + sGst);
                  const rawWh = (s.cumWh_end !== undefined && s.cumWh_start !== undefined)
                    ? Math.max(0, s.cumWh_end - s.cumWh_start)
                    : null;

                  return (
                    <div key={s.id || i} className="session-row px-2 py-3 border-b border-white/5 last:border-0"
                      onClick={() => setSelectedSession(s)} title="Click to view & download invoice">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-['Inter'] font-bold text-[13px] text-slate-200">Session #{String(num).padStart(4, '0')}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[rgba(0,255,170,.1)] border border-[rgba(0,255,170,.3)] text-[#00ffaa] tracking-widest">PAID</span>
                          </div>
                          <p className={`${LBL} mb-1`}>
                            {s.startedAt?.toDate ? s.startedAt.toDate().toLocaleString('en-IN') : new Date(s.startedAt).toLocaleString('en-IN')}
                          </p>
                          <div className="flex gap-4 flex-wrap">
                            <span>
                              <span className={LBL}>Energy </span>
                              <span className="text-slate-200 text-[12px]">
                                {rawWh !== null ? `${fmt(rawWh, 4)} Wh` : `${fmt(s.energy_kWh ?? 0, 4)} kWh`}
                              </span>
                            </span>
                            <span><span className={LBL}>Rate </span><span className="text-slate-200 text-[12px]">₹{s.rate_per_kwh ?? rate}/kWh</span></span>
                            <span><span className={LBL}>Deducted </span><span className="font-['Inter'] font-bold text-yellow-400 text-[12px]">{fmtINR(sCost)}</span></span>
                            <span><span className={LBL}>Bal after </span><span className="text-[#00ffaa] text-[12px]">{fmtINR(s.balance_after ?? 0)}</span></span>
                          </div>
                          {(s.cumWh_start !== undefined || s.cumWh_end !== undefined) && (
                            <div className="mt-1 flex gap-3">
                              <span><span className={LBL}>Meter In </span><span className="text-slate-500 text-[11px] font-['JetBrains_Mono']">{fmt(s.cumWh_start ?? 0, 4)} Wh</span></span>
                              <span><span className={LBL}>Meter Out </span><span className="text-slate-500 text-[11px] font-['JetBrains_Mono']">{fmt(s.cumWh_end ?? 0, 4)} Wh</span></span>
                            </div>
                          )}
                        </div>
                        {/* ── FIXED: Download icon now bright green ── */}
                        <Download size={14} color="#00ffaa" style={{ marginTop: 2, flexShrink: 0 }}/>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* ══ RIGHT COLUMN ══════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">

          {/* Wallet */}
          <div className={`${CARD} p-5`}>
            <div className="flex justify-between items-center mb-4">
              <p className={SECT} style={{ marginBottom: 0 }}>Wallet Balance</p>
              <button onClick={() => setIsRechargeOpen(true)}
                className="flex items-center gap-1.5 bg-[rgba(0,170,255,.08)] border border-[rgba(0,170,255,.2)] text-[#00aaff] text-[11px] tracking-widest px-4 py-2 rounded hover:bg-[rgba(0,170,255,.15)] hover:border-[rgba(0,170,255,.4)] transition-all">
                <Plus size={14}/> Recharge
              </button>
            </div>
            <p className="font-['Inter'] font-extrabold text-[38px] text-[#00ffaa]">{fmtINR(walletBalance)}</p>
            <p className={`text-[10px] mt-1.5 ${balStatus.cls}`}>{balStatus.text}</p>
            <p className="text-[9px] text-slate-700 font-['JetBrains_Mono'] mt-1 tracking-widest">SOURCE: REALTIME DATABASE</p>
            {walletBalance < MIN_BALANCE && (
              <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded p-2 text-[10px] text-red-400 leading-relaxed">
                <AlertTriangle size={11} className="inline mr-1.5"/>
                Minimum ₹{MIN_BALANCE} required for pantograph access.
              </div>
            )}
            <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className={LBL}>Vehicle Type</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-sm tracking-widest border ${userData.vehicleType === 'HMV' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-[rgba(0,170,255,.1)] border-[rgba(0,170,255,.3)] text-[#00aaff]'}`}>
                  {userData.vehicleType}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={LBL}>Active Rate</span>
                <span className={`text-[11px] ${userData.vehicleType === 'HMV' ? 'text-orange-400' : 'text-[#00aaff]'}`}>₹{rate}/kWh</span>
              </div>
            </div>
          </div>

          {/* Billing Breakdown */}
          <div className={`${CARD} p-5 flex-1`}>
            <p className={SECT}>Billing Breakdown</p>
            <div className="bg-yellow-400/5 border border-yellow-400/15 rounded p-3 text-center mb-4">
              <p className={`${LBL} mb-1`}>Running Cost (live)</p>
              <p className="font-['Inter'] font-bold text-[30px] text-yellow-400">{fmtINR(baseAmt)}</p>
              <p className="text-[9px] text-slate-500 mt-1 tracking-widest">BASE ONLY · TAX ADDED AT SESSION END</p>
            </div>
            {[
              { label: 'Energy Consumed',    value: live.energy_Wh >= 1000 ? `${fmt(live.energy_kWh, 2)} kWh` : `${fmt(live.energy_Wh, 2)} Wh` },
              { label: `Rate (${userData.vehicleType})`, value: `₹${rate.toFixed(2)}/kWh` },
              { label: 'Base Amount',         value: fmtINR(baseAmt) },
              { label: 'Service Charge (2%)', value: fmtINR(svcCharge) },
              { label: 'GST (18%)',           value: fmtINR(gstAmt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className={`${LBL} text-[11px]`}>{label}</span>
                <span className="text-[12px] text-slate-300">{value}</span>
              </div>
            ))}
            <div className="bg-[rgba(0,255,170,.06)] border border-[rgba(0,255,170,.2)] rounded p-4 mt-3 text-center">
              <p className={`${LBL} mb-1`}>Estimated Total Bill ✦</p>
              <p className="font-['Inter'] font-bold text-[26px] text-[#00ffaa]">{fmtINR(totalBill)}</p>
            </div>
            <div className="mt-3 bg-[rgba(0,170,255,.04)] border border-[rgba(0,170,255,.1)] rounded p-2.5 text-[10px] text-slate-500 leading-relaxed">
              ℹ HMV ₹100/kWh · LMV ₹7/kWh · Service 2% · GST 18% · Total = Base × 1.20
            </div>
          </div>
        </div>
      </div>

      {/* ── Session Invoice Modal ──────────────────────────────────────────── */}
      {selectedSession && (() => {
        const mBase  = selectedSession.base_amount    ?? 0;
        const mSvc   = selectedSession.service_charge ?? (mBase * SERVICE_PCT);
        const mGst   = selectedSession.gst            ?? (mBase * GST_PCT);
        const mCost  = selectedSession.cost           ?? (mBase + mSvc + mGst);
        const mRawWh = (selectedSession.cumWh_end !== undefined && selectedSession.cumWh_start !== undefined)
          ? Math.max(0, selectedSession.cumWh_end - selectedSession.cumWh_start)
          : null;
        return (
          <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedSession(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors">
                <X size={18}/>
              </button>
              <p className="font-['JetBrains_Mono'] text-[11px] tracking-[0.18em] text-slate-500 uppercase mb-1">Session Invoice</p>
              <p className="font-['Inter'] font-bold text-[18px] text-slate-100 mb-4">
                #{String(selectedSession.globalIndex || '').padStart(4, '0')} · {selectedSession.vehicleNumber}
              </p>
              <div className="space-y-2 mb-5">
                {[
                  ['Date',        selectedSession.startedAt?.toDate ? selectedSession.startedAt.toDate().toLocaleString('en-IN') : new Date(selectedSession.startedAt).toLocaleString('en-IN')],
                  ['Vehicle Type', selectedSession.vehicleType],
                  ['Energy (Raw)', mRawWh !== null ? `${fmt(mRawWh, 4)} Wh` : `${fmt(selectedSession.energy_kWh ?? 0, 4)} kWh`],
                  ['Rate',         `₹${selectedSession.rate_per_kwh ?? rate}/kWh`],
                  ['Meter Entry',  `${fmt(selectedSession.cumWh_start ?? 0, 4)} Wh`],
                  ['Meter Exit',   `${fmt(selectedSession.cumWh_end   ?? 0, 4)} Wh`],
                  ['Base Amount',  fmtINR(mBase)],
                  ['Service (2%)', fmtINR(mSvc)],
                  ['GST (18%)',    fmtINR(mGst)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="font-['JetBrains_Mono'] text-[10px] tracking-widest text-slate-500 uppercase">{label}</span>
                    <span className="text-[12px] text-slate-200">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="font-['JetBrains_Mono'] text-[11px] tracking-widest text-slate-300 uppercase font-bold">Total Deducted</span>
                  <span className="font-['Inter'] font-bold text-[18px] text-yellow-400">{fmtINR(mCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-['JetBrains_Mono'] text-[10px] tracking-widest text-slate-500 uppercase">Balance After</span>
                  <span className="font-['Inter'] font-bold text-[14px] text-[#00ffaa]">{fmtINR(selectedSession.balance_after ?? 0)}</span>
                </div>
              </div>
              <button
                onClick={() => { generateInvoiceFromSession(selectedSession, userData); setSelectedSession(null); }}
                className="flex items-center justify-center gap-2 w-full bg-[rgba(0,255,170,.1)] border border-[rgba(0,255,170,.3)] text-[#00ffaa] text-[12px] tracking-widest uppercase py-3 rounded hover:bg-[rgba(0,255,170,.2)] transition-all font-['JetBrains_Mono']">
                <Download size={16}/> Download PDF Invoice
              </button>
            </div>
          </div>
        );
      })()}

      <RechargeModal
        isOpen={isRechargeOpen}
        onClose={() => setIsRechargeOpen(false)}
        userId={user?.uid}
        rfidCardId={rfidCardId}
        darkMode={true}
      />
    </div>
  );
};

export default Dashboard;