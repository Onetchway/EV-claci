import { Signal, Wifi, BatteryFull, MapPin, Zap, Home, Wallet, User, ChevronRight, Navigation } from 'lucide-react';

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-white/70">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <Signal className="h-2.5 w-2.5" />
        <Wifi className="h-2.5 w-2.5" />
        <BatteryFull className="h-3 w-3" />
      </div>
    </div>
  );
}

function BottomNav({ active }) {
  const items = [
    { icon: Home, key: 'home' },
    { icon: MapPin, key: 'map' },
    { icon: Wallet, key: 'wallet' },
    { icon: User, key: 'profile' },
  ];
  return (
    <div className="mt-auto flex items-center justify-between border-t border-white/10 px-6 pb-1 pt-3">
      {items.map((it) => (
        <it.icon key={it.key} className={'h-4.5 w-4.5 ' + (it.key === active ? 'text-lime' : 'text-white/30')} />
      ))}
    </div>
  );
}

function ScreenShell({ title, sub, children, active = 'home' }) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0F2A1E] to-[#071310] p-4 text-white">
      <StatusBar />
      <div className="mt-4 flex items-center justify-between">
        <div>
          <h4 className="font-display text-lg font-bold leading-tight">{title}</h4>
          {sub && <p className="mt-0.5 text-[11px] text-white/45">{sub}</p>}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">LG</span>
      </div>
      <div className="mt-4 flex-1 overflow-hidden">{children}</div>
      <BottomNav active={active} />
    </div>
  );
}

const Row = ({ label, value, accent, icon: Icon }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm">
    <span className="flex shrink-0 items-center gap-2 text-white/60">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </span>
    <span className={'min-w-0 text-right ' + (accent ? 'font-semibold text-lime' : 'font-medium')}>{value}</span>
  </div>
);

export function FindScreen() {
  return (
    <ScreenShell title="Find a charger" sub="Nearby, sorted by distance" active="map">
      <div className="relative h-36 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_30%,rgba(32,168,74,.4),transparent_60%),linear-gradient(160deg,#123326,#07150f)]">
        <svg viewBox="0 0 200 140" className="absolute inset-0 h-full w-full opacity-40">
          <path d="M10,120 C50,80 90,100 130,50 C150,25 170,30 190,10" fill="none" stroke="#6FDB92" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
        </svg>
        <span className="absolute left-[28%] top-[38%] flex h-6 w-6 items-center justify-center rounded-full bg-lime text-ink shadow-[0_0_14px_rgba(111,219,146,.9)]">
          <Zap className="h-3 w-3" />
        </span>
        <span className="absolute left-[58%] top-[55%] h-3.5 w-3.5 rounded-full border-2 border-white/70 bg-brand-500" />
        <span className="absolute left-[44%] top-[74%] h-3.5 w-3.5 rounded-full border-2 border-white/70 bg-brand-500" />
        <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 backdrop-blur">
          <Navigation className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <Row label="Nearest station" value="0.6 km" accent icon={MapPin} />
        <Row label="Available now" value="3 chargers" icon={Zap} />
      </div>
    </ScreenShell>
  );
}

export function DiscoverScreen() {
  return (
    <ScreenShell title="MG Road Hub" sub="Public DC charging plaza" active="map">
      <div className="space-y-2">
        <Row label="Charger" value="60 kW · Dual CCS2" />
        <Row label="Status" value="Available" accent />
        <Row label="Tariff" value="₹18 / kWh" />
        <Row label="Certified" value="ARAI" />
      </div>
      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3 text-sm font-bold text-ink">
        Reserve slot <ChevronRight className="h-4 w-4" />
      </button>
    </ScreenShell>
  );
}

export function StartScreen() {
  return (
    <ScreenShell title="Start charging" sub="Session authentication" active="home">
      <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-lime/40">
          <div className="absolute inset-0 rounded-full border-2 border-lime border-t-transparent" style={{ transform: 'rotate(45deg)' }} />
          <span className="text-xl font-bold text-lime">OTP</span>
        </div>
        <p className="text-xs text-white/55">Enter the OTP shown on the charger to begin.</p>
        <div className="flex gap-2">
          {['4', '2', '1', '8'].map((d, i) => (
            <span key={i} className="flex h-10 w-9 items-center justify-center rounded-lg bg-white/10 font-display text-lg font-bold">
              {d}
            </span>
          ))}
        </div>
      </div>
    </ScreenShell>
  );
}

export function LiveScreen() {
  return (
    <ScreenShell title="Live session" sub="MG Road Hub · Bay 2" active="home">
      <div className="flex flex-col items-center py-1">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#6FDB92"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="264"
              strokeDashoffset="90"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Zap className="h-4 w-4 text-lime" />
            <span className="mt-0.5 font-display text-lg font-bold">66%</span>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Row label="Energy" value="24.2 kWh" icon={Zap} />
        <Row label="Time elapsed" value="00:22:10" />
      </div>
    </ScreenShell>
  );
}

export function PayScreen() {
  return (
    <ScreenShell title="Payment" sub="Session summary" active="wallet">
      <div className="space-y-2">
        <Row label="Session total" value="₹436" accent />
        <Row label="Wallet balance" value="₹1,240" icon={Wallet} />
        <Row label="Method" value="UPI" />
      </div>
      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-3 text-sm font-bold text-ink">
        Pay & finish <ChevronRight className="h-4 w-4" />
      </button>
    </ScreenShell>
  );
}

export function HistoryScreen() {
  return (
    <ScreenShell title="History" sub="Recent charging sessions" active="profile">
      <div className="space-y-2">
        <Row label="Today, MG Road" value="₹436" />
        <Row label="Aug 24, Airport Rd" value="₹612" />
        <Row label="Aug 19, Sector 62" value="₹298" />
      </div>
    </ScreenShell>
  );
}
