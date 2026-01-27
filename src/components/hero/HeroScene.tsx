"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { Component, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box3, Color, Mesh, MeshStandardMaterial, PlaneGeometry, Vector2, Vector3 } from "three";
import type { DevSettings } from "@/lib/devtools";
import type { TerminalApi } from "@/components/terminal/TerminalCanvas";

export type SceneDebugInfo = {
  meshNames: string[];
  screenMeshName: string | null;
  fallbackPlane: boolean;
};

type HeroSceneProps = {
  devSettings?: DevSettings;
  terminalApi: TerminalApi | null;
  scrollProgress: number;
  onDebug: (info: SceneDebugInfo) => void;
  onFocus: () => void;
  onBlur: () => void;
};

class SceneErrorBoundary extends Component<
  { fallback: ReactNode; onError?: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

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

function useParallax() {
  const target = useRef(new Vector2(0, 0));
  const current = useRef(new Vector2(0, 0));

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      target.current.set(x, y);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  useFrame(() => {
    current.current.lerp(target.current, 0.06);
  });

  return current;
}

function ComputerModel({
  devSettings,
  terminalApi,
  onDebug,
}: {
  devSettings?: DevSettings;
  terminalApi: TerminalApi | null;
  onDebug: (info: SceneDebugInfo) => void;
}) {
  const { scene } = useGLTF("/models/computer.glb");
  const screenMeshRef = useRef<Mesh | null>(null);
  const fallbackPlaneRef = useRef<Mesh | null>(null);

  useLayoutEffect(() => {
    const meshNames: string[] = [];
    let screenMesh: Mesh | null = null;

    scene.traverse((child) => {
      if (child instanceof Mesh) {
        meshNames.push(child.name);
        if (/screen|display|monitor/i.test(child.name)) {
          screenMesh = child;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (screenMesh) {
      screenMeshRef.current = screenMesh;
    }

    if (!screenMesh) {
      const bounds = new Box3().setFromObject(scene);
      const size = bounds.getSize(new Vector3());
      const center = bounds.getCenter(new Vector3());
      const planeWidth = size.x * 0.45;
      const planeHeight = size.y * 0.32;
      const plane = new Mesh(new PlaneGeometry(planeWidth, planeHeight));
      plane.position.set(center.x, center.y + size.y * 0.05, bounds.max.z + 0.02);
      plane.name = "FallbackScreen";
      scene.add(plane);
      fallbackPlaneRef.current = plane;
      onDebug({ meshNames, screenMeshName: null, fallbackPlane: true });
      if (process.env.NEXT_PUBLIC_DEVTOOLS === "1") {
        console.info("screen mesh not found, using fallback plane");
      }
    } else {
      onDebug({ meshNames, screenMeshName: screenMesh.name, fallbackPlane: false });
    }
  }, [onDebug, scene]);

  useEffect(() => {
    const screenMesh = screenMeshRef.current;
    if (!terminalApi?.texture) {
      return;
    }
    const material = new MeshStandardMaterial();
    material.map = terminalApi.texture;
    material.emissive = new Color("#ffffff");
    material.emissiveMap = terminalApi.texture;
    material.emissiveIntensity = 2.1;
    material.toneMapped = false;
    material.needsUpdate = true;

    if (screenMesh) {
      screenMesh.material = material;
    }

    if (fallbackPlaneRef.current) {
      fallbackPlaneRef.current.material = material;
    }
  }, [terminalApi]);

  useLayoutEffect(() => {
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    scene.position.sub(center);
  }, [scene]);

  const settings = devSettings?.model ?? {
    scale: 1.35,
    rotX: 0.2,
    rotY: -0.4,
    rotZ: 0,
    posX: 0,
    posY: 0,
    posZ: 0,
  };

  return (
    <group
      position={[settings.posX, settings.posY, settings.posZ]}
      rotation={[settings.rotX, settings.rotY, settings.rotZ]}
      scale={settings.scale}
    >
      <primitive object={scene} />
    </group>
  );
}

function PlaceholderComputer({
  devSettings,
  terminalApi,
}: {
  devSettings?: DevSettings;
  terminalApi: TerminalApi | null;
}) {
  const screenRef = useRef<Mesh | null>(null);
  const texture = terminalApi?.texture ?? null;

  const settings = devSettings?.model ?? {
    scale: 1.2,
    rotX: 0.2,
    rotY: -0.4,
    rotZ: 0,
    posX: 0,
    posY: 0,
    posZ: 0,
  };

  return (
    <group
      position={[settings.posX, settings.posY, settings.posZ]}
      rotation={[settings.rotX, settings.rotY, settings.rotZ]}
      scale={settings.scale}
    >
      <mesh>
        <boxGeometry args={[2.1, 1.6, 1.6]} />
        <meshStandardMaterial color="#2a2119" roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh ref={screenRef} position={[0, 0.2, 0.83]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshStandardMaterial
          color="#1a1410"
          map={texture ?? undefined}
          emissive="#ffffff"
          emissiveMap={texture ?? undefined}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function SceneContent({
  devSettings,
  terminalApi,
  scrollProgress,
  onDebug,
  onFocus,
  onBlur,
}: HeroSceneProps) {
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [canLoadModel, setCanLoadModel] = useState(false);
  const parallax = useParallax();
  const groupRef = useRef<Mesh>(null);

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

  useEffect(() => {
    if (!canLoadModel) {
      onDebug({ meshNames: [], screenMeshName: null, fallbackPlane: true });
    }
  }, [canLoadModel, onDebug]);

  useFrame(({ camera }) => {
    const base = devSettings?.camera ?? {
      x: isMobile ? 0 : 0.2,
      y: isMobile ? 0.6 : 0.9,
      z: isMobile ? 3.2 : 3.6,
      fov: isMobile ? 48 : 42,
    };
    const eased = scrollProgress * scrollProgress;
    camera.position.set(base.x, base.y - eased * 0.2, base.z + eased * 2.8);
    camera.lookAt(0, 0.2, 0);
    camera.fov = base.fov;
    camera.updateProjectionMatrix();

    if (groupRef.current) {
      const tiltX = parallax.current.y * 0.04;
      const tiltY = parallax.current.x * 0.04;
      groupRef.current.rotation.x = tiltX;
      groupRef.current.rotation.y = tiltY;
    }
  });

  const lights = devSettings?.lights ?? {
    ambient: 0.4,
    hemi: 0.5,
    directional: 1.1,
    spotA: 0.7,
    spotB: 0.3,
  };

  return (
    <>
      <color attach="background" args={["#0b0f0e"]} />
      <ambientLight intensity={lights.ambient} />
      <hemisphereLight args={["#f2d3aa", "#120b06", lights.hemi]} />
      <directionalLight
        position={[5, 6, 3]}
        intensity={isMobile ? lights.directional * 0.7 : lights.directional}
        castShadow={!isMobile}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <spotLight position={[-3, 4, 2]} intensity={lights.spotA} angle={0.45} penumbra={0.4} />
      <spotLight position={[2, -2, 2]} intensity={lights.spotB} angle={0.35} />
      <group ref={groupRef}>
        {canLoadModel ? (
          <SceneErrorBoundary
            fallback={<PlaceholderComputer devSettings={devSettings} terminalApi={terminalApi} />}
            onError={() => setCanLoadModel(false)}
          >
            <ComputerModel devSettings={devSettings} terminalApi={terminalApi} onDebug={onDebug} />
          </SceneErrorBoundary>
        ) : (
          <PlaceholderComputer devSettings={devSettings} terminalApi={terminalApi} />
        )}
      </group>
      {isMobile ? null : <Environment preset="city" />}
      <OrbitControls
        enableZoom={Boolean(devSettings)}
        enablePan={Boolean(devSettings)}
        enabled={!isMobile}
        autoRotate
        autoRotateSpeed={isMobile ? 0.15 : 0.4}
      />
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          onFocus();
        }}
        onPointerMissed={() => {
          onBlur();
        }}
      >
        <boxGeometry args={[20, 20, 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export default function HeroScene(props: HeroSceneProps) {
  const isMobile = useMediaQuery("(max-width: 900px)");
  return (
    <Canvas
      dpr={isMobile ? [1, 1.1] : [1, 1.6]}
      camera={{ position: [0.2, 0.8, 3.6], fov: 42 }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
      shadows={!isMobile}
      style={{ width: "100%", height: "100%" }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
