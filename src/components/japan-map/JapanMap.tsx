"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { FeatureCollection, Position, MultiPolygon } from "@/types/geojson";

type PrefStat = { name: string; value: number };

export type JapanMapProps = {
  data: FeatureCollection;
  stats?: Record<string, PrefStat>; // key: 都道府県名（漢字）
};

// Lambert Conformal Conic (spherical) for Japan
// Parameters commonly used around Japan
const toRad = (deg: number) => (deg * Math.PI) / 180;

function lccProject(
  lat: number,
  lng: number,
  opts = { phi1: 30, phi2: 40, phi0: 36, lambda0: 136 }
) {
  const phi = toRad(lat);
  const lambda = toRad(lng);
  const phi1 = toRad(opts.phi1);
  const phi2 = toRad(opts.phi2);
  const phi0 = toRad(opts.phi0);
  const lambda0 = toRad(opts.lambda0);

  const n = Math.log(Math.cos(phi1) / Math.cos(phi2)) /
    Math.log(Math.tan(Math.PI / 4 + phi2 / 2) / Math.tan(Math.PI / 4 + phi1 / 2));
  const F = (Math.cos(phi1) * Math.pow(Math.tan(Math.PI / 4 + phi1 / 2), n)) / n;
  const rho = F / Math.pow(Math.tan(Math.PI / 4 + phi / 2), n);
  const rho0 = F / Math.pow(Math.tan(Math.PI / 4 + phi0 / 2), n);

  const theta = n * (lambda - lambda0);
  const x = rho * Math.sin(theta);
  const y = rho0 - rho * Math.cos(theta);
  return { x, y };
}

// Simple color scale: value 0..1 -> HSL (240 -> 0)
function valueToColor(v: number) {
  const clamped = Math.max(0, Math.min(1, v));
  const hue = (1 - clamped) * 240; // blue -> red
  return `hsl(${hue}deg 90% 50%)`;
}

export default function JapanMap({ data, stats }: JapanMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  // wait for THREE to be loaded from CDN
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setInterval(() => {
      if ((window as any).THREE) {
        setReady(true);
        clearInterval(timer);
      }
    }, 20);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const THREE: any = (window as any).THREE;
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000);
    // 初期視点:
    camera.position.set(-300, 0, 700);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // lights
    scene.add(new THREE.AmbientLight(0x404040, 1.4));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(200, 400, 150);
    scene.add(dir);

    // group for all prefectures
    const root = new THREE.Group();
    scene.add(root);

    // build shapes from GeoJSON
    const shapes: any[] = [];
    const extruded: any[] = [];

    // compute bounds to normalize scale
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    data.features.forEach((f) => {
      const coords = f.geometry.type === "Polygon"
        ? (f.geometry.coordinates as Position[][])
        : (f.geometry.coordinates as MultiPolygon).flat(1);
      coords.forEach((ring) => {
        ring.forEach(([lng, lat]) => {
          const p = lccProject(lat, lng);
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
      });
    });

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const scale = 800 / Math.max(spanX, spanY); // fit into viewport
    const offsetX = -(minX + spanX / 2);
    const offsetY = -(minY + spanY / 2);

    const group = new THREE.Group();
    root.add(group);

    const defaultHeight = 4;
    const maxValue = stats
      ? Math.max(
          ...Object.values(stats).map((s) => s.value || 0)
        ) || 1
      : 1;

    data.features.forEach((f) => {
      const rawName =
        (f.properties as any).pref ||
        (f.properties as any).name ||
        (f.properties as any).nam_ja ||
        (f.properties as any).ken ||
        "";
      const name = String(rawName).replace(/都|道|府|県/g, "");
      const value = stats?.[name]?.value ?? 0;
      const intensity = Math.min(1, value / maxValue);
      const color = valueToColor(intensity);

      const exteriorRings: Position[][] = [];
      const holesByExterior: Position[][][] = [];

      // Normalize to list of polygons: [ [ring, hole, hole...], ... ]
      const polygons: Position[][][] =
        f.geometry.type === "Polygon"
          ? [(f.geometry.coordinates as Position[][])]
          : (f.geometry.coordinates as MultiPolygon);

      polygons.forEach((poly) => {
        if (poly.length === 0) return;
        const [outer, ...holes] = poly;
        exteriorRings.push(outer);
        holesByExterior.push(holes);
      });

      const combined = new THREE.Group();
      polygons.forEach((poly, idx) => {
        if (poly.length === 0) return;
        const [outer, ...holes] = poly;

        const toVec2 = ([lng, lat]: Position) => {
          const p = lccProject(lat, lng);
          return new THREE.Vector2((p.x + offsetX) * scale, (p.y + offsetY) * scale);
        };

        const shape = new THREE.Shape(outer.map(toVec2));
        holes.forEach((h) => shape.holes.push(new THREE.Path(h.map(toVec2))));

        const height = defaultHeight + intensity * 24;
        const geom = new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false,
        });

        // Move so base sits at y=0
        geom.translate(0, 0, 0);

        const mat = new THREE.MeshStandardMaterial({
          color,
          metalness: 0.1,
          roughness: 0.6,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData = { name, value };
        combined.add(mesh);

        // add outline
        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x222222 })
        );
        combined.add(line);

        shapes.push(shape);
        extruded.push(mesh);
      });

      group.add(combined);
    });

    // ビューの中心に来るようグループを原点へ移動
    const bbox = new THREE.Box3().setFromObject(group);
    const centerVec = new THREE.Vector3();
    bbox.getCenter(centerVec);
    group.position.x -= centerVec.x;
    group.position.y -= centerVec.y;
    group.position.z -= centerVec.z;

    // 画面に綺麗に入るよう初期回転を付与（2枚目の画像の構図）
    // 第1引数で回転の平面度を調整、小さいほど平面になる
    // 第3引数で回転度を調整
    group.rotation.set(-0.8, -0.4, -0.5);

    // simple pointer controls (avoid OrbitControls dependency)
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let scaleZ = 1;

    const onDown = (e: MouseEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      group.rotation.y += dx * 0.005;
      group.rotation.x += dy * 0.005;
      group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x));
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = e.deltaY > 0 ? 0.9 : 1.1;
      scaleZ *= s;
      scaleZ = Math.max(0.2, Math.min(5, scaleZ));
      camera.position.multiplyScalar(e.deltaY > 0 ? 1.05 : 0.95);
    };

    renderer.domElement.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      renderer.domElement.removeEventListener("mousedown", onDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      container.removeChild(renderer.domElement);
    };
  }, [ready, data, stats]);

  return (
    <div className="relative w-full h-[100dvh]">
      <Script
        src="https://unpkg.com/three@0.160.0/build/three.min.js"
        strategy="afterInteractive"
      />
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute left-4 top-4 rounded-lg bg-black/60 text-white p-3 border border-white/20">
        <p className="text-sm">日本列島 3D（都道府県押し出し）</p>
      </div>
    </div>
  );
}
