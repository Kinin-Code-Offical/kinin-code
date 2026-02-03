"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import {
  Component,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";
import {
  Box3,
  BufferAttribute,
  Camera,
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import type { TerminalApi } from "@/components/terminal/TerminalCanvas";

useGLTF.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
if (typeof window !== "undefined") {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const saveData = Boolean(nav.connection?.saveData);
  const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  const slowNetwork = /2g/.test(nav.connection?.effectiveType ?? "");
  const shouldPreload = !saveData && !slowNetwork && !isMobile && memory > 4;
  if (shouldPreload) {
    useGLTF.preload("/models/computer.glb");
  }
}

export type SceneDebugInfo = {
  modelLoaded: boolean;
  meshNames: string[];
  meshCount: number;
  screenMeshName: string | null;
  fallbackPlane: boolean;
};

type HeroSceneProps = {
  terminalApi: TerminalApi | null;
  scrollProgressRef: MutableRefObject<number>;
  noteTexts: { red: string; blue: string };
  active?: boolean;
  onDebugAction: (info: SceneDebugInfo) => void;
  onScreenAspectAction?: (aspect: number) => void;
  onReadyAction?: () => void;
};

const DEFAULT_MODEL = {
  scale: 1,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  posX: 0,
  posY: 0,
  posZ: 0,
};

const DEFAULT_LIGHTS = {
  ambient: 0.8,
  hemi: 0.9,
  directional: 1.6,
  spotA: 1.1,
  spotB: 0.6,
};

const ensurePlanarUv = (mesh: Mesh) => {
  const { geometry } = mesh;
  const { position } = geometry.attributes;
  if (!position) {
    return;
  }
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) {
    return;
  }
  const size = new Vector3();
  bounds.getSize(size);
  const dims = [size.x, size.y, size.z];
  const axes = [0, 1, 2].sort((a, b) => dims[b] - dims[a]);
  const uAxis = axes[0];
  const vAxis = axes[1];
  const minArr = [bounds.min.x, bounds.min.y, bounds.min.z];
  const sizeArr = [size.x, size.y, size.z].map((val) => (val === 0 ? 1 : val));

  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const posArr = [x, y, z];
    const u = (posArr[uAxis] - minArr[uAxis]) / sizeArr[uAxis];
    const v = (posArr[vAxis] - minArr[vAxis]) / sizeArr[vAxis];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
};

type ScreenBasis = {
  rightWorld: Vector3;
  upWorld: Vector3;
  normalWorld: Vector3;
  widthAxis: number;
  heightAxis: number;
  depthAxis: number;
};

const buildScreenBasis = (mesh: Mesh, localSize: Vector3): ScreenBasis => {
  const dims = [
    Math.abs(localSize.x),
    Math.abs(localSize.y),
    Math.abs(localSize.z),
  ];
  const axes = [0, 1, 2].sort((a, b) => dims[b] - dims[a]);
  const widthAxis = axes[0];
  const heightAxis = axes[1];
  const depthAxis = axes[2];
  const axisVectors = [
    new Vector3(1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, 0, 1),
  ];
  const worldQuat = new Quaternion();
  mesh.getWorldQuaternion(worldQuat);
  const rightWorld = axisVectors[widthAxis]
    .clone()
    .applyQuaternion(worldQuat)
    .normalize();
  const upWorld = axisVectors[heightAxis]
    .clone()
    .applyQuaternion(worldQuat)
    .normalize();
  const normalWorld = axisVectors[depthAxis]
    .clone()
    .applyQuaternion(worldQuat)
    .normalize();
  const worldUp = new Vector3(0, 1, 0);
  if (upWorld.dot(worldUp) < 0) {
    upWorld.multiplyScalar(-1);
  }
  const cross = new Vector3().crossVectors(rightWorld, upWorld);
  if (cross.dot(normalWorld) < 0) {
    rightWorld.multiplyScalar(-1);
  }
  return { rightWorld, upWorld, normalWorld, widthAxis, heightAxis, depthAxis };
};

const applyScreenUv = (mesh: Mesh, rightWorld: Vector3, upWorld: Vector3) => {
  const position = mesh.geometry.attributes.position as
    | BufferAttribute
    | undefined;
  if (!position) {
    return;
  }
  const worldPos = new Vector3();
  const uv = new Float32Array(position.count * 2);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < position.count; i += 1) {
    worldPos.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    const u = worldPos.dot(rightWorld);
    const v = worldPos.dot(upWorld);
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const rangeU = maxU - minU || 1;
  const rangeV = maxV - minV || 1;
  for (let i = 0; i < position.count; i += 1) {
    uv[i * 2] = (uv[i * 2] - minU) / rangeU;
    uv[i * 2 + 1] = 1 - (uv[i * 2 + 1] - minV) / rangeV;
  }
  mesh.geometry.setAttribute("uv", new BufferAttribute(uv, 2));
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

type CameraRig = {
  start: Camera | null;
  end: Camera | null;
};

function useParallax(enabled: boolean) {
  const target = useRef(new Vector2(0, 0));
  const current = useRef(new Vector2(0, 0));
  const rafRef = useRef(0);
  const latestRef = useRef(new Vector2(0, 0));

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      latestRef.current.set(x, y);
      if (rafRef.current) {
        return;
      }
      rafRef.current = window.requestAnimationFrame(() => {
        target.current.copy(latestRef.current);
        rafRef.current = 0;
      });
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [enabled]);

  useFrame(() => {
    if (!enabled) {
      current.current.set(0, 0);
      return;
    }
    current.current.lerp(target.current, 0.06);
  });

  return current;
}

function ComputerModel({
  terminalApi,
  noteTexts,
  noteTextureSize,
  noteFontScale,
  onDebugAction,
  onScreenAspectAction,
  onScreenFocus,
  onScreenMeshAction,
  onCameraRig,
  onContentReady,
  usePhoneRig,
  shadowsEnabled,
  allowTerminalTexture,
  active,
  lowPower,
  showNotes,
  setPlaneColor,
}: {
  terminalApi: TerminalApi | null;
  noteTexts: { red: string; blue: string };
  noteTextureSize?: number;
  noteFontScale?: number;
  onDebugAction: (info: SceneDebugInfo) => void;
  onScreenAspectAction?: (aspect: number) => void;
  onScreenFocus?: (center: Vector3) => void;
  onScreenMeshAction?: (mesh: Mesh | null) => void;
  onCameraRig?: (rig: CameraRig) => void;
  onContentReady?: () => void;
  usePhoneRig: boolean;
  shadowsEnabled: boolean;
  allowTerminalTexture: boolean;
  active: boolean;
  lowPower: boolean;
  showNotes: boolean;
  setPlaneColor: string;
}) {
  const { scene, cameras } = useGLTF("/models/computer.glb");
  const screenMeshRef = useRef<Mesh | null>(null);
  const fallbackPlaneRef = useRef<Mesh | null>(null);
  const setPlaneRef = useRef<Mesh | null>(null);
  const noteMeshesRef = useRef<{ red: Mesh | null; blue: Mesh | null }>({
    red: null,
    blue: null,
  });
  const noteFallbackRef = useRef<{ red: Mesh | null; blue: Mesh | null }>({
    red: null,
    blue: null,
  });
  const screenMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const lastTextureRef = useRef<CanvasTexture | null>(null);
  const lastGoodTextureRef = useRef<CanvasTexture | null>(null);
  const sceneCenteredRef = useRef(false);
  const shadowEligibleRef = useRef<WeakSet<Mesh>>(new WeakSet());
  const applyScreenMaterial = useCallback((texture: CanvasTexture | null) => {
    let material = screenMaterialRef.current;
    if (!material) {
      material = new MeshBasicMaterial({ toneMapped: false });
      material.side = DoubleSide;
      material.transparent = false;
      material.depthWrite = false;
      material.depthTest = true;
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -1;
      screenMaterialRef.current = material;
    }
    if (texture) {
      texture.flipY = false;
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
    }
    material.map = texture ?? null;
    material.color.set(texture ? "#ffffff" : "#2a1b0f");
    material.needsUpdate = true;
    if (screenMeshRef.current) {
      screenMeshRef.current.material = material;
    }
    if (fallbackPlaneRef.current) {
      fallbackPlaneRef.current.material = material;
      fallbackPlaneRef.current.castShadow = false;
      fallbackPlaneRef.current.receiveShadow = false;
    }
  }, []);
  const readyRef = useRef(false);
  const screenAspectRef = useRef<number | null>(null);
  const updateScreenMaterial = useCallback(
    (baseTexture: CanvasTexture | null) => {
      const preferred = allowTerminalTexture ? baseTexture : null;
      if (preferred) {
        lastGoodTextureRef.current = preferred;
      }
      const nextTexture = preferred ?? lastGoodTextureRef.current;
      if (nextTexture === lastTextureRef.current) {
        return;
      }
      applyScreenMaterial(nextTexture ?? null);
      lastTextureRef.current = nextTexture ?? null;
    },
    [allowTerminalTexture, applyScreenMaterial],
  );
  useEffect(() => {
    if (!active) {
      return;
    }
    const baseTexture = allowTerminalTexture
      ? (terminalApi?.texture ?? null)
      : null;
    updateScreenMaterial(baseTexture);
  }, [active, allowTerminalTexture, terminalApi, updateScreenMaterial]);

  const pickScreenMesh = (meshList: Mesh[], bounds: Box3, size: Vector3) => {
    let best: { mesh: Mesh; score: number } | null = null;
    for (const mesh of meshList) {
      const box = new Box3().setFromObject(mesh);
      const meshSize = box.getSize(new Vector3());
      if (meshSize.x <= 0 || meshSize.y <= 0 || meshSize.z <= 0) {
        continue;
      }
      const aspect = meshSize.x / meshSize.y;
      const flatness = meshSize.z / Math.max(meshSize.x, meshSize.y);
      const areaRatio =
        (meshSize.x * meshSize.y) / Math.max(size.x * size.y, 0.0001);
      const center = box.getCenter(new Vector3());
      const frontness =
        1 -
        Math.min(
          Math.abs(bounds.max.z - center.z) / Math.max(size.z, 0.0001),
          1,
        );
      const aspectScore = 1 - Math.min(Math.abs(aspect - 1.33), 1);
      const flatScore = flatness < 0.18 ? 1 : Math.max(0, 1 - flatness);
      const score =
        aspectScore * 0.4 +
        areaRatio * 0.35 +
        frontness * 0.2 +
        flatScore * 0.05;
      if (!best || score > best.score) {
        best = { mesh, score };
      }
    }
    return best?.mesh ?? null;
  };
  const getMeshLocalBounds = (mesh: Mesh) => {
    const { geometry } = mesh;
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    if (!geometry.boundingBox) {
      return null;
    }
    const box = geometry.boundingBox.clone();
    return {
      box,
      center: box.getCenter(new Vector3()),
      size: box.getSize(new Vector3()),
    };
  };
  const computeProjectedSize = (
    mesh: Mesh,
    rightWorld: Vector3,
    upWorld: Vector3,
  ) => {
    const posAttr = mesh.geometry.attributes.position as
      | BufferAttribute
      | undefined;
    if (!posAttr || posAttr.count === 0) {
      return null;
    }
    const point = new Vector3();
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < posAttr.count; i += 1) {
      point.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      const u = point.dot(rightWorld);
      const v = point.dot(upWorld);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const width = Math.max(0, maxU - minU);
    const height = Math.max(0, maxV - minV);
    if (!width || !height) {
      return null;
    }
    return { width, height };
  };

  useLayoutEffect(() => {
    const meshNames: string[] = [];
    const meshList: Mesh[] = [];
    const noteMeshes: Mesh[] = [];
    const detailMeshes: Mesh[] = [];
    const sceneCameras: Camera[] = [];
    const namedScreenMeshes: Mesh[] = [];
    const exactScreenMeshes: Mesh[] = [];
    const screenCandidates: Mesh[] = [];
    let screenMesh: Mesh | null = null;
    const detailNamePattern =
      /screw|button|key|knob|dial|pin|bolt|detail|logo|badge|vent|grill|speaker/i;
    const preserveDetailPattern =
      /cup|mug|glass|pen|pencil|ash|ashtray|tray|cig|cigarette|smoke/i;

    if (fallbackPlaneRef.current) {
      scene.remove(fallbackPlaneRef.current);
      fallbackPlaneRef.current.geometry.dispose();
      fallbackPlaneRef.current = null;
    }
    if (noteFallbackRef.current.red || noteFallbackRef.current.blue) {
      const disposeFallback = (mesh: Mesh | null) => {
        if (!mesh) {
          return;
        }
        scene.remove(mesh);
        mesh.geometry.dispose();
      };
      disposeFallback(noteFallbackRef.current.red);
      disposeFallback(noteFallbackRef.current.blue);
      noteFallbackRef.current = { red: null, blue: null };
    }

    const applyColor = (mesh: Mesh | null, color: string) => {
      if (!mesh) {
        return;
      }
      const applyMatColor = (mat: unknown) => {
        const target = mat as { color?: { set: (value: string) => void } };
        if (target?.color?.set) {
          target.color.set(color);
        }
      };
      const { material } = mesh;
      if (Array.isArray(material)) {
        material.forEach(applyMatColor);
      } else {
        applyMatColor(material);
      }
    };

    shadowEligibleRef.current = new WeakSet();
    const enableShadows = shadowsEnabled;

    scene.traverse((child) => {
      if (child instanceof Mesh) {
        meshNames.push(child.name);
        meshList.push(child);
        if (/setplane/i.test(child.name)) {
          setPlaneRef.current = child;
        }
        const name = child.name?.toLowerCase() ?? "";
        if (name) {
          if (
            /screenmesh|screen_mesh|displaymesh|monitormesh|crtmesh|lcdmesh/i.test(
              name,
            )
          ) {
            exactScreenMeshes.push(child);
            screenCandidates.push(child);
          } else if (/screen|display|monitor|crt|lcd/i.test(name)) {
            namedScreenMeshes.push(child);
            screenCandidates.push(child);
          }
        }
        if (/note/i.test(child.name)) {
          noteMeshes.push(child);
        }
        if (lowPower && detailNamePattern.test(child.name)) {
          detailMeshes.push(child);
        }
        child.castShadow = enableShadows;
        child.receiveShadow = enableShadows;
      }
      if (child instanceof Camera) {
        sceneCameras.push(child);
      }
    });

    if (setPlaneRef.current) {
      setPlaneRef.current.castShadow = false;
      setPlaneRef.current.receiveShadow = enableShadows;
    }

    applyColor(setPlaneRef.current, setPlaneColor);

    const bounds = new Box3().setFromObject(scene);
    const size = bounds.getSize(new Vector3());

    const sceneScaleRef = Math.max(size.x, size.y, size.z);
    const shadowCullThreshold = sceneScaleRef * 0.08;
    const meshSizes: Array<{ mesh: Mesh; maxDim: number }> = [];
    meshList.forEach((mesh) => {
      if (mesh === setPlaneRef.current) {
        return;
      }
      if ((mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
        return;
      }
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      const local = getMeshLocalBounds(mesh);
      if (!local) {
        return;
      }
      const scale = new Vector3();
      mesh.getWorldScale(scale);
      scale.set(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
      const worldSize = local.size.clone().multiply(scale);
      const maxDim = Math.max(worldSize.x, worldSize.y, worldSize.z);
      const eligible = maxDim >= shadowCullThreshold;
      if (maxDim > 0) {
        meshSizes.push({ mesh, maxDim });
      }
      if (eligible) {
        shadowEligibleRef.current.add(mesh);
      }
      mesh.castShadow = enableShadows && eligible;
      mesh.receiveShadow = enableShadows && eligible;
      if (
        lowPower &&
        maxDim > 0 &&
        maxDim < sceneScaleRef * 0.06 &&
        !detailMeshes.includes(mesh)
      ) {
        detailMeshes.push(mesh);
      }
    });

    if (exactScreenMeshes.length) {
      screenMesh = exactScreenMeshes[0];
    } else if (namedScreenMeshes.length) {
      screenMesh =
        pickScreenMesh(namedScreenMeshes, bounds, size) ?? namedScreenMeshes[0];
    } else {
      screenMesh = pickScreenMesh(meshList, bounds, size);
    }

    if (screenMesh) {
      if (screenCandidates.length) {
        screenCandidates.forEach((mesh) => {
          if (mesh !== screenMesh) {
            mesh.visible = false;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          }
        });
      }
      screenMeshRef.current = screenMesh;
      screenMesh.renderOrder = 0;
      screenMesh.frustumCulled = false;
      scene.updateWorldMatrix(true, false);
      screenMesh.updateWorldMatrix(true, false);
      onScreenMeshAction?.(screenMesh);

      const screenBounds = new Box3().setFromObject(screenMesh);
      const localBounds = getMeshLocalBounds(screenMesh);
      if (localBounds) {
        const basis = buildScreenBasis(screenMesh, localBounds.size);
        applyScreenUv(screenMesh, basis.rightWorld, basis.upWorld);
        const projectedSize = computeProjectedSize(
          screenMesh,
          basis.rightWorld,
          basis.upWorld,
        );
        const screenScale = new Vector3();
        screenMesh.getWorldScale(screenScale);
        screenScale.set(
          Math.abs(screenScale.x),
          Math.abs(screenScale.y),
          Math.abs(screenScale.z),
        );
        const axisSizes = [
          localBounds.size.x * screenScale.x,
          localBounds.size.y * screenScale.y,
          localBounds.size.z * screenScale.z,
        ];
        const width =
          projectedSize?.width ?? Math.abs(axisSizes[basis.widthAxis]);
        const height =
          projectedSize?.height ?? Math.abs(axisSizes[basis.heightAxis]);
        const aspect = width > 0 && height > 0 ? width / height : 0;
        if (
          aspect > 0 &&
          (screenAspectRef.current === null ||
            Math.abs(screenAspectRef.current - aspect) > 0.02)
        ) {
          screenAspectRef.current = aspect;
          onScreenAspectAction?.(aspect);
        }
      }
      const overlayCandidates: Mesh[] = [];
      scene.traverse((child) => {
        if (!(child instanceof Mesh)) {
          return;
        }
        if (child === screenMesh) {
          return;
        }
        const name = child.name?.toLowerCase() ?? "";
        if (/note/i.test(name)) {
          return;
        }
        const hasGlassName = /glass|cover|panel|bezel|screen/i.test(name);
        const material = child.material as
          | { transparent?: boolean; opacity?: number }
          | Array<{ transparent?: boolean; opacity?: number }>;
        const isTransparent = Array.isArray(material)
          ? material.some((mat) => mat.transparent || (mat.opacity ?? 1) < 1)
          : material?.transparent || (material?.opacity ?? 1) < 1;
        if (!hasGlassName && !isTransparent) {
          return;
        }
        const bounds = new Box3().setFromObject(child);
        if (!bounds.intersectsBox(screenBounds)) {
          const screenCenter = screenBounds.getCenter(new Vector3());
          const childCenter = bounds.getCenter(new Vector3());
          if (
            screenCenter.distanceTo(childCenter) >
            screenBounds.getSize(new Vector3()).length() * 0.6
          ) {
            return;
          }
        }
        overlayCandidates.push(child);
      });

      overlayCandidates.forEach((mesh) => {
        if (lowPower) {
          mesh.visible = false;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          return;
        }
        mesh.renderOrder = 1;
        const applyMat = (mat: unknown) => {
          const material = mat as {
            transparent?: boolean;
            opacity?: number;
            depthWrite?: boolean;
            depthTest?: boolean;
            polygonOffset?: boolean;
            polygonOffsetFactor?: number;
            polygonOffsetUnits?: number;
          };
          if (!material) {
            return;
          }
          material.depthWrite = false;
          material.depthTest = true;
          material.polygonOffset = true;
          material.polygonOffsetFactor = -2;
          material.polygonOffsetUnits = -2;
        };
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(applyMat);
        } else {
          applyMat(mesh.material);
        }
      });
    }

    if (lowPower && detailMeshes.length) {
      const isPreserved = (mesh: Mesh) => {
        let current: Object3D | null = mesh;
        while (current) {
          if (preserveDetailPattern.test(current.name ?? "")) {
            return true;
          }
          current = current.parent ?? null;
        }
        return false;
      };
      const keepCount = Math.max(6, Math.ceil(meshSizes.length * 0.15));
      const keepLargest = meshSizes
        .slice()
        .sort((a, b) => b.maxDim - a.maxDim)
        .slice(0, keepCount)
        .map((entry) => entry.mesh);
      const keepSet = new WeakSet<Mesh>();
      keepLargest.forEach((mesh) => keepSet.add(mesh));
      detailMeshes.forEach((mesh) => {
        if (mesh === screenMesh) {
          return;
        }
        if (mesh === setPlaneRef.current) {
          return;
        }
        if (noteMeshes.includes(mesh) || /note/i.test(mesh.name ?? "")) {
          return;
        }
        if (keepSet.has(mesh)) {
          return;
        }
        const meshName = mesh.name ?? "";
        if (/case|body|base|keyboard|shell|chassis/i.test(meshName)) {
          return;
        }
        if (preserveDetailPattern.test(meshName) || isPreserved(mesh)) {
          return;
        }
        if (screenCandidates.includes(mesh)) {
          return;
        }
        mesh.visible = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      });
    }

    if (noteMeshes.length) {
      const byName = (pattern: RegExp) =>
        noteMeshes.find((mesh) => pattern.test(mesh.name)) ?? null;
      const red = byName(/note[\s_.-]*0?1/i);
      const blue = byName(/note[\s_.-]*0?2/i);
      const fallback = [...noteMeshes].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      noteMeshesRef.current = {
        red: red ?? fallback[0] ?? null,
        blue: blue ?? fallback[1] ?? null,
      };
      if (showNotes) {
        noteMeshes.forEach((mesh) => ensurePlanarUv(mesh));
      }
    } else {
      noteMeshesRef.current = { red: null, blue: null };
      if (showNotes) {
        const fallbackSize = Math.max(0.12, size.x * 0.08);
        const redPlane = new Mesh(
          new PlaneGeometry(fallbackSize, fallbackSize),
        );
        const bluePlane = new Mesh(
          new PlaneGeometry(fallbackSize, fallbackSize),
        );
        redPlane.name = "NoteFallbackRed";
        bluePlane.name = "NoteFallbackBlue";
        redPlane.position.set(
          bounds.max.x - fallbackSize * 0.6,
          bounds.max.y - fallbackSize * 0.4,
          bounds.max.z - fallbackSize * 0.2,
        );
        bluePlane.position.set(
          bounds.max.x - fallbackSize * 1.4,
          bounds.max.y - fallbackSize * 0.7,
          bounds.max.z - fallbackSize * 0.22,
        );
        redPlane.renderOrder = 1;
        bluePlane.renderOrder = 1;
        scene.add(redPlane);
        scene.add(bluePlane);
        noteFallbackRef.current = { red: redPlane, blue: bluePlane };
        noteMeshesRef.current = { red: redPlane, blue: bluePlane };
        ensurePlanarUv(redPlane);
        ensurePlanarUv(bluePlane);
      }
    }

    const screenMeshName: string | null = screenMesh?.name ?? null;

    const normalizeName = (value: string | undefined) =>
      (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const matches = (value: string | undefined, target: string) =>
      normalizeName(value) === normalizeName(target);
    const findCamera = (target: string) => {
      const byNode = sceneCameras.find(
        (cam) =>
          matches(cam.name, target) ||
          matches(cam.parent?.name, target) ||
          normalizeName(cam.name).includes(normalizeName(target)),
      );
      if (byNode) {
        return byNode;
      }
      return cameras.find((cam) => matches(cam.name, target)) ?? null;
    };
    const startCam = usePhoneRig
      ? (findCamera("ScrollStartPhone") ?? findCamera("ScrollStart"))
      : findCamera("ScrollStart");
    const endCam = usePhoneRig
      ? (findCamera("ScrollEndPhone") ?? findCamera("ScrollEnd"))
      : findCamera("ScrollEnd");
    onCameraRig?.({ start: startCam, end: endCam });
    if (!screenMesh) {
      const center = bounds.getCenter(new Vector3());
      const planeWidth = size.x * 0.45;
      const planeHeight = size.y * 0.32;
      const plane = new Mesh(new PlaneGeometry(planeWidth, planeHeight));
      plane.position.set(
        center.x,
        center.y + size.y * 0.05,
        bounds.max.z + 0.01,
      );
      plane.name = "FallbackScreen";
      plane.renderOrder = 0;
      plane.frustumCulled = false;
      scene.add(plane);
      fallbackPlaneRef.current = plane;
      onScreenFocus?.(plane.position.clone());
      onScreenMeshAction?.(plane);
      const fallbackAspect = planeWidth > 0 ? planeWidth / planeHeight : 0;
      if (
        fallbackAspect > 0 &&
        (screenAspectRef.current === null ||
          Math.abs(screenAspectRef.current - fallbackAspect) > 0.02)
      ) {
        screenAspectRef.current = fallbackAspect;
        onScreenAspectAction?.(fallbackAspect);
      }
      onDebugAction({
        modelLoaded: true,
        meshNames,
        meshCount: meshNames.length,
        screenMeshName: screenMeshName ?? plane.name,
        fallbackPlane: true,
      });
    } else {
      onDebugAction({
        modelLoaded: true,
        meshNames,
        meshCount: meshNames.length,
        screenMeshName,
        fallbackPlane: false,
      });
    }

    if (!readyRef.current) {
      readyRef.current = true;
      onContentReady?.();
    }
  }, [
    cameras,
    onCameraRig,
    onContentReady,
    onDebugAction,
    onScreenAspectAction,
    onScreenFocus,
    onScreenMeshAction,
    scene,
    setPlaneColor,
    lowPower,
    showNotes,
    usePhoneRig,
    shadowsEnabled,
  ]);

  useEffect(() => {
    const eligible = shadowEligibleRef.current;
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }
      if (child === setPlaneRef.current) {
        child.castShadow = false;
        child.receiveShadow = shadowsEnabled;
        return;
      }
      const canShadow = eligible.has(child);
      child.castShadow = shadowsEnabled && canShadow;
      child.receiveShadow = shadowsEnabled && canShadow;
    });
  }, [scene, shadowsEnabled]);

  useEffect(() => {
    const mesh = setPlaneRef.current;
    if (!mesh) {
      return;
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const accentRgb = rootStyle.getPropertyValue("--hero-accent-rgb").trim();
    const brightenRgb = (value: string, boost: number) => {
      const parts = value.split(",").map((v) => Number.parseFloat(v.trim()));
      if (parts.length < 3 || parts.some((v) => Number.isNaN(v))) {
        return null;
      }
      const [r, g, b] = parts;
      const to255 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
      return `rgb(${to255(r + boost)}, ${to255(g + boost)}, ${to255(b + boost)})`;
    };
    const planeColor =
      accentRgb && brightenRgb(accentRgb, 38)
        ? (brightenRgb(accentRgb, 38) as string)
        : setPlaneColor;
    const unlitMaterial = new MeshBasicMaterial({
      color: planeColor,
      toneMapped: false,
    });
    mesh.material = unlitMaterial;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }, [lowPower, setPlaneColor]);

  useEffect(() => {
    updateScreenMaterial(terminalApi?.texture ?? null);
    return () => {
      if (screenMaterialRef.current) {
        screenMaterialRef.current.dispose();
        screenMaterialRef.current = null;
      }
    };
  }, [terminalApi, updateScreenMaterial]);

  const noteTextures = useMemo(() => {
    if (!showNotes) {
      return { red: null, blue: null };
    }
    const hashString = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
      }
      return Math.abs(hash);
    };

    const rand = (seed: number) => {
      let t = seed + 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const makeTexture = (label: string, color: string) => {
      const canvas = document.createElement("canvas");
      const size = noteTextureSize ?? 512;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      const fontScale = noteFontScale ?? 1;
      const rawLines = label.split("\n");
      let fontSize = Math.round(size * 0.094 * fontScale);
      let lineHeight = Math.round(fontSize * 1.3);
      const maxTextHeight = size * 0.58;
      const requiredHeight = rawLines.length * lineHeight;
      if (requiredHeight > maxTextHeight) {
        const fitScale = Math.max(0.7, maxTextHeight / requiredHeight);
        fontSize = Math.max(12, Math.round(fontSize * fitScale));
        lineHeight = Math.round(fontSize * 1.3);
      }
      const seed = hashString(label);
      const tilt = (rand(seed) - 0.5) * 0.08;
      const noiseCount = 2800;
      const tapeShade = "rgba(255,255,255,0.18)";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = tapeShade;
      ctx.save();
      ctx.translate(size * 0.15, size * 0.1);
      ctx.rotate(-0.15);
      ctx.fillRect(-20, -10, size * 0.5, 30);
      ctx.restore();
      ctx.globalAlpha = 1;

      ctx.globalAlpha = 0.14;
      for (let i = 0; i < noiseCount; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${rand(seed + i) * 0.2})`;
        ctx.fillRect(
          rand(seed + i * 7) * size,
          rand(seed + i * 11) * size,
          1,
          1,
        );
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate(tilt);
      ctx.fillStyle = "rgba(36, 26, 18, 0.92)";
      ctx.font = `bold ${fontSize}px 'Segoe Print', 'Segoe Script', 'Comic Sans MS', cursive`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const lines = rawLines;
      const textBlockHeight = lines.length * lineHeight;
      const startY = -Math.min(size * 0.2, textBlockHeight * 0.55);
      const startX = -size * 0.26;
      lines.forEach((rawLine, index) => {
        const isList = rawLine.trim().startsWith("-");
        const line = isList ? rawLine.replace(/^\s*-\s*/, "") : rawLine;
        const jitterX = (rand(seed + index * 13) - 0.5) * 1.4;
        const jitterY = (rand(seed + index * 29) - 0.5) * 1.4;
        const lineGap = (rand(seed + index * 53) - 0.5) * 1.4;
        const y = startY + index * lineHeight + jitterY + lineGap;
        const x = startX + jitterX;
        if (isList) {
          const boxSize = Math.max(10, Math.round(fontSize * 0.7));
          const boxOffsetX = Math.round(fontSize * 0.95);
          const boxOffsetY = Math.round(fontSize * 0.32);
          ctx.strokeStyle = "rgba(24, 18, 12, 0.7)";
          ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.11));
          ctx.strokeRect(x - boxOffsetX, y + boxOffsetY, boxSize, boxSize);
          if (index % 2 === 0) {
            ctx.beginPath();
            ctx.moveTo(
              x - boxOffsetX + boxSize * 0.2,
              y + boxOffsetY + boxSize * 0.55,
            );
            ctx.lineTo(
              x - boxOffsetX + boxSize * 0.45,
              y + boxOffsetY + boxSize * 0.8,
            );
            ctx.lineTo(
              x - boxOffsetX + boxSize * 0.85,
              y + boxOffsetY + boxSize * 0.2,
            );
            ctx.stroke();
          }
        }
        ctx.fillText(line, x, y);
      });

      // goofy doodle
      if (color === "#c94848") {
        const doodleX = size * 0.18;
        const doodleY = size * 0.12;
        const faceRadius = Math.max(12, Math.round(fontSize * 0.75));
        const eyeRadius = Math.max(2, Math.round(fontSize * 0.12));
        const mouthRadius = Math.max(6, Math.round(fontSize * 0.32));
        ctx.translate(doodleX, doodleY);
        ctx.rotate(0.2);
        ctx.strokeStyle = "rgba(20, 14, 10, 0.7)";
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.11));
        ctx.beginPath();
        ctx.arc(0, 0, faceRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          -faceRadius * 0.36,
          -faceRadius * 0.22,
          eyeRadius,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          faceRadius * 0.36,
          -faceRadius * 0.22,
          eyeRadius,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, faceRadius * 0.16, mouthRadius, 0, Math.PI, false);
        ctx.stroke();
      }
      ctx.restore();

      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.needsUpdate = true;
      return texture;
    };

    return {
      red: makeTexture(noteTexts.red, "#c94848"),
      blue: makeTexture(noteTexts.blue, "#3e6fd1"),
    };
  }, [
    noteFontScale,
    noteTexts.blue,
    noteTexts.red,
    noteTextureSize,
    showNotes,
  ]);

  useEffect(() => {
    const notes = noteMeshesRef.current;
    if (!notes.red && !notes.blue) {
      return;
    }
    const setVisible = (mesh: Mesh | null, visible: boolean) => {
      if (mesh) {
        mesh.visible = visible;
      }
    };
    setVisible(notes.red, true);
    setVisible(notes.blue, true);
  }, [showNotes]);

  useEffect(() => {
    const notes = noteMeshesRef.current;
    if (!notes.red && !notes.blue) {
      return;
    }
    const setVisible = (mesh: Mesh | null, visible: boolean) => {
      if (mesh) {
        mesh.visible = visible;
      }
    };
    setVisible(notes.red, showNotes);
    setVisible(notes.blue, showNotes);
    if (!showNotes) {
      return;
    }
    const applyMaterial = (
      mesh: Mesh | null,
      texture: CanvasTexture | null,
    ) => {
      if (!mesh || !texture) {
        return;
      }
      const material = new MeshBasicMaterial({
        map: texture,
        toneMapped: false,
      });
      mesh.material = material;
    };

    applyMaterial(notes.red, noteTextures.red);
    applyMaterial(notes.blue, noteTextures.blue);
  }, [noteTextures.blue, noteTextures.red, showNotes]);

  useEffect(() => {
    return () => {
      noteTextures.red?.dispose();
      noteTextures.blue?.dispose();
    };
  }, [noteTextures]);

  useLayoutEffect(() => {
    if (!sceneCenteredRef.current) {
      const box = new Box3().setFromObject(scene);
      const center = box.getCenter(new Vector3());
      scene.position.sub(center);
      sceneCenteredRef.current = true;
    }
    const screenMesh = screenMeshRef.current;
    if (screenMesh) {
      const screenBounds = new Box3().setFromObject(screenMesh);
      const screenCenter = screenBounds.getCenter(new Vector3());
      onScreenFocus?.(screenCenter);
    } else if (fallbackPlaneRef.current) {
      onScreenFocus?.(fallbackPlaneRef.current.position);
    }
  }, [onScreenFocus, scene]);

  const { posX, posY, posZ, rotX, rotY, rotZ, scale } = DEFAULT_MODEL;

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[rotX, rotY, rotZ]}
      scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

function PlaceholderComputer({
  terminalApi,
  allowTerminalTexture,
  lowPower,
}: {
  terminalApi: TerminalApi | null;
  allowTerminalTexture: boolean;
  lowPower: boolean;
}) {
  const screenRef = useRef<Mesh | null>(null);
  const texture = allowTerminalTexture ? (terminalApi?.texture ?? null) : null;

  const settings = {
    scale: 1.2,
    rotX: 0.2,
    rotY: -0.4,
    rotZ: 0,
    posX: 0,
    posY: 0,
    posZ: 0,
  };

  const { posX, posY, posZ, rotX, rotY, rotZ, scale } = settings;

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[rotX, rotY, rotZ]}
      scale={scale}>
      <mesh>
        <boxGeometry args={[2.1, 1.6, 1.6]} />
        <meshStandardMaterial
          color="#2a2119"
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
      <mesh ref={screenRef} position={[0, 0.2, 0.83]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshStandardMaterial
          color="#1a1410"
          map={texture ?? undefined}
          emissive={lowPower ? "#000000" : "#ffffff"}
          emissiveMap={lowPower ? undefined : (texture ?? undefined)}
          emissiveIntensity={lowPower ? 0 : 2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function SceneContent({
  terminalApi,
  scrollProgressRef,
  noteTexts,
  active = true,
  onDebugAction,
  onScreenAspectAction,
  onReadyAction,
  interactionActive,
  lowPower,
  performanceMode,
  enhancedLighting,
}: HeroSceneProps & {
  interactionActive: boolean;
  lowPower: boolean;
  performanceMode: boolean;
  enhancedLighting: boolean;
}) {
  const isMobile = useMediaQuery("(max-width: 900px)");
  const isLandscape = useMediaQuery("(orientation: landscape)");
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");
  const allowPointerParallax =
    active && !isMobile && !isCoarsePointer && !lowPower;
  const usePhoneRig = isMobile && !isLandscape;
  const isFirefox = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /firefox/i.test(navigator.userAgent);
  }, []);
  const [modelAttempt, setModelAttempt] = useState(0);
  const [bgColor, setBgColor] = useState("#0b0f0e");
  const bgPaletteRef = useRef<{
    start: [number, number, number];
    end: [number, number, number];
  }>({ start: [11, 15, 14], end: [11, 15, 14] });
  const lastBgRef = useRef("");
  const [envReady, setEnvReady] = useState(false);
  const { gl, invalidate } = useThree();
  const parallax = useParallax(allowPointerParallax);
  const groupRef = useRef<Mesh>(null);
  const contentReadyRef = useRef(false);
  const frameReadyRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const modelFailedRef = useRef(false);
  const screenFocusRef = useRef(new Vector3(0, 0.2, 0));
  const focusWorldRef = useRef(new Vector3());
  const cameraDirRef = useRef(new Vector3());
  const screenTargetRef = useRef<Mesh | null>(null);
  const cameraRigRef = useRef<CameraRig>({ start: null, end: null });
  const cameraStartPosRef = useRef(new Vector3());
  const cameraEndPosRef = useRef(new Vector3());
  const cameraStartQuatRef = useRef(new Quaternion());
  const cameraEndQuatRef = useRef(new Quaternion());
  const cameraBlendQuatRef = useRef(new Quaternion());
  const screenBoxRef = useRef(new Box3());
  const screenCenterRef = useRef(new Vector3());
  const screenSizeRef = useRef(new Vector3());
  const screenQuatRef = useRef(new Quaternion());
  const screenNormalRef = useRef(new Vector3());
  const cameraTempRef = useRef(new Vector3());
  const cameraDesiredRef = useRef(new Vector3());
  const cameraForwardRef = useRef(new Vector3());
  const cameraRightRef = useRef(new Vector3());
  const cameraUpRef = useRef(new Vector3());
  const lastScrollValueRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const smoothScrollRef = useRef(0);
  const lastRawScrollRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const needsInvalidateRef = useRef(false);
  const pendingTextureUpdateRef = useRef(false);
  const parallaxZeroRef = useRef(new Vector2(0, 0));

  const valMap = useCallback(
    (value: number, from: [number, number], to: [number, number]) => {
      const [a, b] = from;
      const [c, d] = to;
      const t = a === b ? 0 : (value - a) / (b - a);
      const clamped = Math.min(1, Math.max(0, t));
      return c + (d - c) * clamped;
    },
    [],
  );

  const parseRgbParts = useCallback((value: string) => {
    const parts = value
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((val) => Number.parseFloat(val));
    if (parts.length < 3 || parts.some((val) => Number.isNaN(val))) {
      return null;
    }
    return [parts[0], parts[1], parts[2]] as [number, number, number];
  }, []);

  const parseHex = useCallback((value: string) => {
    const raw = value.replace("#", "").trim();
    if (raw.length === 3) {
      const r = Number.parseInt(raw[0] + raw[0], 16);
      const g = Number.parseInt(raw[1] + raw[1], 16);
      const b = Number.parseInt(raw[2] + raw[2], 16);
      return [r, g, b] as [number, number, number];
    }
    if (raw.length >= 6) {
      const r = Number.parseInt(raw.slice(0, 2), 16);
      const g = Number.parseInt(raw.slice(2, 4), 16);
      const b = Number.parseInt(raw.slice(4, 6), 16);
      if ([r, g, b].some((val) => Number.isNaN(val))) {
        return null;
      }
      return [r, g, b] as [number, number, number];
    }
    return null;
  }, []);

  const parseColor = useCallback(
    (value: string) => {
      if (!value) {
        return null;
      }
      const trimmed = value.trim();
      if (trimmed.startsWith("#")) {
        return parseHex(trimmed);
      }
      if (trimmed.startsWith("rgb")) {
        const matches = trimmed.match(/[\d.]+/g) ?? [];
        const parts = matches.map((val) => Number.parseFloat(val));
        if (
          parts.length >= 3 &&
          parts.slice(0, 3).every((val) => !Number.isNaN(val))
        ) {
          return [parts[0], parts[1], parts[2]] as [number, number, number];
        }
      }
      return parseRgbParts(trimmed);
    },
    [parseHex, parseRgbParts],
  );

  const blendColor = (
    a: [number, number, number],
    b: [number, number, number],
    t: number,
  ) =>
    [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ] as [number, number, number];

  const formatRgb = useCallback(
    (value: [number, number, number]) =>
      `rgb(${Math.round(value[0])}, ${Math.round(value[1])}, ${Math.round(
        value[2],
      )})`,
    [],
  );

  const handleContentReady = useCallback(() => {
    contentReadyRef.current = true;
    modelFailedRef.current = false;
    retryCountRef.current = 0;
    setEnvReady(true);
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    invalidate();
  }, [invalidate]);

  const scheduleModelRetry = useCallback(
    (reason: "error" | "reset" | "visible") => {
      if (contentReadyRef.current) {
        return;
      }
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
      const attempt =
        reason === "reset" ? 0 : Math.min(retryCountRef.current + 1, 6);
      retryCountRef.current = attempt;
      const delay =
        reason === "reset" ? 0 : Math.min(9000, 700 + attempt * 900);
      retryTimerRef.current = window.setTimeout(() => {
        setModelAttempt((prev) => prev + 1);
      }, delay);
    },
    [],
  );

  const handleModelError = useCallback(() => {
    modelFailedRef.current = true;
    onDebugAction({
      modelLoaded: false,
      meshNames: [],
      meshCount: 0,
      screenMeshName: null,
      fallbackPlane: true,
    });
    scheduleModelRetry("error");
  }, [onDebugAction, scheduleModelRetry]);

  const handleScreenFocus = useCallback((center: Vector3) => {
    screenFocusRef.current.copy(center);
  }, []);

  const handleScreenMesh = useCallback((mesh: Mesh | null) => {
    screenTargetRef.current = mesh;
    if (!mesh) {
      return;
    }
    mesh.updateWorldMatrix(true, false);
    screenBoxRef.current.setFromObject(mesh);
    screenBoxRef.current.getCenter(screenCenterRef.current);
    screenBoxRef.current.getSize(screenSizeRef.current);
    mesh.getWorldQuaternion(screenQuatRef.current);
    screenNormalRef.current
      .set(0, 0, 1)
      .applyQuaternion(screenQuatRef.current)
      .normalize();
  }, []);

  const handleCameraRig = useCallback((rig: CameraRig) => {
    cameraRigRef.current = rig;
  }, []);

  useEffect(() => {
    const handleCanvasReset = () => {
      if (!contentReadyRef.current) {
        modelFailedRef.current = false;
        scheduleModelRetry("reset");
      }
    };
    const handleVisibility = () => {
      if (!document.hidden && modelFailedRef.current) {
        scheduleModelRetry("visible");
      }
    };
    window.addEventListener("hero-canvas-reset", handleCanvasReset);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("hero-canvas-reset", handleCanvasReset);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [scheduleModelRetry]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const readBg = () => {
      const style = getComputedStyle(document.documentElement);
      const contentBgRaw = style.getPropertyValue("--content-bg").trim();
      const heroBgRaw = style.getPropertyValue("--hero-bg").trim();
      const content =
        parseColor(contentBgRaw) ??
        parseColor(heroBgRaw) ??
        ([11, 15, 14] as [number, number, number]);
      const start = content;
      const end = content;
      bgPaletteRef.current = { start, end };
      const initial = formatRgb(start);
      lastBgRef.current = initial;
      setBgColor(initial);
    };
    readBg();
    const observer = new MutationObserver(readBg);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [formatRgb, parseColor, parseRgbParts]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const initial = scrollProgressRef.current;
    smoothScrollRef.current = initial;
    lastRawScrollRef.current = initial;
    let rafId = 0;
    let ticking = false;
    let lastInvalidate = 0;
    const { current: initialScroll } = scrollProgressRef;
    const lastScrollRef = { value: initialScroll };
    lastScrollValueRef.current = initialScroll;
    lastScrollTimeRef.current = performance.now();
    const lowPowerInterval = 120;
    const diffThreshold = performanceMode ? 0.0025 : lowPower ? 0.0018 : 0.0005;
    const minInterval = performanceMode
      ? 140
      : lowPower
        ? lowPowerInterval
        : isMobile
          ? 70
          : 45;
    const tick = () => {
      const now = performance.now();
      const { current } = scrollProgressRef;
      const diff = Math.abs(current - lastScrollRef.value);
      if (diff > diffThreshold || needsInvalidateRef.current) {
        if (now - lastInvalidate < minInterval) {
          rafId = window.requestAnimationFrame(tick);
          return;
        }
        lastInvalidate = now;
        lastScrollRef.value = current;
        lastScrollValueRef.current = current;
        needsInvalidateRef.current = false;
        invalidate();
        rafId = window.requestAnimationFrame(tick);
      } else {
        ticking = false;
      }
    };
    const requestTick = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      rafId = window.requestAnimationFrame(tick);
    };
    const markScroll = () => {
      lastScrollTimeRef.current = performance.now();
      needsInvalidateRef.current = true;
      requestTick();
    };
    const handleMove = () => {
      if (allowPointerParallax) {
        needsInvalidateRef.current = true;
        requestTick();
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        return;
      }
      needsInvalidateRef.current = true;
      requestTick();
    };
    window.addEventListener("scroll", markScroll, { passive: true });
    window.addEventListener("resize", markScroll);
    if (allowPointerParallax) {
      window.addEventListener("pointermove", handleMove, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    requestTick();
    return () => {
      window.removeEventListener("scroll", markScroll);
      window.removeEventListener("resize", markScroll);
      if (allowPointerParallax) {
        window.removeEventListener("pointermove", handleMove);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    active,
    allowPointerParallax,
    invalidate,
    isMobile,
    lowPower,
    performanceMode,
    scrollProgressRef,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!active) {
      window.dispatchEvent(
        new CustomEvent("hero-interaction", { detail: { active: false } }),
      );
      return;
    }
    let timerId = 0;
    let interactionFlag = false;
    const setActive = (next: boolean) => {
      if (interactionFlag === next) {
        return;
      }
      interactionFlag = next;
      window.dispatchEvent(
        new CustomEvent("hero-interaction", {
          detail: { active: interactionFlag },
        }),
      );
    };
    const scheduleEnd = () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }
      timerId = window.setTimeout(() => {
        setActive(false);
      }, 180);
    };
    const markInteraction = () => {
      setActive(true);
      scheduleEnd();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key.startsWith("Arrow") ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        markInteraction();
      }
    };
    window.addEventListener("scroll", markInteraction, { passive: true });
    window.addEventListener("wheel", markInteraction, { passive: true });
    if (!lowPower) {
      window.addEventListener("pointermove", markInteraction, {
        passive: true,
      });
      window.addEventListener("touchmove", markInteraction, { passive: true });
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("scroll", markInteraction);
      window.removeEventListener("wheel", markInteraction);
      if (!lowPower) {
        window.removeEventListener("pointermove", markInteraction);
        window.removeEventListener("touchmove", markInteraction);
      }
      window.removeEventListener("keydown", handleKey);
      if (timerId) {
        window.clearTimeout(timerId);
      }
      setActive(false);
    };
  }, [active, lowPower]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        gl.info.reset();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [gl]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const handleTextureUpdate = () => {
      if (interactionActive) {
        pendingTextureUpdateRef.current = true;
        return;
      }
      invalidate();
    };
    window.addEventListener("terminal-texture-updated", handleTextureUpdate);
    return () => {
      window.removeEventListener(
        "terminal-texture-updated",
        handleTextureUpdate,
      );
    };
  }, [active, interactionActive, invalidate]);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (!interactionActive && pendingTextureUpdateRef.current) {
      pendingTextureUpdateRef.current = false;
      invalidate();
    }
  }, [active, interactionActive, invalidate]);

  useEffect(() => {
    if (active) {
      invalidate();
    }
  }, [active, invalidate]);

  useFrame(({ camera }) => {
    if (!active) {
      return;
    }
    const now = performance.now();
    const lastFrame = lastFrameTimeRef.current || now;
    const dt = Math.max(8, now - lastFrame);
    lastFrameTimeRef.current = now;
    const rawScroll = scrollProgressRef.current;
    const rawDelta = rawScroll - lastRawScrollRef.current;
    lastRawScrollRef.current = rawScroll;
    const speed = Math.abs(rawDelta) / dt;
    scrollVelocityRef.current = speed;
    const speedNorm = Math.min(1, speed * 160);
    const tau = 90 + speedNorm * 200;
    const alpha = 1 - Math.exp(-dt / tau);
    const delta = rawScroll - smoothScrollRef.current;
    const maxStep = 0.08 - speedNorm * 0.04;
    const step = Math.max(-maxStep, Math.min(maxStep, delta));
    if (speedNorm > 0.6 || Math.abs(delta) > 0.12) {
      smoothScrollRef.current = rawScroll;
    } else {
      smoothScrollRef.current += step * alpha;
    }
    const scroll = smoothScrollRef.current;
    const base = {
      x: isMobile ? 0 : 0.2,
      y: isMobile ? 0.6 : 0.9,
      z: isMobile ? 3.2 : 3.6,
      fov: isMobile ? 48 : 42,
    };

    if (groupRef.current) {
      groupRef.current.position.set(0, 0, 0);
      groupRef.current.rotation.set(0, 0, 0);
    }

    const zoom = scroll * scroll;
    const basePos = cameraDirRef.current.set(
      base.x,
      base.y - valMap(zoom, [0, 1], [0, 0.25]),
      base.z + valMap(zoom, [0, 1], [0, isMobile ? 2.4 : 3.2]),
    );
    const group = groupRef.current;
    const rig = cameraRigRef.current;
    let cameraSet = false;
    const screenMesh = screenTargetRef.current;
    let targetFov = base.fov;

    if (group && rig.start && rig.end) {
      group.updateWorldMatrix(true, true);
      rig.start.updateWorldMatrix(true, false);
      rig.end.updateWorldMatrix(true, false);

      rig.start.getWorldPosition(cameraStartPosRef.current);
      rig.end.getWorldPosition(cameraEndPosRef.current);
      rig.start.getWorldQuaternion(cameraStartQuatRef.current);
      rig.end.getWorldQuaternion(cameraEndQuatRef.current);

      const tRaw = Math.min(1, Math.max(0, scroll));
      const t = tRaw * tRaw * (3 - 2 * tRaw);
      const blendedPos = cameraDesiredRef.current
        .copy(cameraStartPosRef.current)
        .lerp(cameraEndPosRef.current, t);
      cameraBlendQuatRef.current
        .copy(cameraStartQuatRef.current)
        .slerp(cameraEndQuatRef.current, t);

      camera.position.copy(blendedPos);
      camera.quaternion.copy(cameraBlendQuatRef.current);
      if (camera instanceof PerspectiveCamera) {
        const startFov =
          rig.start instanceof PerspectiveCamera ? rig.start.fov : base.fov;
        const endFov =
          rig.end instanceof PerspectiveCamera ? rig.end.fov : base.fov;
        targetFov = startFov + (endFov - startFov) * t;
      }
      cameraSet = true;
    } else if (
      !cameraSet &&
      screenMesh &&
      camera instanceof PerspectiveCamera
    ) {
      cameraTempRef.current.copy(basePos).sub(screenCenterRef.current);
      if (screenNormalRef.current.dot(cameraTempRef.current) < 0) {
        screenNormalRef.current.multiplyScalar(-1);
      }

      const halfH = screenSizeRef.current.y * 0.5;
      const halfW = screenSizeRef.current.x * 0.5;
      const fovRad = (base.fov * Math.PI) / 180;
      const distY = halfH / Math.tan(fovRad / 2);
      const distX = halfW / (Math.tan(fovRad / 2) * camera.aspect);
      const distance = Math.max(distX, distY) * 1.25;

      cameraDesiredRef.current
        .copy(screenCenterRef.current)
        .add(screenNormalRef.current.multiplyScalar(distance));
      camera.position.copy(cameraDesiredRef.current);
      camera.lookAt(screenCenterRef.current);
      cameraSet = true;
      targetFov = base.fov;
    } else if (!cameraSet && group) {
      const focus = screenFocusRef.current;
      const scaled = focusWorldRef.current
        .copy(focus)
        .multiplyScalar(group.scale.x)
        .applyEuler(group.rotation)
        .add(group.position);
      const minDistance = Math.max(1.6, 1.3 * (isMobile ? 1.6 : 2));
      const dir = cameraDirRef.current.subVectors(basePos, scaled);
      if (dir.length() < minDistance) {
        if (dir.length() < 0.001) {
          dir.set(0, 0, 1);
        }
        dir.normalize().multiplyScalar(minDistance);
        basePos.copy(scaled).add(dir);
      }
      camera.position.copy(basePos);
      camera.lookAt(scaled);
      cameraSet = true;
    } else if (!cameraSet) {
      const focus = screenFocusRef.current;
      camera.position.copy(basePos);
      camera.lookAt(focus);
    }
    if (camera instanceof PerspectiveCamera) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    if (allowPointerParallax) {
      const inHeroZone = scroll < 0.65;
      const parallaxDamp = Math.max(0, 1 - Math.min(1, speedNorm * 1.2));
      const allowParallax = inHeroZone && parallaxDamp > 0.15;
      if (!allowParallax) {
        parallax.current.lerp(parallaxZeroRef.current, 0.12);
      }
      if (allowParallax) {
        const offsetX = parallax.current.x * 0.12 * parallaxDamp;
        const offsetY = parallax.current.y * 0.08 * parallaxDamp;
        if (offsetX !== 0 || offsetY !== 0) {
          camera.getWorldDirection(cameraForwardRef.current).normalize();
          cameraRightRef.current
            .copy(camera.up)
            .cross(cameraForwardRef.current)
            .normalize();
          cameraUpRef.current.copy(camera.up).normalize();
          camera.position
            .addScaledVector(cameraRightRef.current, offsetX)
            .addScaledVector(cameraUpRef.current, offsetY);
        }
      }
    }

    const palette = bgPaletteRef.current;
    const tRaw = Math.min(1, Math.max(0, scrollProgressRef.current));
    const t = tRaw * tRaw * (3 - 2 * tRaw);
    const blended = blendColor(palette.start, palette.end, t);
    const nextColor = formatRgb(blended);
    if (nextColor !== lastBgRef.current) {
      lastBgRef.current = nextColor;
      setBgColor(nextColor);
    }

    if (contentReadyRef.current && !frameReadyRef.current) {
      frameReadyRef.current = true;
      onReadyAction?.();
    }
  });

  const lights = DEFAULT_LIGHTS;
  const lightingActive = active && enhancedLighting && !performanceMode;
  const shadowsEnabled = lightingActive && !isFirefox;
  const shadowMapSize = performanceMode
    ? 256
    : lowPower
      ? 256
      : isMobile
        ? 512
        : 1024;
  const maxTextureSize = gl.capabilities.maxTextureSize || 1024;
  const noteTextureSize = Math.min(
    lowPower ? (isMobile ? 256 : 384) : isMobile ? 320 : 512,
    maxTextureSize,
  );
  const noteFontScale = isFirefox ? 1.18 : lowPower ? 0.95 : 1;
  const minimalLighting = performanceMode || isFirefox;

  return (
    <>
      <ambientLight
        intensity={isMobile ? lights.ambient * 1.45 : lights.ambient * 1.35}
      />
      <hemisphereLight
        args={[
          "#f4e1c1",
          "#c06621",
          isMobile ? lights.hemi * 1.2 : lights.hemi * 1.35,
        ]}
      />
      <directionalLight
        position={[5, 7, 4]}
        intensity={
          isMobile ? lights.directional * 1.2 : lights.directional * 1.4
        }
        castShadow={shadowsEnabled}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-bias={-0.00015}
      />
      {!minimalLighting ? (
        <directionalLight
          position={[-6, 3, 5]}
          intensity={isMobile ? 0.4 : 0.55}
          castShadow={false}
        />
      ) : null}
      {!minimalLighting ? (
        <directionalLight
          position={[-4, 3, -2]}
          intensity={isMobile ? 0.35 : 0.45}
          castShadow={false}
        />
      ) : null}
      {!minimalLighting ? (
        <spotLight
          position={[-3, 4, 2]}
          intensity={isMobile ? lights.spotA * 0.85 : lights.spotA * 0.95}
          angle={0.45}
          penumbra={0.4}
        />
      ) : null}
      {!minimalLighting ? (
        <spotLight
          position={[2, -2, 2]}
          intensity={isMobile ? lights.spotB * 0.75 : lights.spotB * 0.9}
          angle={0.35}
        />
      ) : null}
      <group
        ref={groupRef}
        castShadow={shadowsEnabled}
        receiveShadow={shadowsEnabled}>
        <SceneErrorBoundary
          key={modelAttempt}
          fallback={
            <PlaceholderComputer
              terminalApi={terminalApi}
              allowTerminalTexture={true}
              lowPower={lowPower}
            />
          }
          onError={handleModelError}>
          <Suspense
            fallback={
              <PlaceholderComputer
                terminalApi={terminalApi}
                allowTerminalTexture={true}
                lowPower={lowPower}
              />
            }>
            <ComputerModel
              terminalApi={terminalApi}
              noteTexts={noteTexts}
              noteTextureSize={noteTextureSize}
              noteFontScale={noteFontScale}
              onDebugAction={onDebugAction}
              onScreenAspectAction={onScreenAspectAction}
              onScreenFocus={handleScreenFocus}
              onScreenMeshAction={handleScreenMesh}
              onCameraRig={handleCameraRig}
              onContentReady={handleContentReady}
              usePhoneRig={usePhoneRig}
              shadowsEnabled={shadowsEnabled}
              allowTerminalTexture={true}
              active={active}
              lowPower={lowPower}
              showNotes={!lowPower && !performanceMode && !isMobile}
              setPlaneColor={bgColor}
            />
          </Suspense>
        </SceneErrorBoundary>
      </group>
      {envReady && lightingActive && !minimalLighting && !isMobile ? (
        <Environment preset="warehouse" />
      ) : null}
    </>
  );
}

export default function HeroScene(props: HeroSceneProps) {
  const isMobile = useMediaQuery("(max-width: 900px)");
  const isActive = props.active ?? true;
  const [lowPowerOverride, setLowPowerOverride] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [interactionActive, setInteractionActive] = useState(false);
  const contextLostRef = useRef(false);
  const lowPowerDisabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const url = new URL(window.location.href);
    const param = url.searchParams.get("lowPower")?.toLowerCase();
    const forceParam = url.searchParams.get("forceHigh")?.toLowerCase();
    const stored = window.localStorage.getItem("lowPower")?.toLowerCase();
    return (
      param === "off" ||
      param === "0" ||
      param === "false" ||
      forceParam === "1" ||
      stored === "off"
    );
  }, []);
  const isFirefox = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /firefox/i.test(navigator.userAgent);
  }, []);
  const baseLowPower = useMemo(() => {
    if (lowPowerDisabled) {
      return false;
    }
    if (typeof navigator === "undefined") {
      return false;
    }
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
    const cores =
      typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : 8;
    const saveData = Boolean(nav.connection?.saveData);
    const effectiveType = nav.connection?.effectiveType ?? "";
    const slowNetwork = /2g/.test(effectiveType);
    return isMobile || memory <= 4 || cores <= 4 || saveData || slowNetwork;
  }, [isMobile, lowPowerDisabled]);
  const lowPower = lowPowerOverride ? true : baseLowPower;
  const performanceMode = lowPower || interactionActive;
  const enhancedLighting = useMemo(
    () => !lowPower && !isFirefox,
    [lowPower, isFirefox],
  );
  const dpr = useMemo(() => {
    if (!isActive) {
      return [0.6, 0.8] as [number, number];
    }
    if (performanceMode || lowPower) {
      return isMobile
        ? ([0.55, 0.75] as [number, number])
        : ([0.6, 0.8] as [number, number]);
    }
    if (isMobile || isFirefox) {
      return [0.7, 0.9] as [number, number];
    }
    return [0.9, 1] as [number, number];
  }, [isActive, isFirefox, isMobile, lowPower, performanceMode]);
  useEffect(() => {
    const handleInteraction = (event: Event) => {
      const { detail } = event as CustomEvent<{ active?: boolean }>;
      if (!detail) {
        return;
      }
      setInteractionActive(Boolean(detail.active));
    };
    window.addEventListener(
      "hero-interaction",
      handleInteraction as EventListener,
    );
    return () => {
      window.removeEventListener(
        "hero-interaction",
        handleInteraction as EventListener,
      );
    };
  }, []);
  return (
    <Canvas
      key={canvasKey}
      frameloop={isActive ? "demand" : "never"}
      dpr={dpr}
      camera={{ position: [0.2, 0.8, 3.6], fov: 42 }}
      gl={{
        antialias: isActive && !isMobile && !performanceMode && !isFirefox,
        powerPreference:
          !isActive || performanceMode || isFirefox
            ? "low-power"
            : "high-performance",
        logarithmicDepthBuffer: !performanceMode && !lowPower,
        alpha: true,
      }}
      shadows={enhancedLighting && !isMobile && !performanceMode && !isFirefox}
      onCreated={({ gl }) => {
        const handleLost = (event: Event) => {
          event.preventDefault();
          if (contextLostRef.current) {
            return;
          }
          contextLostRef.current = true;
          setLowPowerOverride(true);
          setCanvasKey((value) => value + 1);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("hero-canvas-reset"));
          }
        };
        const handleRestored = () => {
          if (!contextLostRef.current) {
            return;
          }
          contextLostRef.current = false;
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("hero-canvas-reset"));
          }
        };
        gl.domElement.addEventListener("webglcontextlost", handleLost, false);
        gl.domElement.addEventListener(
          "webglcontextrestored",
          handleRestored,
          false,
        );
        gl.setClearColor(0x000000, 0);
        return () => {
          gl.domElement.removeEventListener(
            "webglcontextlost",
            handleLost,
            false,
          );
          gl.domElement.removeEventListener(
            "webglcontextrestored",
            handleRestored,
            false,
          );
        };
      }}
      style={{
        width: "100%",
        height: "100%",
        touchAction: "pan-y",
        pointerEvents: "none",
        background:
          "radial-gradient(circle at 20% 0%, rgba(var(--hero-accent-rgb), .08), transparent 55%), var(--content-bg)",
      }}>
      {isActive ? (
        <SceneContent
          {...props}
          active={isActive}
          lowPower={lowPower}
          performanceMode={performanceMode}
          enhancedLighting={enhancedLighting}
          interactionActive={interactionActive}
        />
      ) : null}
    </Canvas>
  );
}
