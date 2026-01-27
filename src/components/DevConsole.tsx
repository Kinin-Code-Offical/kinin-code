"use client";

import { useEffect, useMemo, useState } from "react";
import type { DevSettings } from "@/lib/devtools";
import type { SceneDebugInfo } from "@/components/hero/HeroScene";
import { defaultDevSettings } from "@/lib/devtools";

const STORAGE_KEY = "devtools";

export default function DevConsole({
  onChange,
  settings,
  debug,
}: {
  settings: DevSettings;
  onChange: (value: DevSettings) => void;
  debug?: SceneDebugInfo;
}) {
  const [open, setOpen] = useState(true);
  const containerClass = useMemo(
    () => `dev-console ${settings.console.position} ${open ? "open" : ""}`,
    [open, settings.console.position],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateCamera = (key: keyof DevSettings["camera"], value: number) => {
    onChange({ ...settings, camera: { ...settings.camera, [key]: value } });
  };

  const updateModel = (key: keyof DevSettings["model"], value: number) => {
    onChange({ ...settings, model: { ...settings.model, [key]: value } });
  };

  const updateLights = (key: keyof DevSettings["lights"], value: number) => {
    onChange({ ...settings, lights: { ...settings.lights, [key]: value } });
  };

  const updateConsole = (value: DevSettings["console"]["position"]) => {
    onChange({ ...settings, console: { position: value } });
  };

  return (
    <section className={containerClass}>
      <button className="dev-toggle" type="button" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Dev Panel ↓" : "Dev Panel ↑"}
      </button>
      <div className="dev-body">
        <div className="dev-section">
          <h4>Camera</h4>
          <label>
            X
            <input
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={settings.camera.x}
              onChange={(e) => updateCamera("x", Number(e.target.value))}
            />
          </label>
          <label>
            Y
            <input
              type="range"
              min={-1}
              max={3}
              step={0.05}
              value={settings.camera.y}
              onChange={(e) => updateCamera("y", Number(e.target.value))}
            />
          </label>
          <label>
            Z
            <input
              type="range"
              min={1}
              max={6}
              step={0.05}
              value={settings.camera.z}
              onChange={(e) => updateCamera("z", Number(e.target.value))}
            />
          </label>
          <label>
            FOV
            <input
              type="range"
              min={30}
              max={70}
              step={1}
              value={settings.camera.fov}
              onChange={(e) => updateCamera("fov", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="dev-section">
          <h4>Model</h4>
          <label>
            Scale
            <input
              type="range"
              min={0.6}
              max={2.5}
              step={0.05}
              value={settings.model.scale}
              onChange={(e) => updateModel("scale", Number(e.target.value))}
            />
          </label>
          <label>
            Rot X
            <input
              type="range"
              min={-3.14}
              max={3.14}
              step={0.05}
              value={settings.model.rotX}
              onChange={(e) => updateModel("rotX", Number(e.target.value))}
            />
          </label>
          <label>
            Rot Y
            <input
              type="range"
              min={-3.14}
              max={3.14}
              step={0.05}
              value={settings.model.rotY}
              onChange={(e) => updateModel("rotY", Number(e.target.value))}
            />
          </label>
          <label>
            Rot Z
            <input
              type="range"
              min={-3.14}
              max={3.14}
              step={0.05}
              value={settings.model.rotZ}
              onChange={(e) => updateModel("rotZ", Number(e.target.value))}
            />
          </label>
          <label>
            Pos X
            <input
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={settings.model.posX}
              onChange={(e) => updateModel("posX", Number(e.target.value))}
            />
          </label>
          <label>
            Pos Y
            <input
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={settings.model.posY}
              onChange={(e) => updateModel("posY", Number(e.target.value))}
            />
          </label>
          <label>
            Pos Z
            <input
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={settings.model.posZ}
              onChange={(e) => updateModel("posZ", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="dev-section">
          <h4>Lights</h4>
          <label>
            Ambient
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={settings.lights.ambient}
              onChange={(e) => updateLights("ambient", Number(e.target.value))}
            />
          </label>
          <label>
            Hemisphere
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={settings.lights.hemi}
              onChange={(e) => updateLights("hemi", Number(e.target.value))}
            />
          </label>
          <label>
            Directional
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={settings.lights.directional}
              onChange={(e) => updateLights("directional", Number(e.target.value))}
            />
          </label>
          <label>
            Spot A
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={settings.lights.spotA}
              onChange={(e) => updateLights("spotA", Number(e.target.value))}
            />
          </label>
          <label>
            Spot B
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={settings.lights.spotB}
              onChange={(e) => updateLights("spotB", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="dev-section">
          <h4>Panel</h4>
          <div className="dev-positions">
            {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                className={settings.console.position === pos ? "active" : ""}
                onClick={() => updateConsole(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dev-reset"
            onClick={() => onChange(defaultDevSettings)}
          >
            Reset to default
          </button>
        </div>

        {debug ? (
          <div className="dev-section">
            <h4>Screen Mesh</h4>
            <p className="dev-text">
              {debug.screenMeshName
                ? `Selected: ${debug.screenMeshName}`
                : "Fallback plane active"}
            </p>
            <div className="dev-list">
              {debug.meshNames.length ? (
                debug.meshNames.map((name) => (
                  <span key={name}>{name || "(unnamed)"}</span>
                ))
              ) : (
                <span>No meshes yet</span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
