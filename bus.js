/* =====================================================================
 * bus.js  —  Motor compartido de la "Suite Hidrolinera Térmica"
 * ---------------------------------------------------------------------
 * Un único fichero que centraliza:
 *   1. La definición FIJA de los componentes de la hidrolinera (STATION).
 *   2. Las correlaciones físicas (Cp, densidad, exergía...).
 *   3. Las funciones de cálculo de cada capa (App1..App4) y la síntesis
 *      de la red de intercambiadores (HEN) del proyecto principal.
 *   4. Un pequeño "bus" de comunicación en vivo entre la página principal
 *      (hub) y las apps incrustadas en iframes (postMessage + localStorage).
 *
 * Filosofía: cada app SOLO guarda su configuración + resultado; cualquier
 * consumidor (app siguiente o el principal) puede recalcular desde cero
 * usando estas mismas funciones, de modo que SIEMPRE hay datos coherentes
 * aunque el usuario no haya abierto las apps anteriores.
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------
  // 0. Constantes
  // ---------------------------------------------------------------------
  const T0 = 298.15;      // K  (25 °C, estado muerto)
  const P0 = 101325;      // Pa (1 atm)
  const R_H2 = 4124;      // J/kg·K  constante del gas para H2

  const KEY_MAP = {
    app1: 'suite_thermal_trayectorias',
    app2: 'suite_thermal_data_enriched',
    app3: 'suite_thermal_data_with_ambient',
    app4: 'suite_thermal_final_setup'
  };

  // ---------------------------------------------------------------------
  // 1. Componentes FIJOS de la hidrolinera (las "corrientes" del estudio)
  //    2 focos calientes (calor residual) + 2 demandas frías (necesitan calor)
  // ---------------------------------------------------------------------
  const STATION = [
    {
      id: 'compresor', name: 'Compresor H₂', icon: '⚙️', role: 'hot', color: '#ef4444',
      blurb: 'La compresión del hidrógeno genera mucho calor residual.',
      def: { profile: 'exp', T_init: 120, T_final: 58, mCp: 45000, amp: 6, freq: 0.06 },
      app2: { fluid: 'H2', P_bar: 700 },
      app3: { volume: 0.8, geometry: 'cylinder', k_solid: 50, h_conv: 100, h_amb: 6 }
    },
    {
      id: 'repostaje', name: 'Gas de Repostaje', icon: '🔥', role: 'hot', color: '#f97316',
      blurb: 'El gas se calienta al llenar el depósito del vehículo (SAE J2601).',
      def: { profile: 'smooth', T_init: 95, T_final: 42, mCp: 30000, amp: 5, freq: 0.05 },
      app2: { fluid: 'H2', P_bar: 350 },
      app3: { volume: 0.4, geometry: 'cylinder', k_solid: 200, h_conv: 90, h_amb: 7 }
    },
    {
      id: 'acs', name: 'Agua Sanitaria', icon: '🚿', role: 'cold', color: '#3b82f6',
      blurb: 'Agua caliente sanitaria del edificio: necesita aporte de calor.',
      def: { profile: 'linear', T_init: 14, T_final: 58, mCp: 60000, amp: 4, freq: 0.04 },
      app2: { fluid: 'water', P_bar: 3 },
      app3: { volume: 1.5, geometry: 'cylinder', k_solid: 60, h_conv: 200, h_amb: 4 }
    },
    {
      id: 'clima', name: 'Climatización', icon: '🏢', role: 'cold', color: '#10b981',
      blurb: 'Climatización del edificio: demanda térmica recuperable.',
      def: { profile: 'sin', T_init: 18, T_final: 40, mCp: 40000, amp: 6, freq: 0.05 },
      app2: { fluid: 'glycol', P_bar: 3 },
      app3: { volume: 1.0, geometry: 'sphere', k_solid: 30, h_conv: 400, h_amb: 5 }
    }
  ];

  function stationById(id) { return STATION.find(s => s.id === id); }

  // ---------------------------------------------------------------------
  // 2. Correlaciones termofísicas (ligeras, suficientes para divulgación)
  // ---------------------------------------------------------------------
  const props = {
    // Cp del H2 (polinomio NASA 7-coef, GRI-Mech) -> J/kg·K
    cpH2(T_K) {
      const a = [3.298, 8.249e-4, -8.143e-7, -9.475e-11, 4.134e-14];
      const T = Math.max(200, Math.min(T_K, 1500));
      const cp_R = a[0] + a[1] * T + a[2] * T * T + a[3] * T ** 3 + a[4] * T ** 4;
      return cp_R * R_H2;
    },
    rhoH2(T_K, P_Pa) {
      const Pbar = P_Pa / 1e5;
      const Z = 1 + 0.00064 * Pbar * (300 / T_K);
      return P_Pa / (Z * R_H2 * T_K);
    },
    muH2(T_K) {
      const Tref = 293.85, muref = 8.76e-6, Cs = 72;
      return muref * Math.pow(T_K / Tref, 1.5) * ((Tref + Cs) / (T_K + Cs));
    },
    cpWater() { return 4180; },
    rhoWater() { return 1000; },
    muWater() { return 8.9e-4; },
    cpGlycol() { return 3500; },   // mezcla agua-glicol
    rhoGlycol() { return 1040; },
    muGlycol() { return 3.0e-3; },

    cp(fluid, T_K) {
      if (fluid === 'H2') return this.cpH2(T_K);
      if (fluid === 'glycol') return this.cpGlycol();
      return this.cpWater();
    },
    rho(fluid, T_K, P_Pa) {
      if (fluid === 'H2') return this.rhoH2(T_K, P_Pa);
      if (fluid === 'glycol') return this.rhoGlycol();
      return this.rhoWater();
    },
    Rspec(fluid) { return fluid === 'H2' ? R_H2 : 461.5; }
  };

  // ---------------------------------------------------------------------
  // 3. Utilidades de color / formato
  // ---------------------------------------------------------------------
  // Mapea una temperatura (°C) a un color azul(frío)->verde(ambiente)->rojo(caliente)
  function colorForTemp(tC, lo = -45, hi = 95) {
    const x = Math.max(0, Math.min(1, (tC - lo) / (hi - lo)));
    // hue: 210 (azul) -> 0 (rojo)
    const hue = 210 * (1 - x);
    const light = 52 - 8 * x;
    return `hsl(${hue.toFixed(0)}, 85%, ${light.toFixed(0)}%)`;
  }
  function fmt(n, d = 1) {
    if (!isFinite(n)) return '∞';
    const a = Math.abs(n);
    if (a >= 1000) return n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
    return n.toLocaleString('es-ES', { maximumFractionDigits: d });
  }

  // ---------------------------------------------------------------------
  // 4. Capa 1 — Trayectorias de temperatura
  // ---------------------------------------------------------------------
  function defaultApp1Config() {
    return {
      K: 60,
      streams: STATION.map(s => ({
        id: s.id, name: s.name, role: s.role, color: s.color, icon: s.icon,
        profile: s.def.profile, T_init: s.def.T_init, T_final: s.def.T_final,
        mCp: s.def.mCp, amp: s.def.amp, freq: s.def.freq
      }))
    };
  }

  function profileValue(type, tau, t, s) {
    const span = s.T_final - s.T_init;
    switch (type) {
      case 'linear':
        return s.T_init + span * tau;
      case 'sin':
        return s.T_init + span * tau + s.amp * Math.sin(2 * Math.PI * s.freq * t);
      case 'exp': {
        const k = (s.role === 'hot') ? -3 : 3;
        return s.T_init + span * ((Math.exp(k * tau) - 1) / (Math.exp(k) - 1));
      }
      case 'smooth': {
        // S-curve logística normalizada (0->1)
        const g = x => 1 / (1 + Math.exp(-12 * (x - 0.5)));
        const f = (g(tau) - g(0)) / (g(1) - g(0));
        return s.T_init + span * f;
      }
      default:
        return s.T_init + span * tau;
    }
  }

  function computeApp1(cfg) {
    cfg = cfg || defaultApp1Config();
    const K = cfg.K;
    const dt = 1;
    const time = Array.from({ length: K + 1 }, (_, i) => i);
    const streams = cfg.streams.map(s => {
      const T = time.map(t => profileValue(s.profile, t / K, t, s));
      const dTdt = T.map((_, i) => {
        if (i === 0) return T[1] - T[0];
        if (i === K) return T[K] - T[K - 1];
        return (T[i + 1] - T[i - 1]) / 2;
      });
      const Q = dTdt.map(d => s.mCp * d); // W (signo: + absorbe, - libera)
      return {
        id: s.id, name: s.name, role: s.role, color: s.color, icon: s.icon,
        profile: s.profile, T_init: s.T_init, T_final: s.T_final, mCp: s.mCp,
        amp: s.amp, freq: s.freq, T, dTdt, Q
      };
    });
    return { layer: 'app1', K, dt, time, streams };
  }

  // ---------------------------------------------------------------------
  // 5. Capa 2 — Propiedades y exergía
  // ---------------------------------------------------------------------
  function defaultApp2Config() {
    const c = {};
    STATION.forEach(s => { c[s.id] = { fluid: s.app2.fluid, P_bar: s.app2.P_bar }; });
    return c;
  }

  function computeApp2(app1, configs) {
    app1 = app1 || computeApp1();
    configs = configs || defaultApp2Config();
    const streams = app1.streams.map(st => {
      const cfg = configs[st.id] || { fluid: 'water', P_bar: 3 };
      const P_Pa = cfg.P_bar * 1e5;
      const Cp = [], rho = [], ExP = [];
      st.T.forEach(tC => {
        const T_K = tC + 273.15;
        const cp = props.cp(cfg.fluid, T_K);
        const rh = props.rho(cfg.fluid, T_K, P_Pa);
        Cp.push(cp); rho.push(rh);
        // masa equivalente a partir del mCp de la app1
        const cp0 = props.cp(cfg.fluid, st.T[0] + 273.15);
        const mass = st.mCp / cp0;
        let ex;
        if (cfg.fluid === 'H2') {
          ex = mass * props.Rspec('H2') * T0 * Math.log(P_Pa / P0); // J
        } else {
          ex = mass * (P_Pa - P0) / rh; // flujo incompresible, J
        }
        ExP.push(Math.max(0, ex / 1000)); // kJ
      });
      const Cp_mean = Cp.reduce((a, b) => a + b, 0) / Cp.length;
      const Ex_total = ExP.reduce((a, b) => Math.max(a, b), 0);
      return {
        id: st.id, name: st.name, color: st.color, icon: st.icon, role: st.role,
        fluid: cfg.fluid, P_bar: cfg.P_bar, Cp, Cp_mean, rho, Ex_P: ExP, Ex_total
      };
    });
    return { layer: 'app2', streams };
  }

  // ---------------------------------------------------------------------
  // 6. Capa 3 — Pérdidas ambientales / número de Biot
  // ---------------------------------------------------------------------
  function defaultApp3Config() {
    const c = {};
    STATION.forEach(s => {
      c[s.id] = {
        volume: s.app3.volume, geometry: s.app3.geometry,
        k_solid: s.app3.k_solid, h_conv: s.app3.h_conv, h_amb: s.app3.h_amb
      };
    });
    return c;
  }

  function computeApp3(app1, configs, T_amb) {
    app1 = app1 || computeApp1();
    configs = configs || defaultApp3Config();
    T_amb = (T_amb == null) ? 25 : T_amb;
    const streams = app1.streams.map(st => {
      const cfg = configs[st.id] || defaultApp3Config()[st.id];
      const V = cfg.volume;
      const R_eq = Math.pow((3 * V) / (4 * Math.PI), 1 / 3);
      const Lc = R_eq / 3;
      const Bi = (cfg.h_conv * Lc) / cfg.k_solid;
      const A_sphere = Math.pow(Math.PI, 1 / 3) * Math.pow(6 * V, 2 / 3);
      let A_surf = A_sphere;
      if (cfg.geometry === 'cylinder') {
        const D = Math.pow((4 * V) / (Math.PI * 3), 1 / 3);
        const L = 3 * D;
        A_surf = Math.PI * D * L + 0.5 * Math.PI * D * D;
      }
      const Q_amb = st.T.map(tC => cfg.h_amb * A_surf * (T_amb - tC)); // W
      const Q_amb_kWh = Q_amb.reduce((a, b) => a + Math.abs(b), 0) * 1 / 3.6e6;
      return {
        id: st.id, name: st.name, color: st.color, icon: st.icon, role: st.role,
        volume: V, geometry: cfg.geometry, k_solid: cfg.k_solid, h_conv: cfg.h_conv, h_amb: cfg.h_amb,
        Lc, Bi, A_surf, A_sphere, lumped_valid: Bi < 0.1, Q_amb, Q_amb_kWh
      };
    });
    return { layer: 'app3', T_amb, streams };
  }

  // ---------------------------------------------------------------------
  // 7. Capa 4 — Seguridad / time-to-limit / discretización
  // ---------------------------------------------------------------------
  function defaultApp4Config() {
    return { hold: 10, T_max: 85, T_min: -40 };
  }

  function computeApp4(app1, cfg) {
    app1 = app1 || computeApp1();
    cfg = cfg || defaultApp4Config();
    const K = app1.K;
    const streams = app1.streams.map(st => {
      // discretización por bloques (promedio)
      const stepped = st.T.slice();
      for (let i = 0; i <= K; i += cfg.hold) {
        const end = Math.min(i + cfg.hold, K + 1);
        let sum = 0;
        for (let j = i; j < end; j++) sum += st.T[j];
        const avg = sum / (end - i);
        for (let j = i; j < end; j++) stepped[j] = avg;
      }
      // time-to-limit
      const ttl = st.T.map((tC, i) => {
        const d = st.dTdt[i];
        if (d > 0.02) { const t = (cfg.T_max - tC) / d; return t < 0 ? 0 : t; }
        if (d < -0.02) { const t = (cfg.T_min - tC) / d; return t < 0 ? 0 : t; }
        return Infinity;
      });
      const ttl_min = Math.min(...ttl);
      let status = 'seguro';
      if (ttl_min < 25) status = 'critico';
      else if (ttl_min < 90) status = 'atencion';
      return {
        id: st.id, name: st.name, color: st.color, icon: st.icon, role: st.role,
        stepped, ttl, ttl0: ttl[0], ttl_min, status
      };
    });
    const worst = streams.reduce((m, s) => (s.ttl_min < m.ttl_min ? s : m), streams[0]);
    return { layer: 'app4', hold: cfg.hold, T_max: cfg.T_max, T_min: cfg.T_min, streams, worst_id: worst.id, worst_ttl: worst.ttl_min };
  }

  // ---------------------------------------------------------------------
  // 8. Proyecto principal — Síntesis de la red de intercambiadores (HEN)
  // ---------------------------------------------------------------------
  function synthesizeHEN(state, opts) {
    opts = opts || {};
    const dTmin = opts.dTmin != null ? opts.dTmin : 10;
    const cyclesPerDay = opts.cyclesPerDay != null ? opts.cyclesPerDay : 50;

    const app1 = validApp1(state && state.app1) ? state.app1 : computeApp1();
    const app2 = validApp2(state && state.app2) ? state.app2 : computeApp2(app1);
    const app3 = validApp3(state && state.app3) ? state.app3 : computeApp3(app1);
    const app4 = validApp4(state && state.app4) ? state.app4 : computeApp4(app1);

    const K = app1.K, dt = app1.dt || 1;
    const byId = id => app1.streams.find(s => s.id === id);

    const hot = app1.streams.filter(s => s.role === 'hot');
    const cold = app1.streams.filter(s => s.role === 'cold');

    // disponibilidad / demanda instantánea (W, positivo)
    const avail = {}, demand = {};
    hot.forEach(h => { avail[h.id] = h.Q.map(q => Math.max(0, -q)); });
    cold.forEach(c => { demand[c.id] = c.Q.map(q => Math.max(0, q)); });

    // candidatos factibles (ΔT >= dTmin durante parte significativa del ciclo)
    const candidates = [];
    hot.forEach(h => cold.forEach(c => {
      let feasK = 0, sumDT = 0;
      for (let k = 0; k <= K; k++) {
        const dT = h.T[k] - c.T[k];
        if (dT >= dTmin) { feasK++; sumDT += dT; }
      }
      const frac = feasK / (K + 1);
      if (frac >= 0.25) {
        candidates.push({ h: h.id, c: c.id, frac, avgDT: feasK ? sumDT / feasK : 0 });
      }
    }));
    // priorizar mayor fuerza motriz media
    candidates.sort((a, b) => b.avgDT - a.avgDT);

    // asignación voraz por intervalos
    const remAvail = {}, remDemand = {};
    hot.forEach(h => remAvail[h.id] = avail[h.id].slice());
    cold.forEach(c => remDemand[c.id] = demand[c.id].slice());

    const matches = [];
    candidates.forEach(cand => {
      const h = byId(cand.h), c = byId(cand.c);
      const Qrec = new Array(K + 1).fill(0);
      const active = new Array(K + 1).fill(false);
      let total = 0, exDestr = 0;
      for (let k = 0; k <= K; k++) {
        const dT = h.T[k] - c.T[k];
        if (dT < dTmin) continue;
        const q = Math.min(remAvail[cand.h][k], remDemand[cand.c][k]);
        if (q <= 1e-6) continue;
        Qrec[k] = q; active[k] = true;
        remAvail[cand.h][k] -= q;
        remDemand[cand.c][k] -= q;
        total += q * dt;
        const Th = h.T[k] + 273.15, Tc = c.T[k] + 273.15;
        exDestr += q * T0 * (1 / Tc - 1 / Th) * dt;
      }
      if (total > 0) {
        matches.push({
          h: cand.h, c: cand.c, hName: h.name, cName: c.name,
          hColor: h.color, cColor: c.color, avgDT: cand.avgDT,
          Qrec, active, energy_kWh: total / 3.6e6, exDestr_kWh: exDestr / 3.6e6,
          peakW: Math.max(...Qrec)
        });
      }
    });

    // balances globales (kWh por ciclo)
    const sumArr = a => a.reduce((x, y) => x + y, 0) * dt / 3.6e6;
    const totalHotAvail = hot.reduce((s, h) => s + sumArr(avail[h.id]), 0);
    const totalColdDem = cold.reduce((s, c) => s + sumArr(demand[c.id]), 0);
    const recovered = matches.reduce((s, m) => s + m.energy_kWh, 0);

    const hotUtility = Math.max(0, totalHotAvail - recovered);  // refrigeración externa que aún hace falta
    const coldUtility = Math.max(0, totalColdDem - recovered);  // calefacción externa que aún hace falta
    const exDestroyed = matches.reduce((s, m) => s + m.exDestr_kWh, 0);

    const baseEnergy = totalHotAvail + totalColdDem; // sin red habría que aportar todo por utilities
    const recoveryPct = baseEnergy > 0 ? (2 * recovered) / baseEnergy * 100 : 0;

    // proyección anual / ahorro
    const cyclesYear = cyclesPerDay * 365;
    const recovered_MWh_y = recovered * cyclesYear / 1000;
    const co2_t_y = recovered_MWh_y * 1000 * 0.20 / 1000; // 0.20 kg CO2 / kWh
    const euros_y = recovered_MWh_y * 1000 * 0.15;        // 0.15 €/kWh

    // exergía mecánica recuperable (de app2) y pérdidas ambiente (app3)
    const exMech = app2.streams.reduce((s, st) => s + (st.Ex_total || 0), 0) / 1000; // MJ aprox (kJ->MJ)
    const ambLoss = app3.streams.reduce((s, st) => s + (st.Q_amb_kWh || 0), 0);

    return {
      layer: 'main', K, dt, dTmin, cyclesPerDay,
      hot: hot.map(h => h.id), cold: cold.map(c => c.id),
      app1, app2, app3, app4,
      matches,
      metrics: {
        recovered, hotUtility, coldUtility, totalHotAvail, totalColdDem,
        recoveryPct, exDestroyed, recovered_MWh_y, co2_t_y, euros_y,
        exMech, ambLoss,
        safety_status: app4 ? app4.worst_id ? app4.streams.reduce((w, s) => s.ttl_min < w ? s.ttl_min : w, Infinity) : Infinity : Infinity,
        worst_id: app4 ? app4.worst_id : null,
        worst_ttl: app4 ? app4.worst_ttl : Infinity
      }
    };
  }

  // ---------------------------------------------------------------------
  // 9. Validación de datos (descarta formatos antiguos/incompatibles)
  // ---------------------------------------------------------------------
  function validApp1(o) { return !!(o && Array.isArray(o.streams) && o.streams[0] && Array.isArray(o.streams[0].T) && Array.isArray(o.streams[0].Q) && o.streams[0].role); }
  function validApp2(o) { return !!(o && Array.isArray(o.streams) && o.streams[0] && Array.isArray(o.streams[0].Cp)); }
  function validApp3(o) { return !!(o && Array.isArray(o.streams) && o.streams[0] && typeof o.streams[0].Bi === 'number'); }
  function validApp4(o) { return !!(o && Array.isArray(o.streams) && o.streams[0] && Array.isArray(o.streams[0].ttl)); }
  function sanitize(s) {
    s = s || {};
    if (!validApp1(s.app1)) delete s.app1;
    if (!validApp2(s.app2)) delete s.app2;
    if (!validApp3(s.app3)) delete s.app3;
    if (!validApp4(s.app4)) delete s.app4;
    return s;
  }

  // ---------------------------------------------------------------------
  // 9b. Bus de comunicación (apps <-> hub) + persistencia
  // ---------------------------------------------------------------------
  function loadAll() {
    const s = {};
    Object.entries(KEY_MAP).forEach(([app, key]) => {
      try { const v = localStorage.getItem(key); if (v) s[app] = JSON.parse(v); } catch (e) { /* noop */ }
    });
    return sanitize(s);
  }
  function persist(app, data) {
    try { localStorage.setItem(KEY_MAP[app], JSON.stringify(data)); } catch (e) { /* noop */ }
  }

  // ---- lado APP (dentro del iframe o standalone) ----
  let _appId = null, _onState = null, _cache = {};
  const _embedded = (() => { try { return window.parent && window.parent !== window; } catch (e) { return false; } })();

  function initApp(appId, onState) {
    _appId = appId; _onState = onState;
    window.addEventListener('message', (e) => {
      const m = e.data;
      if (!m || m.bus !== 'state') return;
      _cache = m.state || {};
      if (_onState) _onState(_cache);
    });
    // semilla inmediata desde localStorage (funciona también en standalone)
    _cache = loadAll();
    if (_onState) _onState(_cache);
    // pedir estado autoritativo al hub
    if (_embedded) { try { window.parent.postMessage({ bus: 'req-state', app: appId }, '*'); } catch (e) { /* noop */ } }
  }

  function publish(data) {
    _cache[_appId] = data;
    persist(_appId, data);
    if (_embedded) { try { window.parent.postMessage({ bus: 'update', app: _appId, data: data }, '*'); } catch (e) { /* noop */ } }
  }

  // ---- lado HUB (página principal) ----
  function createHub(onChange) {
    const STATE = loadAll();
    function broadcast() {
      document.querySelectorAll('iframe.appframe').forEach(f => {
        try { f.contentWindow.postMessage({ bus: 'state', state: STATE }, '*'); } catch (e) { /* noop */ }
      });
    }
    window.addEventListener('message', (e) => {
      const m = e.data;
      if (!m || !m.bus) return;
      if (m.bus === 'req-state') {
        try { e.source.postMessage({ bus: 'state', state: STATE }, '*'); } catch (err) { /* noop */ }
      } else if (m.bus === 'update') {
        STATE[m.app] = m.data;
        persist(m.app, m.data);
        if (onChange) onChange(STATE, m.app);
        broadcast();
      }
    });
    return { STATE, broadcast };
  }

  // ---------------------------------------------------------------------
  // 10. Export
  // ---------------------------------------------------------------------
  global.Thermal = {
    // constantes
    T0, P0, R_H2, KEY_MAP, STATION, stationById,
    // física
    props, colorForTemp, fmt,
    // cálculo por capas
    defaultApp1Config, computeApp1,
    defaultApp2Config, computeApp2,
    defaultApp3Config, computeApp3,
    defaultApp4Config, computeApp4,
    synthesizeHEN,
    // validación
    validApp1, validApp2, validApp3, validApp4, sanitize,
    // bus
    loadAll, persist, initApp, publish, createHub, isEmbedded: () => _embedded
  };

})(window);
