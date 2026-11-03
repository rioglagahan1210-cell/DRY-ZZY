'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Thermometer,
  Droplets,
  Scale,
  TrendingDown,
  Power,
  RotateCcw,
  Zap,
  Wind,
  Cpu,
  CheckCircle2,
  Clock,
  Sliders,
} from 'lucide-react';

interface Telemetry {
  id: number;
  created_at: string;
  suhu_inlet: number;        // SHT30 #1 Temperature
  suhu_outlet: number;       // SHT30 #2 Temperature
  kelembapan_inlet: number;   // SHT30 #1 Humidity
  kelembapan_outlet: number;  // SHT30 #2 Humidity
  berat_aktual: number;
  susut_bobot_persen: number;
  pwm_heater: number;
  pwm_fan: number;
}

interface Settings {
  id: number;
  target_susut_bobot: number;
  status_alat: string;
}

export default function ProfessionalDashboard() {
  const [telemetry, setTelemetry] = useState<Telemetry[]>([]);
  const [settings, setSettings] = useState<Settings>({
    id: 1,
    target_susut_bobot: 75,
    status_alat: 'STANDBY',
  });
  const [inputTarget, setInputTarget] = useState<number>(75);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

useEffect(() => {
  const fetchInitialData = async () => {
    // 1. Fetch current settings (Row ID 1)
    const { data: setRes, error: setError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (setError) {
      console.error('[Supabase Error] Fetch settings failed:', setError.message);
    } else if (setRes) {
      setSettings(setRes);
      setInputTarget(setRes.target_susut_bobot);
    }

    // 2. Fetch 100 TELEMETRY RECORDS TERAKHIR (SEBELUMNYA LIMIT 25)
    const { data: telRes, error: telError } = await supabase
      .from('telemetry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100); // <-- UBAH KE 100 DI SINI

    if (telError) {
      console.error('[Supabase Error] Fetch telemetry failed:', telError.message);
    } else if (telRes && telRes.length > 0) {
      setTelemetry(telRes.reverse());
    }
  };

  fetchInitialData();

  // 3. Setup Supabase Realtime Channel
  const channel = supabase
    .channel('realtime-dashboard')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'telemetry' },
      (payload) => {
        // Pertahankan maksimal 100 titik data agar memori peramban tetap ringan
        setTelemetry((prev) => {
          const updated = [...prev, payload.new as Telemetry];
          return updated.length > 100 ? updated.slice(updated.length - 100) : updated;
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'settings' },
      (payload) => {
        const updated = payload.new as Settings;
        setSettings(updated);
        setInputTarget(updated.target_susut_bobot);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
  const latest = telemetry[telemetry.length - 1] || {
    suhu_inlet: 0,
    suhu_outlet: 0,
    kelembapan_inlet: 0,
    kelembapan_outlet: 0,
    berat_aktual: 0,
    susut_bobot_persen: 0,
    pwm_heater: 0,
    pwm_fan: 0,
  };

  // Calculate dual-point real-time averages
  const avgTemp = ((Number(latest.suhu_inlet) + Number(latest.suhu_outlet)) / 2).toFixed(1);
  const avgHum = ((Number(latest.kelembapan_inlet) + Number(latest.kelembapan_outlet)) / 2).toFixed(1);

  // Update target shrinkage rate to Supabase
  const handleUpdateTarget = async () => {
    if (inputTarget < 10 || inputTarget > 95) return;
    setIsUpdating(true);
    await supabase
      .from('settings')
      .update({ target_susut_bobot: inputTarget })
      .eq('id', 1);
    setIsUpdating(false);
  };

  // Toggle Start / Stop execution
  const handleToggleState = async () => {
    const nextState = settings.status_alat === 'RUNNING' ? 'STANDBY' : 'RUNNING';
    await supabase
      .from('settings')
      .update({ status_alat: nextState })
      .eq('id', 1);
  };

  const isRunning = settings.status_alat === 'RUNNING';
  const isFinished = settings.status_alat === 'SELESAI';

  const chartData = telemetry.map((item) => ({
    time: new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    temp1: item.suhu_inlet,
    temp2: item.suhu_outlet,
    tempAvg: ((Number(item.suhu_inlet) + Number(item.suhu_outlet)) / 2),
    shrinkage: item.susut_bobot_persen,
  }));

  return (
    <div className="min-h-screen bg-[#0a0d12] text-white p-4 md:p-8 font-sans selection:bg-red-600 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ========================================================= */}
        {/* TOP INDUSTRIAL HEADER BAR                                 */}
        {/* ========================================================= */}
        <header className="relative overflow-hidden bg-[#121721] border-2 border-red-950/60 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="absolute top-0 left-0 w-2 h-full bg-red-600" />
          <div className="space-y-1 text-center md:text-left pl-2">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <span className="bg-red-600 text-white font-extrabold text-xs px-2.5 py-1 rounded tracking-widest uppercase">
                Instrument
              </span>
              <h1 className="text-3xl font-black tracking-tight text-white">
                DRY-ZZY <span className="text-red-500 font-light">WEB MONITORING</span>
              </h1>
            </div>
            <p className="text-xs text-neutral-400 font-mono tracking-wider">
              A Smart Drying Chamber Integrating Mamdani Fuzzy Logic and Automated Mass Reduction Target for Red Ginger Simplicia with Web Monitoring &bull; 
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Real-time Status Badge */}
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-xl border font-mono text-xs uppercase tracking-wider transition-all duration-300 ${
                isRunning
                  ? 'bg-red-950/50 border-red-500 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
                  : isFinished
                  ? 'bg-yellow-950/40 border-yellow-500 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-400'
              }`}
            >
              <span className="relative flex h-3 w-3">
                {isRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isRunning ? 'bg-red-500' : isFinished ? 'bg-yellow-400' : 'bg-neutral-500'
                  }`}
                />
              </span>
              <span>Machine State: <strong className="text-white font-bold">{settings.status_alat}</strong></span>
            </div>

            {/* Start/Stop Main Button */}
            <button
              onClick={handleToggleState}
              className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-lg ${
                isRunning
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-red-400 border border-red-500/50 hover:border-red-500'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40 border border-red-400/40'
              }`}
            >
              <Power className={`w-4 h-4 ${isRunning ? 'text-red-400 animate-spin' : 'text-white'}`} />
              {isRunning ? 'Abort Cycle' : 'Initialize Process'}
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* TELEMETRY METRIC TILES (RED & WHITE ACCENTS)             */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* CARD 1: DUAL SHT30 TEMPERATURE & AVERAGE */}
          <div className="bg-[#121721] border border-neutral-800 rounded-2xl p-5 relative overflow-hidden group hover:border-red-800/80 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-mono uppercase text-neutral-400 tracking-wider">
                  Chamber Temperature
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    {avgTemp}
                  </span>
                  <span className="text-sm font-semibold text-red-500 font-mono">&deg;C Avg</span>
                </div>
              </div>
              <div className="p-2.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400">
                <Thermometer className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-850 flex justify-between text-xs font-mono">
              <div>
                <span className="text-neutral-500 block">SHT30 #1:</span>
                <span className="text-neutral-200 font-semibold">{latest.suhu_inlet}&deg;C</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-500 block">SHT30 #2:</span>
                <span className="text-neutral-200 font-semibold">{latest.suhu_outlet}&deg;C</span>
              </div>
            </div>
          </div>

          {/* CARD 2: DUAL SHT30 HUMIDITY & AVERAGE */}
          <div className="bg-[#121721] border border-neutral-800 rounded-2xl p-5 relative overflow-hidden group hover:border-neutral-700 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-mono uppercase text-neutral-400 tracking-wider">
                  Relative Humidity (RH)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    {avgHum}
                  </span>
                  <span className="text-sm font-semibold text-neutral-300 font-mono">% Avg</span>
                </div>
              </div>
              <div className="p-2.5 bg-neutral-800/60 border border-neutral-700 rounded-xl text-neutral-200">
                <Droplets className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-850 flex justify-between text-xs font-mono">
              <div>
                <span className="text-neutral-500 block">SHT30 #1:</span>
                <span className="text-neutral-200 font-semibold">{latest.kelembapan_inlet}%</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-500 block">SHT30 #2:</span>
                <span className="text-neutral-200 font-semibold">{latest.kelembapan_outlet}%</span>
              </div>
            </div>
          </div>

          {/* CARD 3: LOAD CELL ACTIVE MASS */}
          <div className="bg-[#121721] border border-neutral-800 rounded-2xl p-5 relative overflow-hidden group hover:border-yellow-900/60 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-mono uppercase text-neutral-400 tracking-wider">
                  Sample Weight
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-yellow-400 font-mono tracking-tight">
                    {latest.berat_aktual}
                  </span>
                  <span className="text-sm font-semibold text-yellow-500/80 font-mono">grams</span>
                </div>
              </div>
              <div className="p-2.5 bg-yellow-950/30 border border-yellow-900/50 rounded-xl text-yellow-400">
                <Scale className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-850 flex justify-between text-xs font-mono">
              <span className="text-neutral-500">Transducer:</span>
              <span className="text-neutral-300 font-semibold">5kg Bar + HX711</span>
            </div>
          </div>

          {/* CARD 4: MASS SHRINKAGE RATE */}
          <div className="bg-[#121721] border border-neutral-800 rounded-2xl p-5 relative overflow-hidden group hover:border-red-900/60 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-mono uppercase text-neutral-400 tracking-wider">
                  Moisture Loss
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    {latest.susut_bobot_persen}%
                  </span>
                  <span className="text-xs font-semibold text-red-400 font-mono">
                    / Tgt: {settings.target_susut_bobot}%
                  </span>
                </div>
              </div>
              <div className="p-2.5 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            {/* Graphical Progress Bar */}
            <div className="mt-4 pt-3 border-t border-neutral-850 space-y-1.5">
              <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-800">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-red-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (Number(latest.susut_bobot_persen) / Number(settings.target_susut_bobot || 75)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================= */}
        {/* GRAPH & CONTROL SUITE                                     */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* REAL-TIME DRYING CURVE (RECHARTS) */}
          <div className="lg:col-span-2 bg-[#121721] border border-neutral-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-6">
              <div>
                <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  Real-Time Thin-Layer Drying Rate Curve
                </h2>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                  Transient thermal response & gravimetric progression
                </p>
              </div>

              <span className="text-[11px] font-mono bg-neutral-900 px-3 py-1 rounded-md text-neutral-400 border border-neutral-800 self-start sm:self-auto">
                Window: Last 100 Records
              </span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#6b7280"
                    fontSize={11}
                    fontFamily="monospace"
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    fontFamily="monospace"
                    domain={[0, 100]}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0c1017',
                      borderColor: '#dc2626',
                      borderRadius: '0.75rem',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tempAvg"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    name="Mean Temp (°C)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp1"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    name="SHT30 #1 (°C)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp2"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    name="SHT30 #2 (°C)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="shrinkage"
                    stroke="#eab308"
                    strokeWidth={2.5}
                    name="Shrinkage (%)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DUAL-INPUT CONTROL CONSOLE & ACTUATORS */}
          <div className="bg-[#121721] border border-neutral-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-6">
            
            {/* Gravimetric Setpoint Controller */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sliders className="w-4 h-4 text-red-500" />
                <span>Target Shrinkage Setpoint</span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                Synchronized dual-direction setpoint (Cloud & Rotary Encoder)
              </p>

              <div className="flex gap-2 pt-1">
                <div className="relative w-full">
                  <input
                    type="number"
                    min="10"
                    max="95"
                    value={inputTarget}
                    onChange={(e) => setInputTarget(Number(e.target.value))}
                    className="w-full bg-[#0a0d12] border-2 border-neutral-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-red-500 transition-colors"
                  />
                  <span className="absolute right-3 top-2.5 text-neutral-500 text-xs font-mono font-bold">
                    %
                  </span>
                </div>
                <button
                  onClick={handleUpdateTarget}
                  disabled={isUpdating}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-5 rounded-xl transition flex items-center justify-center gap-2 border border-red-400/30 active:scale-95"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                  Set
                </button>
              </div>
            </div>

            {/* Actuator State Meters (Output of Mamdani FIS) */}
            <div className="space-y-4 pt-4 border-t border-neutral-850">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Cpu className="w-4 h-4 text-yellow-400" />
                <span>Fuzzy Actuator Outputs (PWM)</span>
              </div>

              {/* Heater SSR Duty Meter */}
              <div className="bg-[#0a0d12] border border-neutral-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="flex items-center gap-2 text-neutral-300">
                    <Zap className={`w-3.5 h-3.5 ${latest.pwm_heater > 0 ? 'text-red-500' : 'text-neutral-600'}`} />
                    PTC Heating Element
                  </span>
                  <strong className="text-white font-bold">{latest.pwm_heater}%</strong>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-red-600 h-full transition-all duration-300"
                    style={{ width: `${latest.pwm_heater}%` }}
                  />
                </div>
              </div>

              {/* Exhaust Fan Duty Meter */}
              <div className="bg-[#0a0d12] border border-neutral-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="flex items-center gap-2 text-neutral-300">
                    <Wind className={`w-3.5 h-3.5 ${latest.pwm_fan > 0 ? 'text-yellow-400' : 'text-neutral-600'}`} />
                    Exhaust Blower Fan
                  </span>
                  <strong className="text-white font-bold">{latest.pwm_fan}%</strong>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-full transition-all duration-300"
                    style={{ width: `${latest.pwm_fan}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Standalone Hardware Safety Flag */}
            <div className="bg-neutral-900/60 border border-neutral-850 p-3 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[11px] text-neutral-400 font-mono leading-tight">
                Standalone Mode Active: Rotary encoder inputs maintain physical interrupt priority.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}