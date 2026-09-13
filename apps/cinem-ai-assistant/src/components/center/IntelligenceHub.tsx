import { useEffect, useRef } from "react";
import * as THREE from "three";
import GlassPanel from "@/components/GlassPanel";
import ConnectedNodes from "@/components/center/ConnectedNodes";
import { useAppStore } from "@/store/useAppStore";
import { voice } from "@/lib/voice";
import { glowRGB, iceHex, neonHex, THEME_EVENT } from "@/lib/themes";

/** Builds a soft radial-gradient sprite texture for the orb glow
 *  (resolved from the LIVE theme — rebuilt on every theme switch). */
function makeGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const glow = glowRGB();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${glow},0.85)`);
  g.addColorStop(0.25, `rgba(${glow},0.35)`);
  g.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Center — "Visual Intelligence Hub": glowing Three.js neural orb. */
export default function IntelligenceHub() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* Scene / camera / renderer */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    /* Orb: particle shell + wireframe network + bright core + glow sprite */
    const shellGeo = new THREE.SphereGeometry(1.9, 48, 48);
    const shell = new THREE.Points(
      shellGeo,
      new THREE.PointsMaterial({
        color: new THREE.Color(neonHex()),
        size: 0.02,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );

    const netGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.9, 1));
    const network = new THREE.LineSegments(
      netGeo,
      new THREE.LineBasicMaterial({ color: new THREE.Color(neonHex()), transparent: true, opacity: 0.14 }),
    );

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(iceHex()), transparent: true, opacity: 0.9 }),
    );

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    glow.scale.set(3.6, 3.6, 1);

    /* Slow-orbit ring of particles around the orb */
    const ringPts: number[] = [];
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * Math.PI * 2;
      ringPts.push(Math.cos(a) * 2.6, (Math.random() - 0.5) * 0.12, Math.sin(a) * 2.6);
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(ringPts, 3));
    const ring = new THREE.Points(
      ringGeo,
      new THREE.PointsMaterial({
        color: new THREE.Color(neonHex()),
        size: 0.025,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    ring.rotation.x = 0.45;

    scene.add(shell, network, core, glow, ring);

    /* ── LIVING ORB animation loop ─────────────────────────────────
       The orb is Cinem AI Assistant's face. It reacts to real state every frame:
         idle      → slow teal breathing
         listening → quicker breathing that swells with mic level
         thinking  → tight, fast amber pulse (any pending thought block)
         speaking  → audio-reactive bloom driven by TTS amplitude      */
    const BASE = new THREE.Color(neonHex()); // theme accent (live)
    const AMBER = new THREE.Color(0xffc14d);
    const LISTEN = new THREE.Color(0x6df2b8);
    const cur = BASE.clone();
    const shellMat = shell.material as THREE.PointsMaterial;
    const netMat = network.material as THREE.LineBasicMaterial;
    const ringMat = ring.material as THREE.PointsMaterial;
    const coreMat = core.material as THREE.MeshBasicMaterial;
    const glowMat = glow.material as THREE.SpriteMaterial;

    /* Re-skin the orb live whenever the Theme Engine fires. */
    const onTheme = () => {
      BASE.set(neonHex());
      coreMat.color.set(iceHex());
      glowMat.map?.dispose();
      glowMat.map = makeGlowTexture();
      glowMat.needsUpdate = true;
    };
    window.addEventListener(THEME_EVENT, onTheme);

    const clock = new THREE.Clock();
    let raf = 0;
    let smoothed = 0;
    const animate = () => {
      const t = clock.getElapsedTime();

      const { voiceStatus, messages } = useAppStore.getState();
      const thinking = messages.some((m) => m.pending);
      const level = voice.getLevel(); // 0..1 — real mic / TTS amplitude
      smoothed += (level - smoothed) * 0.25;

      // mood → target color, pulse speed + amplitude, spin speed
      const target =
        thinking ? AMBER : voiceStatus === "listening" ? LISTEN : BASE;
      const speed = thinking ? 5.2 : voiceStatus === "speaking" ? 3 : 1.6;
      const amp =
        voiceStatus === "speaking"
          ? 0.1 + smoothed * 0.9
          : voiceStatus === "listening"
            ? 0.08 + smoothed * 0.5
            : thinking
              ? 0.12
              : 0.07;
      const spin = thinking ? 0.4 : 0.12;

      cur.lerp(target, 0.06);
      shellMat.color.copy(cur);
      netMat.color.copy(cur);
      ringMat.color.copy(cur);

      shell.rotation.y = t * spin + (thinking ? Math.sin(t * 2) * 0.05 : 0);
      shell.rotation.x = Math.sin(t * 0.2) * 0.15;
      network.rotation.y = -t * spin * 0.7;
      ring.rotation.y = t * 0.25;

      const pulse = 1 + Math.sin(t * speed) * amp;
      core.scale.setScalar(pulse);
      glow.scale.setScalar(3.6 * pulse * (voiceStatus === "speaking" ? 1 + smoothed * 0.35 : 1));
      shellMat.opacity = 0.55 + amp * 1.6;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    /* Keep canvas sized to the panel */
    const ro = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    /* Cleanup */
    return () => {
      window.removeEventListener(THEME_EVENT, onTheme);
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      shellGeo.dispose();
      netGeo.dispose();
      ringGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <GlassPanel className="flex-1" bodyClassName="relative overflow-hidden p-0">
      {/* Floating titles */}
      <h2 className="pointer-events-none absolute left-4 top-3 z-20 panel-title">
        Connected
      </h2>
      <h2 className="pointer-events-none absolute left-1/2 top-1/4 z-20 -translate-x-1/2 font-display text-sm font-bold tracking-[0.3em] text-ice/90">
        VISUAL&nbsp;INTELLIGENCE&nbsp;HUB
      </h2>

      {/* Three.js mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Connected nodes + animated neural wires into the orb */}
      <ConnectedNodes />

      {/* Bottom telemetry strip */}
      <div className="pointer-events-none absolute inset-x-6 bottom-3 z-10 flex justify-between font-display text-[0.6rem] tracking-[0.25em] text-neon-dim">
        <span>CORE&nbsp;SYNC&nbsp;:&nbsp;98.4%</span>
        <span>LATENCY&nbsp;:&nbsp;12MS</span>
        <span>MODE&nbsp;:&nbsp;GEMINI&nbsp;/&nbsp;OLLAMA</span>
      </div>
    </GlassPanel>
  );
}
