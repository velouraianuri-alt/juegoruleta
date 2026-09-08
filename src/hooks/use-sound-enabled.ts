"use client";

import { useSyncExternalStore } from "react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";

function subscribe(callback: () => void) {
  window.addEventListener("prive-sound-toggle", callback);
  return () => window.removeEventListener("prive-sound-toggle", callback);
}

function getServerSnapshot() {
  return true;
}

export function useSoundToggle() {
  const enabled = useSyncExternalStore(subscribe, isSoundEnabled, getServerSnapshot);
  const toggle = () => setSoundEnabled(!enabled);
  return { enabled, toggle };
}
