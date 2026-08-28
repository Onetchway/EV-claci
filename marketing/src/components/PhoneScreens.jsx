function ScreenShell({ title, children }) {
  return (
    <div className="flex h-full flex-col p-5 text-white">
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>9:41</span>
        <span>Livanto Green</span>
      </div>
      <h4 className="mt-4 font-display text-lg font-bold">{title}</h4>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

const Row = ({ label, value, accent }) => (
  <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm">
    <span className="text-white/60">{label}</span>
    <span className={accent ? 'font-semibold text-lime' : 'font-medium'}>{value}</span>
  </div>
);

export function FindScreen() {
  return (
    <ScreenShell title="Find a charger">
      <div className="relative h-40 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_30%,rgba(32,168,74,.35),transparent_60%),linear-gradient(160deg,#0e2119,#07150f)]">
        <span className="absolute left-[30%] top-[35%] h-3 w-3 rounded-full bg-lime shadow-[0_0_12px_rgba(111,219,146,.8)]" />
        <span className="absolute left-[58%] top-[55%] h-3 w-3 rounded-full bg-brand-500" />
        <span className="absolute left-[45%] top-[70%] h-3 w-3 rounded-full bg-brand-500" />
      </div>
      <div className="mt-4 space-y-2">
        <Row label="Nearest station" value="0.6 km" accent />
        <Row label="Available now" value="3 chargers" />
      </div>
    </ScreenShell>
  );
}

export function DiscoverScreen() {
  return (
    <ScreenShell title="MG Road Hub">
      <div className="space-y-2">
        <Row label="Charger" value="60 kW DC · Dual CCS2" />
        <Row label="Status" value="Available" accent />
        <Row label="Tariff" value="₹18 / kWh" />
        <Row label="Certified" value="ARAI" />
      </div>
      <button className="mt-5 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold">Reserve</button>
    </ScreenShell>
  );
}

export function StartScreen() {
  return (
    <ScreenShell title="Start charging">
      <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-lime text-2xl font-bold text-lime">
          OTP
        </div>
        <p className="text-sm text-white/60">Enter the OTP shown on the charger to begin.</p>
        <div className="flex gap-2">
          {['4', '2', '1', '8'].map((d, i) => (
            <span key={i} className="flex h-9 w-8 items-center justify-center rounded-lg bg-white/10 font-display font-bold">
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
    <ScreenShell title="Live session">
      <div className="flex flex-col items-center py-2">
        <div className="relative h-32 w-32">
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
            <span className="font-display text-xl font-bold">66%</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Row label="Energy" value="24.2 kWh" />
        <Row label="Time elapsed" value="00:22:10" />
      </div>
    </ScreenShell>
  );
}

export function PayScreen() {
  return (
    <ScreenShell title="Payment">
      <div className="space-y-2">
        <Row label="Session total" value="₹436" accent />
        <Row label="Wallet balance" value="₹1,240" />
        <Row label="Method" value="UPI" />
      </div>
      <button className="mt-5 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold">Pay & finish</button>
    </ScreenShell>
  );
}

export function HistoryScreen() {
  return (
    <ScreenShell title="History">
      <div className="space-y-2">
        <Row label="Today, MG Road" value="₹436" />
        <Row label="Aug 24, Airport Rd" value="₹612" />
        <Row label="Aug 19, Sector 62" value="₹298" />
      </div>
    </ScreenShell>
  );
}
