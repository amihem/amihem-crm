import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { activeBackend } from "../services/dataService";

// IndexedDB mode works fully offline by design — no banner needed there.
// Supabase mode needs a network round-trip for every read/write, so if
// the device goes offline, saves will silently fail until reconnected;
// this makes that visible instead of surprising.
export default function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (activeBackend !== "supabase") return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (activeBackend !== "supabase" || online) return null;

  return (
    <div className="bg-rust text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 relative z-40">
      <WifiOff size={14} />
      You're offline — changes won't save until you're back online.
    </div>
  );
}
