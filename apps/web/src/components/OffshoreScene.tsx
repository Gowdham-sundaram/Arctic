import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { assetHealthStatuses, assetTypes, type AssetRecord } from "@arctic/contracts";
import { buildOffshorePlatform } from "./offshore-platform";

interface OffshoreSceneProps {
  assets: AssetRecord[];
  onSelectAsset: (assetId: string) => void;
}

type CameraView = "isometric" | "top" | "side";
type AssetTypeFilter = "ALL" | AssetRecord["type"];
type AssetHealthFilter = "ALL" | AssetRecord["health"];
interface HoveredMarker {
  assetId: string;
  x: number;
  y: number;
}

const healthLabels: Record<AssetRecord["health"], string> = {
  HEALTHY: "Healthy",
  ATTENTION: "Attention",
  CRITICAL: "Critical",
  UNKNOWN: "Unknown",
};

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const healthColors: Record<AssetRecord["health"], number> = {
  HEALTHY: 0x43d6a0,
  ATTENTION: 0xf2b85f,
  CRITICAL: 0xff7777,
  UNKNOWN: 0x68b8d0,
};

function applyCameraView(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  view: CameraView,
): void {
  const positions: Record<CameraView, [number, number, number]> = {
    isometric: [12, 15, 16],
    top: [0, 21, 0.01],
    side: [19, 11, 0],
  };
  const target = new THREE.Vector3(0, 4.35, 0);
  const aspectScale = Math.min(1.35, Math.max(0.9, 1.55 / camera.aspect));
  camera.up.set(0, view === "top" ? 0 : 1, view === "top" ? -1 : 0);
  camera.position
    .set(...positions[view])
    .sub(target)
    .multiplyScalar(aspectScale)
    .add(target);
  controls.target.copy(target);
  controls.update();
}

function markerLabel(
  number: number,
  color: number,
  position: THREE.Vector3,
): THREE.Sprite | null {
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 80;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.beginPath();
  context.arc(40, 40, 34, 0, Math.PI * 2);
  context.fillStyle = "rgba(5, 20, 32, 0.96)";
  context.fill();
  context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = "#e7f6fa";
  context.font = "700 29px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number).padStart(2, "0"), 40, 41);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  sprite.scale.set(0.34, 0.34, 1);
  sprite.position.copy(position).add(new THREE.Vector3(0.26, 0.28, 0));
  sprite.renderOrder = 10;
  return sprite;
}

function locationAnchor(location: string): [number, number, number] {
  const value = location.toLowerCase();
  const deckNumber = Number(value.match(/\bdeck\s+(\d+)\b/)?.[1] ?? 2);
  const deckHeight = Math.min(5.2, 3.78 + (deckNumber - 1) * 0.48);

  if (value.includes("helideck")) return [2.75, 5.98, 1.68];
  if (value.includes("north") && value.includes("route")) return [0, 0.25, -7.5];
  if (value.includes("north") && value.includes("subsea")) return [0, 0.45, -5.8];
  if (value.includes("south") && value.includes("subsea")) return [0, 0.45, 5.8];
  if (value.includes("west anchor")) return [-7.2, 0.12, 4.2];
  if (value.includes("west export corridor")) return [-6.6, 0.35, 1.4];
  if (value.includes("east jacket")) return [3.15, 1.85, 1.25];
  if (value.includes("jacket leg")) return [-3.05, 1.25, -1.9];
  if (value.includes("jacket southeast")) return [3.05, 0.65, 1.95];
  if (value.includes("export riser base")) return [-3.1, 3.3, 1.1];
  if (value.includes("riser guide")) return [3.1, deckHeight, 0.9];
  if (value.includes("west side") || value.includes("port side"))
    return [-3.15, deckHeight, 0.25];
  if (value.includes("starboard")) return [3.15, deckHeight, 0.25];
  if (value.includes("utilities module")) return [-1.8, deckHeight, -0.65];
  if (value.includes("compression module")) return [1.75, deckHeight, -0.7];
  if (value.includes("process module")) return [0.35, deckHeight, 0.55];
  if (value.includes("electrical room")) return [-2.15, deckHeight, 0.85];
  if (value.includes("firewater module")) return [2.15, deckHeight, 0.75];
  if (value.includes("water treatment module")) return [2.3, deckHeight, -0.1];
  if (value.includes("chemical injection")) return [1.45, deckHeight, 1.15];
  if (value.includes("export line deck")) return [-3.15, deckHeight, 0.9];
  if (value.includes("central deck")) return [0, 5.2, 0];
  if (value.includes("offshore field")) return [-0.45, 5.55, -1.2];
  return [0, deckHeight, 0];
}

function markerPosition(
  asset: AssetRecord,
  positionIndex: number,
  positionCount: number,
): THREE.Vector3 {
  const [x, y, z] = locationAnchor(asset.location);
  const columns = Math.ceil(Math.sqrt(positionCount));
  const rows = Math.ceil(positionCount / columns);
  const spacing = positionCount > 1 ? 0.42 : 0;
  const column = positionIndex % columns;
  const row = Math.floor(positionIndex / columns);
  return new THREE.Vector3(
    x + (column - (columns - 1) / 2) * spacing,
    y,
    z + (row - (rows - 1) / 2) * spacing,
  );
}

function addMarker(
  parent: THREE.Group,
  asset: AssetRecord,
  number: number,
  position: THREE.Vector3,
  targets: THREE.Object3D[],
): void {
  const color = healthColors[asset.health];
  const material = new THREE.MeshBasicMaterial({ color });
  const stem = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(position.x, position.y - 0.45, position.z),
      position,
    ]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
  parent.add(stem);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 20, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  halo.position.copy(position);
  parent.add(halo);

  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), material);
  dot.position.copy(position);
  parent.add(dot);

  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitTarget.position.copy(position);
  hitTarget.userData.assetId = asset.id;
  parent.add(hitTarget);
  targets.push(hitTarget);

  const label = markerLabel(number, color, position);
  if (label) parent.add(label);
}

function buildProbeNetwork(scene: THREE.Scene): THREE.Group {
  const network = new THREE.Group();
  const probes = [
    { position: [-3.7, 3.65, 2.55], color: 0x47d7ee },
    { position: [-3.7, 1.55, 2.55], color: 0xf2a64a },
    { position: [-3.7, 0.35, 2.55], color: 0x47d7ee },
    { position: [-5.0, 0.25, 3.65], color: 0xf2a64a },
    { position: [3.7, 3.65, 2.55], color: 0x47d7ee },
    { position: [3.7, 1.55, 2.55], color: 0xf2a64a },
    { position: [3.7, 0.35, 2.55], color: 0x47d7ee },
    { position: [5.0, 0.25, 3.65], color: 0xf2a64a },
    { position: [-3.7, 2.4, -2.55], color: 0x47d7ee },
    { position: [-3.7, 0.35, -2.55], color: 0xf2a64a },
    { position: [-5.0, 0.25, -3.65], color: 0x47d7ee },
    { position: [3.7, 2.4, -2.55], color: 0x47d7ee },
    { position: [3.7, 0.35, -2.55], color: 0xf2a64a },
    { position: [5.0, 0.25, -3.65], color: 0xf2a64a },
    { position: [-1.6, 0.22, 4.2], color: 0xf2a64a },
    { position: [0, 0.22, 4.5], color: 0x47d7ee },
    { position: [1.6, 0.22, 4.2], color: 0xf2a64a },
  ] as const;
  const wireMaterial = new THREE.LineDashedMaterial({
    color: 0x36b5d0,
    transparent: true,
    opacity: 0.72,
    dashSize: 0.18,
    gapSize: 0.12,
  });
  const paths = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10],
    [11, 12, 13],
    [3, 14, 15, 16, 7],
  ];
  for (const path of paths) {
    for (let index = 0; index < path.length - 1; index += 1) {
      const start = probes[path[index]!]!;
      const end = probes[path[index + 1]!]!;
      const wire = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...start.position),
          new THREE.Vector3(...end.position),
        ]),
        wireMaterial,
      );
      wire.computeLineDistances();
      network.add(wire);
    }
  }

  for (const probe of probes) {
    const position = new THREE.Vector3(...probe.position);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8),
      new THREE.MeshBasicMaterial({
        color: probe.color,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      }),
    );
    halo.position.copy(position);
    network.add(halo);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 10),
      new THREE.MeshBasicMaterial({ color: probe.color }),
    );
    marker.position.copy(position);
    network.add(marker);
  }

  scene.add(network);
  return network;
}

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Sprite) {
      object.material.map?.dispose();
      object.material.dispose();
      return;
    }
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      material.map?.dispose();
      material.dispose();
    }
  });
}

export function OffshoreScene({ assets, onSelectAsset }: OffshoreSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>("isometric");
  const [panMode, setPanMode] = useState(false);
  const [showAssetMarkers, setShowAssetMarkers] = useState(true);
  const [showProbeNetwork, setShowProbeNetwork] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<HoveredMarker | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("ALL");
  const [healthFilter, setHealthFilter] = useState<AssetHealthFilter>("ALL");
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const probeNetworkRef = useRef<THREE.Group | null>(null);
  const cameraViewRef = useRef<CameraView>("isometric");
  const markersVisibleRef = useRef(true);
  const probeNetworkVisibleRef = useRef(true);
  const sortedAssets = useMemo(
    () =>
      [...assets].sort((left, right) => left.assetCode.localeCompare(right.assetCode)),
    [assets],
  );
  const markerNumbers = useMemo(
    () => new Map(sortedAssets.map((asset, index) => [asset.id, index + 1])),
    [sortedAssets],
  );
  const visibleAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    return sortedAssets.filter((asset) => {
      const matchesType = typeFilter === "ALL" || asset.type === typeFilter;
      const matchesHealth = healthFilter === "ALL" || asset.health === healthFilter;
      const matchesSearch =
        !query ||
        `${asset.assetCode} ${asset.name} ${asset.location}`
          .toLowerCase()
          .includes(query);
      return matchesType && matchesHealth && matchesSearch;
    });
  }, [assetSearch, healthFilter, sortedAssets, typeFilter]);
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
  const selectedParent = selectedAsset?.parentId
    ? assets.find((asset) => asset.id === selectedAsset.parentId)
    : undefined;
  const selectedChildren = selectedAsset
    ? assets.filter((asset) => asset.parentId === selectedAsset.id)
    : [];
  const selectedCoordinates =
    selectedAsset?.latitude !== null &&
    selectedAsset?.latitude !== undefined &&
    selectedAsset.longitude !== null
      ? `${selectedAsset.latitude}, ${selectedAsset.longitude}`
      : "Not recorded";
  const hoveredAsset = visibleAssets.find((asset) => asset.id === hoveredAssetId);
  const hoverTooltipPosition = hoveredMarker
    ? {
        left: Math.max(
          8,
          Math.min(hoveredMarker.x + 12, (containerRef.current?.clientWidth ?? 0) - 190),
        ),
        top: Math.max(
          34,
          Math.min(hoveredMarker.y, (containerRef.current?.clientHeight ?? 0) - 38),
        ),
      }
    : null;

  const chooseCameraView = (view: CameraView) => {
    cameraViewRef.current = view;
    setCameraView(view);
  };

  const cycleCameraView = () => {
    const views: CameraView[] = ["isometric", "top", "side"];
    const currentIndex = views.indexOf(cameraViewRef.current);
    chooseCameraView(views[(currentIndex + 1) % views.length]!);
    setResetKey((current) => current + 1);
  };

  const resetView = () => {
    chooseCameraView("isometric");
    setResetKey((current) => current + 1);
    setPanMode(false);
    setHoveredAssetId(null);
    setHoveredMarker(null);
  };

  const clearAssetFilters = () => {
    setAssetSearch("");
    setTypeFilter("ALL");
    setHealthFilter("ALL");
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 70);
    camera.aspect =
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let observer: ResizeObserver | undefined;
    const hitTargets: THREE.Object3D[] = [];
    let pointerStart: { x: number; y: number } | null = null;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x071624, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = "offshore-canvas";
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive offshore platform model. Left-drag rotates, right-drag pans, and the mouse wheel zooms toward the pointer. Pan mode lets left-drag move the view. Click a marker for asset details.",
      );
      container.appendChild(renderer.domElement);
      setSceneError(null);

      const ambient = new THREE.AmbientLight(0x8bd8e8, 1.8);
      const keyLight = new THREE.DirectionalLight(0xb8f1ff, 2.2);
      keyLight.position.set(8, 12, 6);
      scene.add(ambient, keyLight);
      buildOffshorePlatform(scene);
      const probeNetwork = buildProbeNetwork(scene);
      probeNetwork.visible = probeNetworkVisibleRef.current;
      probeNetworkRef.current = probeNetwork;

      const markerGroup = new THREE.Group();
      markerGroup.visible = markersVisibleRef.current;
      const assetsByLocation = new Map<string, AssetRecord[]>();
      for (const asset of sortedAssets) {
        const key = asset.location.trim().toLowerCase();
        const group = assetsByLocation.get(key) ?? [];
        group.push(asset);
        assetsByLocation.set(key, group);
      }
      visibleAssets.forEach((asset) => {
        const group = assetsByLocation
          .get(asset.location.trim().toLowerCase())
          ?.sort((left, right) => left.assetCode.localeCompare(right.assetCode)) ?? [
          asset,
        ];
        const positionIndex = group.findIndex((member) => member.id === asset.id);
        addMarker(
          markerGroup,
          asset,
          markerNumbers.get(asset.id) ?? 0,
          markerPosition(asset, positionIndex, group.length),
          hitTargets,
        );
      });
      markerGroupRef.current = markerGroup;
      scene.add(markerGroup);

      controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.target.set(0, 4.1, 0);
      controls.enableDamping = false;
      controls.enablePan = true;
      controls.zoomToCursor = true;
      controls.minDistance = 4.5;
      controls.maxDistance = 32;
      controls.maxPolarAngle = Math.PI * 0.48;
      applyCameraView(camera, controls, cameraViewRef.current);
      controls.update();

      const render = () => {
        if (!renderer) return;
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
      };
      controls.addEventListener("change", render);

      observer = new ResizeObserver(render);
      observer.observe(container);
      render();

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onPointerDown = (event: PointerEvent) => {
        pointerStart = { x: event.clientX, y: event.clientY };
      };
      const onPointerUp = (event: PointerEvent) => {
        if (
          event.button !== 0 ||
          !pointerStart ||
          Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5
        ) {
          pointerStart = null;
          return;
        }
        pointerStart = null;
        if (!markerGroupRef.current?.visible) return;
        const bounds = renderer!.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const target = raycaster.intersectObjects(hitTargets, false)[0]?.object;
        if (typeof target?.userData.assetId === "string") {
          setSelectedAssetId(target.userData.assetId);
          setShowFilters(false);
          setHoveredAssetId(null);
          setHoveredMarker(null);
        }
      };
      const onPointerMove = (event: PointerEvent) => {
        if (
          pointerStart &&
          Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5
        ) {
          setHoveredAssetId(null);
          setHoveredMarker(null);
          renderer!.domElement.style.cursor = "";
          return;
        }
        if (!markerGroupRef.current?.visible) {
          setHoveredAssetId(null);
          setHoveredMarker(null);
          renderer!.domElement.style.cursor = "";
          return;
        }

        const bounds = renderer!.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const target = raycaster.intersectObjects(hitTargets, false)[0]?.object;
        const assetId =
          typeof target?.userData.assetId === "string" ? target.userData.assetId : null;
        const asset = assetId
          ? visibleAssets.find((record) => record.id === assetId)
          : undefined;
        if (!target || !asset) {
          setHoveredAssetId(null);
          setHoveredMarker(null);
          renderer!.domElement.style.cursor = "";
          return;
        }

        const screenPosition = target
          .getWorldPosition(new THREE.Vector3())
          .project(camera);
        const x = ((screenPosition.x + 1) / 2) * bounds.width;
        const y = ((1 - screenPosition.y) / 2) * bounds.height;
        setHoveredAssetId(asset.id);
        setHoveredMarker((current) =>
          current?.assetId === asset.id &&
          Math.abs(current.x - x) < 1 &&
          Math.abs(current.y - y) < 1
            ? current
            : { assetId: asset.id, x, y },
        );
        renderer!.domElement.style.cursor = "pointer";
      };
      const onPointerLeave = () => {
        pointerStart = null;
        setHoveredAssetId(null);
        setHoveredMarker(null);
        renderer!.domElement.style.cursor = "";
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerleave", onPointerLeave);

      return () => {
        renderer?.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer?.domElement.removeEventListener("pointerup", onPointerUp);
        renderer?.domElement.removeEventListener("pointermove", onPointerMove);
        renderer?.domElement.removeEventListener("pointerleave", onPointerLeave);
        observer?.disconnect();
        controls?.dispose();
        controlsRef.current = null;
        cameraRef.current = null;
        markerGroupRef.current = null;
        probeNetworkRef.current = null;
        disposeScene(scene);
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    } catch (error) {
      setSceneError(
        error instanceof Error
          ? `Interactive 3D view could not be initialized: ${error.message}`
          : "Interactive 3D view could not be initialized in this browser.",
      );
      renderer?.dispose();
      renderer?.domElement.remove();
      return () => {
        observer?.disconnect();
        controls?.dispose();
        controlsRef.current = null;
        cameraRef.current = null;
        markerGroupRef.current = null;
        probeNetworkRef.current = null;
        disposeScene(scene);
      };
    }
  }, [assets, markerNumbers, onSelectAsset, sortedAssets, visibleAssets]);

  useEffect(() => {
    if (cameraRef.current && controlsRef.current) {
      applyCameraView(cameraRef.current, controlsRef.current, cameraView);
    }
  }, [cameraView, resetKey]);

  useEffect(() => {
    if (markerGroupRef.current) markerGroupRef.current.visible = showAssetMarkers;
    markersVisibleRef.current = showAssetMarkers;
    if (!showAssetMarkers) {
      setHoveredAssetId(null);
      setHoveredMarker(null);
    }
  }, [showAssetMarkers]);

  useEffect(() => {
    if (probeNetworkRef.current) probeNetworkRef.current.visible = showProbeNetwork;
    probeNetworkVisibleRef.current = showProbeNetwork;
  }, [showProbeNetwork]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.mouseButtons.LEFT = panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    containerRef.current
      ?.querySelector("canvas")
      ?.classList.toggle("offshore-canvas-pan-mode", panMode);
  }, [panMode]);

  useEffect(() => {
    if (selectedAssetId && !visibleAssets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(null);
    }
    if (hoveredAssetId && !visibleAssets.some((asset) => asset.id === hoveredAssetId)) {
      setHoveredAssetId(null);
      setHoveredMarker(null);
    }
  }, [hoveredAssetId, selectedAssetId, visibleAssets]);

  return (
    <div
      className={`scene-wrap${expanded ? " scene-wrap-expanded" : ""}`}
      role={expanded ? "region" : undefined}
      aria-label={expanded ? "Expanded offshore platform 3D model" : undefined}
    >
      <div className="scene-canvas-host" ref={containerRef} />
      {sceneError && (
        <div className="scene-error" role="alert">
          {sceneError}
        </div>
      )}
      <div className="scene-asset-count" role="status">
        <strong>{visibleAssets.length}</strong>
        <span>of {assets.length} total assets</span>
        <small>Approximate placement from location text</small>
      </div>
      <p className="scene-navigation-help">
        <strong>Navigate:</strong> wheel zooms to pointer ·{" "}
        {panMode
          ? "left-drag pans · right-drag rotates"
          : "right-drag pans · left-drag rotates"}
      </p>
      {hoveredAsset &&
        hoveredMarker &&
        hoverTooltipPosition &&
        !selectedAsset &&
        !showFilters && (
          <div
            className="scene-hover-label"
            style={{ left: hoverTooltipPosition.left, top: hoverTooltipPosition.top }}
            aria-hidden="true"
          >
            <strong>
              {String(markerNumbers.get(hoveredAsset.id) ?? 0).padStart(2, "0")} ·{" "}
              {hoveredAsset.assetCode}
            </strong>
            <span>{hoveredAsset.name}</span>
            <small>Click for details</small>
          </div>
        )}
      {showFilters && (
        <aside
          id="scene-filter-panel"
          className="scene-filter-panel"
          aria-label="Filter offshore assets"
        >
          <div className="scene-filter-heading">
            <div>
              <span>ASSET EXPLORER</span>
              <h3>Filter assets</h3>
            </div>
            <button
              type="button"
              className="scene-asset-close"
              aria-label="Close asset filters"
              onClick={() => setShowFilters(false)}
            >
              ×
            </button>
          </div>
          <label className="scene-filter-field">
            <span>Search assets</span>
            <input
              type="search"
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.currentTarget.value)}
              placeholder="Code, name, or location"
            />
          </label>
          <div className="scene-filter-selects">
            <label className="scene-filter-field">
              <span>Asset type</span>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(
                    assetTypes.find((type) => type === event.currentTarget.value) ??
                      "ALL",
                  );
                }}
              >
                <option value="ALL">All types</option>
                {assetTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="scene-filter-field">
              <span>Condition</span>
              <select
                value={healthFilter}
                onChange={(event) => {
                  setHealthFilter(
                    assetHealthStatuses.find(
                      (status) => status === event.currentTarget.value,
                    ) ?? "ALL",
                  );
                }}
              >
                <option value="ALL">All conditions</option>
                {assetHealthStatuses.map((status) => (
                  <option key={status} value={status}>
                    {healthLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="scene-filter-results-heading">
            <span>Matching assets</span>
            <strong>{visibleAssets.length}</strong>
          </div>
          <div className="scene-filter-results">
            {visibleAssets.length ? (
              visibleAssets.map((asset) => (
                <button
                  type="button"
                  className="scene-filter-result"
                  key={asset.id}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setShowFilters(false);
                  }}
                >
                  <span className="scene-filter-number">
                    {String(markerNumbers.get(asset.id) ?? 0).padStart(2, "0")}
                  </span>
                  <span className="scene-filter-result-text">
                    <strong>{asset.assetCode}</strong>
                    <small>{asset.name}</small>
                  </span>
                  <i
                    className={`scene-filter-health health-${asset.health.toLowerCase()}`}
                  />
                </button>
              ))
            ) : (
              <p className="scene-filter-empty">No assets match these filters.</p>
            )}
          </div>
          <button
            type="button"
            className="scene-filter-clear"
            onClick={clearAssetFilters}
          >
            Clear filters
          </button>
        </aside>
      )}
      {selectedAsset && (
        <aside
          className="scene-asset-details"
          aria-label={`${selectedAsset.assetCode} asset details`}
        >
          <div className="scene-asset-details-heading">
            <div>
              <span className="scene-asset-code">{selectedAsset.assetCode}</span>
              <h3>{selectedAsset.name}</h3>
            </div>
            <button
              type="button"
              className="scene-asset-close"
              aria-label="Close asset details"
              onClick={() => setSelectedAssetId(null)}
            >
              ×
            </button>
          </div>
          <div className="scene-asset-badges">
            <span className={`health-badge health-${selectedAsset.health.toLowerCase()}`}>
              {selectedAsset.health}
            </span>
            <span>{selectedAsset.status}</span>
            <span>{selectedAsset.criticality} criticality</span>
          </div>
          <dl className="scene-asset-detail-list">
            <div>
              <dt>Type</dt>
              <dd>{selectedAsset.type.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{selectedAsset.location}</dd>
            </div>
            <div>
              <dt>Offshore field</dt>
              <dd>{selectedAsset.offshoreField ?? "Not specified"}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>{selectedCoordinates}</dd>
            </div>
            <div>
              <dt>Parent asset</dt>
              <dd>
                {selectedParent?.assetCode ?? selectedAsset.parentId ?? "None recorded"}
              </dd>
            </div>
            <div>
              <dt>Child assets</dt>
              <dd>
                {selectedChildren.length
                  ? selectedChildren.map((asset) => asset.assetCode).join(", ")
                  : "None recorded"}
              </dd>
            </div>
            <div>
              <dt>Installation date</dt>
              <dd>{selectedAsset.installationDate?.slice(0, 10) ?? "Not specified"}</dd>
            </div>
            <div>
              <dt>Manufacturer</dt>
              <dd>{selectedAsset.manufacturer ?? "Not specified"}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{selectedAsset.model ?? "Not specified"}</dd>
            </div>
            <div>
              <dt>Serial number</dt>
              <dd>{selectedAsset.serialNumber ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{selectedAsset.description ?? "No description recorded"}</dd>
            </div>
            <div>
              <dt>Record ID</dt>
              <dd>{selectedAsset.id}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(selectedAsset.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{new Date(selectedAsset.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
          <p className="scene-placement-note">
            Model position is approximate, inferred from the location description. Add
            verified coordinates for exact placement.
          </p>
          <button
            type="button"
            className="scene-asset-open"
            onClick={() => onSelectAsset(selectedAsset.id)}
          >
            Open full asset record
          </button>
        </aside>
      )}
      <button
        type="button"
        className="scene-3d-button"
        aria-pressed={expanded}
        aria-label={expanded ? "Close 3D view" : "Open 3D view"}
        onClick={() => setExpanded((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v8.5" />
        </svg>
        {expanded ? "Close 3D View" : "3D View"}
      </button>
      <div className="scene-legend" aria-label="Corrosion protection model legend">
        <span>
          <i className="legend-dot legend-cp-reference" />
          <span>CP Reference Electrode</span>
        </span>
        <span>
          <i className="legend-dot legend-cp-anode" />
          <span>Anode</span>
        </span>
        <span>
          <i className="legend-structure-line" />
          <span>Structure Connection</span>
        </span>
      </div>
      <div className="scene-controls" role="group" aria-label="3D model controls">
        <button
          type="button"
          className={`scene-icon-button${cameraView === "isometric" ? " scene-icon-active" : ""}`}
          aria-label={`Camera view: ${cameraView}. Activate to cycle views.`}
          title="Cycle camera view"
          onClick={cycleCameraView}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 2.8 8.2 4.6v9.2L12 21.2l-8.2-4.6V7.4L12 2.8Z" />
            <path d="m3.8 7.4 8.2 4.7 8.2-4.7M12 12.1v9" />
          </svg>
        </button>
        <button
          type="button"
          className="scene-icon-button scene-labeled-control"
          aria-label="Reset camera to default view"
          title="Reset camera and pan mode"
          onClick={resetView}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 11a9 9 0 1 1 2.64 6.36M3 11V5m0 6h6" />
          </svg>
          <span>Reset</span>
        </button>
        <button
          type="button"
          className={`scene-icon-button scene-pan-control${panMode ? " scene-icon-active" : ""}`}
          aria-label={panMode ? "Pan mode active" : "Enable pan mode"}
          aria-pressed={panMode}
          title={
            panMode
              ? "Pan mode: left-drag moves the view. Click to switch to rotate mode."
              : "Pan mode: left-drag moves the view."
          }
          onClick={() => setPanMode((active) => !active)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3m6 6-3-3m3 3-3 3m-6 6-3-3m3 3 3-3m-18-9 3-3m-3 3 3 3" />
          </svg>
          <span>Pan</span>
        </button>
        <button
          type="button"
          className={`scene-icon-button${showProbeNetwork ? " scene-icon-active" : ""}`}
          aria-label="Toggle cathodic protection network"
          aria-pressed={showProbeNetwork}
          title="Cathodic protection network"
          onClick={() => setShowProbeNetwork((visible) => !visible)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="18" r="2" />
            <circle cx="19" cy="18" r="2" />
            <path d="m11 7-5 9m7-9 5 9M7 18h10" />
          </svg>
        </button>
        <button
          type="button"
          className={`scene-icon-button${showAssetMarkers ? " scene-icon-active" : ""}`}
          aria-label={`Toggle asset markers for ${assets.length} assets`}
          aria-pressed={showAssetMarkers}
          title="Asset markers"
          onClick={() => setShowAssetMarkers((visible) => !visible)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5h11M9 12h11M9 19h11" />
            <circle cx="4" cy="5" r="1" />
            <circle cx="4" cy="12" r="1" />
            <circle cx="4" cy="19" r="1" />
          </svg>
        </button>
        <button
          type="button"
          className={`scene-icon-button scene-labeled-control${showFilters ? " scene-icon-active" : ""}`}
          aria-label={showFilters ? "Close asset filters" : "Filter assets"}
          aria-pressed={showFilters}
          aria-expanded={showFilters}
          aria-controls="scene-filter-panel"
          title="Search and filter by type or condition"
          onClick={() => {
            setShowFilters((visible) => !visible);
            setSelectedAssetId(null);
            setHoveredAssetId(null);
            setHoveredMarker(null);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
          </svg>
          <span>Filter</span>
        </button>
        <button
          type="button"
          className={`scene-icon-button${expanded ? " scene-icon-active" : ""}`}
          aria-label={expanded ? "Close expanded 3D view" : "Expand 3D view"}
          aria-pressed={expanded}
          title={expanded ? "Close expanded view" : "Expand model"}
          onClick={() => setExpanded((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
            <path d="m3 3 6 6m12-6-6 6M3 21l6-6m12 6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
