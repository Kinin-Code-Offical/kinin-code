export type DevSettings = {
  camera: {
    x: number;
    y: number;
    z: number;
    fov: number;
  };
  model: {
    scale: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    posX: number;
    posY: number;
    posZ: number;
  };
  lights: {
    ambient: number;
    hemi: number;
    directional: number;
    spotA: number;
    spotB: number;
  };
  console: {
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  };
};

export const defaultDevSettings: DevSettings = {
  camera: {
    x: 0.2,
    y: 0.9,
    z: 3.6,
    fov: 42,
  },
  model: {
    scale: 1.35,
    rotX: 0.2,
    rotY: -0.4,
    rotZ: 0,
    posX: 0,
    posY: 0,
    posZ: 0,
  },
  lights: {
    ambient: 0.45,
    hemi: 0.45,
    directional: 1.1,
    spotA: 0.8,
    spotB: 0.35,
  },
  console: {
    position: "top-right",
  },
};
