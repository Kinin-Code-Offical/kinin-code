"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Camera, PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { MutableRefObject } from "react";

type CameraRigProps = {
  startCam: Camera | null;
  endCam: Camera | null;
  scrollProgress: MutableRefObject<number>;
};

export function CameraRig({
  startCam,
  endCam,
  scrollProgress,
}: CameraRigProps) {
  const startPos = useRef(new Vector3());
  const endPos = useRef(new Vector3());
  const startQuat = useRef(new Quaternion());
  const endQuat = useRef(new Quaternion());
  const [ready, setReady] = useState(false);

  // Cache vectors/quaternions once when cams are available
  useEffect(() => {
    if (startCam && endCam && !ready) {
      startCam.updateWorldMatrix(true, false);
      endCam.updateWorldMatrix(true, false);

      startCam.getWorldPosition(startPos.current);
      endCam.getWorldPosition(endPos.current);
      startCam.getWorldQuaternion(startQuat.current);
      endCam.getWorldQuaternion(endQuat.current);

      setReady(true);
    }
  }, [startCam, endCam, ready]);

  // Loop that updates the camera only when needed
  useFrame((state) => {
    if (!ready) return;

    const { camera } = state;
    const tRaw = Math.min(1, Math.max(0, scrollProgress.current));
    // Smoothstep interpolation
    const t = tRaw * tRaw * (3 - 2 * tRaw);

    // Lerp position
    camera.position.lerpVectors(startPos.current, endPos.current, t);

    // Slerp rotation
    camera.quaternion.slerpQuaternions(startQuat.current, endQuat.current, t);

    // FOV interpolation
    if (
      camera instanceof PerspectiveCamera &&
      startCam instanceof PerspectiveCamera &&
      endCam instanceof PerspectiveCamera
    ) {
      camera.fov = startCam.fov + (endCam.fov - startCam.fov) * t;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
