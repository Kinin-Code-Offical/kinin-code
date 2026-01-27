"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Float, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Box3,
  CanvasTexture,
  Color,
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    scene.position.sub(center);
  }, [scene]);

  return <primitive object={scene} scale={1.35} />;
}

function Placeholder({ texture }: { texture: CanvasTexture | null }) {
  return (
    <mesh rotation={[0.2, -0.4, 0]}>
      <boxGeometry args={[1.6, 1, 1.2]} />
      <meshStandardMaterial
        color="#6fd1ff"
        metalness={0.15}
        roughness={0.2}
        map={texture ?? undefined}
      />
    </mesh>
  );
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: "#e9f1eb", fontSize: 12, letterSpacing: "0.12em" }}>
        LOADING SCENE
      </div>
    </Html>
  );
}

export default function ThreeStage() {
  const [canLoadModel, setCanLoadModel] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const texture = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, "#6fd1ff");
    gradient.addColorStop(0.5, "#7ef2b2");
    gradient.addColorStop(1, "#ffb36b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i += 1) {
      ctx.strokeRect(12 + i * 6, 12 + i * 6, 232 - i * 12, 232 - i * 12);
    }

    const map = new CanvasTexture(canvas);
    map.wrapS = RepeatWrapping;
    map.wrapT = RepeatWrapping;
    map.repeat.set(1, 1);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/models/computer.glb", { method: "HEAD", cache: "no-store" })
      .then((res) => {
        if (active) {
          setCanLoadModel(res.ok);
        }
      })
      .catch(() => {
        if (active) {
          setCanLoadModel(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Canvas
      dpr={isMobile ? [1, 1.3] : [1, 1.8]}
      shadows
      camera={{ position: isMobile ? [0, 0.6, 3.2] : [0.2, 0.9, 3.6], fov: isMobile ? 48 : 42 }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
      style={{ width: "100%", height: isMobile ? 320 : 380 }}
    >
      <color attach="background" args={[new Color("#0b1110")]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#bde9ff", "#0a1412", 0.45]} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <spotLight position={[-4, 4, 3]} intensity={0.8} angle={0.4} penumbra={0.4} />
      <spotLight position={[0, -3, 3]} intensity={0.35} angle={0.35} />
      <Suspense fallback={<Loader />}>
        <Float
          speed={isMobile ? 0.8 : 1.2}
          rotationIntensity={isMobile ? 0.25 : 0.4}
          floatIntensity={isMobile ? 0.4 : 0.6}
        >
          {canLoadModel ? <Model url="/models/computer.glb" /> : <Placeholder texture={texture} />}
        </Float>
      </Suspense>
      <Environment preset="city" />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enabled={!isMobile}
        autoRotate
        autoRotateSpeed={isMobile ? 0.4 : 0.8}
      />
    </Canvas>
  );
}
