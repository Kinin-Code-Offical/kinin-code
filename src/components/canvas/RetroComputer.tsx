"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useRef, useEffect } from "react";
import {
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  CanvasTexture,
  SRGBColorSpace,
  LinearFilter,
  Camera,
} from "three";

type RetroComputerProps = {
  texture: CanvasTexture | null;
  onCamerasFound: (start: Camera, end: Camera) => void;
  scale?: number;
};

export function RetroComputer({
  texture,
  onCamerasFound,
  scale = 1.35,
}: RetroComputerProps) {
  const { scene, cameras } = useGLTF("/models/computer.glb");
  const screenMeshRef = useRef<Mesh | null>(null);

  // 1. One-time setup: Convert to BasicMaterial & Finding Cameras
  useLayoutEffect(() => {
    // A. Setup Materials (Unlit / Basic)
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        // Disable shadows
        child.castShadow = false;
        child.receiveShadow = false;

        // Convert material to MeshBasicMaterial
        // We reuse materials to save memory if possible, or just create new ones once.
        const oldMat = Array.isArray(child.material)
          ? child.material[0]
          : child.material;
        const color = oldMat?.color || { r: 1, g: 1, b: 1 }; // Default or extract

        const newMat = new MeshBasicMaterial({
          color: color,
          name: oldMat?.name,
        });

        // Screen Detection
        const lowerName = child.name.toLowerCase();
        if (
          /screenmesh|screen_mesh|displaymesh|monitormesh/.test(lowerName) ||
          (/screen|display|monitor/.test(lowerName) &&
            !/glass|bezel/.test(lowerName))
        ) {
          screenMeshRef.current = child;
          // Screen material will be handled specifically with the texture
        } else {
          child.material = newMat;
        }

        // Hide "Process" / "Detail" meshes if we want extreme optimization?
        // For now, let's keep them but with cheap materials.
      }
    });

    // B. Find Cameras
    const findCam = (name: string) => {
      return (
        cameras.find((c) => c.name === name) ||
        (scene.getObjectByName(name) as Camera)
      );
    };

    const start = findCam("ScrollStart");
    const end = findCam("ScrollEnd");

    if (start && end) {
      onCamerasFound(start, end);
    }
  }, [scene, cameras, onCamerasFound]);

  // 2. Handle Screen Texture Updates
  useEffect(() => {
    const screen = screenMeshRef.current;
    if (screen) {
      if (
        !screen.material ||
        !(screen.material instanceof MeshBasicMaterial) ||
        screen.material.name !== "ScreenMat"
      ) {
        screen.material = new MeshBasicMaterial({
          toneMapped: false,
          side: DoubleSide,
          name: "ScreenMat",
        });
      }

      const mat = screen.material as MeshBasicMaterial;

      if (texture) {
        const tex = texture as CanvasTexture;
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.flipY = false;
        mat.map = tex;
        mat.color.set("#ffffff");
      } else {
        mat.map = null;
        mat.color.set("#000000");
      }
      mat.needsUpdate = true;
    }
  }, [texture, scene]); // Dependency on scene in case it reloads

  return (
    <primitive
      object={scene}
      scale={scale}
      position={[0, 0, 0]}
      rotation={[0.2, -0.4, 0]} // Default from previous ThreeStage
    />
  );
}

// Preload
useGLTF.preload("/models/computer.glb");
