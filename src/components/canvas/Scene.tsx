"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useEffect } from "react";
import { Camera, CanvasTexture } from "three";
import { RetroComputer } from "./RetroComputer";
import { CameraRig } from "./CameraRig";

type SceneProps = {
  texture: CanvasTexture | null;
  scrollProgressRef: React.MutableRefObject<number>;
  style?: React.CSSProperties; // kept for compatibility but not used on div style attribute
  className?: string;
  onReadyAction?: () => void;
};
// ...
export function Scene({
  texture,
  scrollProgressRef,
  // style, // Unused
  className,
  onReadyAction,
}: SceneProps) {
  const [cameras, setCameras] = useState<{
    start: Camera | null;
    end: Camera | null;
  }>({
    start: null,
    end: null,
  });

  useEffect(() => {
    // Notify parent that scene (and likely model due to Suspense) is ready
    onReadyAction?.();
  }, [onReadyAction]);

  const handleCamerasFound = (start: Camera, end: Camera) => {
    setCameras({ start, end });
  };

  // Prevent rendering when scroll/terminal isn't changing?
  // We use frameloop="demand" so it only renders on state change or invalidate()
  // But CameraRig uses useFrame, so we need to validtate frame when scrolling.
  // We'll attach a listener to scrollProgressRef or just supply invalidate in the parent?
  // Ideally, the parent component calling this should be responsible for invalidating loop on scroll.

  return (
    <div className={className}>
      <Canvas
        dpr={[0.5, 1]} // Optim: Low resolution on mobile
        frameloop="demand" // Optim: Only render when needed
        gl={{
          powerPreference: "low-power",
          antialias: false,
          preserveDrawingBuffer: true,
          depth: true,
          stencil: false,
        }}
        camera={{ position: [0, 0, 5], fov: 42 }}>
        <Suspense fallback={null}>
          <color attach="background" args={["#111"]} />
          {/* 3D Model */}
          <RetroComputer
            texture={texture}
            onCamerasFound={handleCamerasFound}
          />
          {/* Camera Control */}
          <CameraRig
            startCam={cameras.start}
            endCam={cameras.end}
            scrollProgress={scrollProgressRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
