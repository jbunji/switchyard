import { TrackCanvas } from "@/components/canvas/TrackCanvas";
import { HUD } from "@/components/hud/HUD";

export default function Home() {
  return (
    <main className="relative flex-1 w-full overflow-hidden">
      <TrackCanvas />
      <HUD />
    </main>
  );
}
