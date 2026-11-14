import * as THREE from "three";

function beam(
  parent: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
  radius = 0.028,
): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 0.001) return;

  const member = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 6),
    material,
  );
  member.position.copy(start).add(end).multiplyScalar(0.5);
  member.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(member);
}

function box(
  parent: THREE.Group,
  position: THREE.Vector3,
  dimensions: THREE.Vector3,
  fill: THREE.Material,
  edges: THREE.Material,
): void {
  const geometry = new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z);
  const body = new THREE.Mesh(geometry, fill);
  body.position.copy(position);
  parent.add(body);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edges);
  outline.position.copy(position);
  parent.add(outline);
}

function addDeck(
  parent: THREE.Group,
  width: number,
  depth: number,
  y: number,
  thickness: number,
  fill: THREE.Material,
  frame: THREE.Material,
  grid: THREE.Material,
): void {
  box(
    parent,
    new THREE.Vector3(0, y, 0),
    new THREE.Vector3(width, thickness, depth),
    fill,
    frame,
  );
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const bottom = y - thickness / 2;
  for (const z of [-halfDepth, halfDepth]) {
    beam(
      parent,
      new THREE.Vector3(-halfWidth, y, z),
      new THREE.Vector3(halfWidth, y, z),
      frame,
      0.045,
    );
    beam(
      parent,
      new THREE.Vector3(-halfWidth, bottom, z),
      new THREE.Vector3(halfWidth, bottom, z),
      frame,
      0.025,
    );
  }
  for (const x of [-halfWidth, halfWidth]) {
    beam(
      parent,
      new THREE.Vector3(x, y, -halfDepth),
      new THREE.Vector3(x, y, halfDepth),
      frame,
      0.045,
    );
    beam(
      parent,
      new THREE.Vector3(x, bottom, -halfDepth),
      new THREE.Vector3(x, bottom, halfDepth),
      frame,
      0.025,
    );
  }
  for (let x = -halfWidth + 0.45; x < halfWidth; x += 0.55) {
    beam(
      parent,
      new THREE.Vector3(x, y + 0.01, -halfDepth),
      new THREE.Vector3(x, y + 0.01, halfDepth),
      grid,
      0.015,
    );
  }
  for (let z = -halfDepth + 0.45; z < halfDepth; z += 0.55) {
    beam(
      parent,
      new THREE.Vector3(-halfWidth, y + 0.01, z),
      new THREE.Vector3(halfWidth, y + 0.01, z),
      grid,
      0.015,
    );
  }
}

function addGuardrail(
  parent: THREE.Group,
  width: number,
  depth: number,
  y: number,
  frame: THREE.Material,
): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  for (const railY of [y, y + 0.28, y + 0.56]) {
    beam(
      parent,
      new THREE.Vector3(-halfWidth, railY, -halfDepth),
      new THREE.Vector3(halfWidth, railY, -halfDepth),
      frame,
      0.018,
    );
    beam(
      parent,
      new THREE.Vector3(-halfWidth, railY, halfDepth),
      new THREE.Vector3(halfWidth, railY, halfDepth),
      frame,
      0.018,
    );
    beam(
      parent,
      new THREE.Vector3(-halfWidth, railY, -halfDepth),
      new THREE.Vector3(-halfWidth, railY, halfDepth),
      frame,
      0.018,
    );
    beam(
      parent,
      new THREE.Vector3(halfWidth, railY, -halfDepth),
      new THREE.Vector3(halfWidth, railY, halfDepth),
      frame,
      0.018,
    );
  }
  for (let x = -halfWidth; x <= halfWidth + 0.01; x += 0.65) {
    for (const z of [-halfDepth, halfDepth]) {
      beam(
        parent,
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x, y + 0.56, z),
        frame,
        0.016,
      );
    }
  }
  for (let z = -halfDepth; z <= halfDepth + 0.01; z += 0.65) {
    for (const x of [-halfWidth, halfWidth]) {
      beam(
        parent,
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x, y + 0.56, z),
        frame,
        0.016,
      );
    }
  }
}

function addModule(
  parent: THREE.Group,
  center: THREE.Vector3,
  size: THREE.Vector3,
  fill: THREE.Material,
  frame: THREE.Material,
  glass: THREE.Material,
): void {
  box(parent, center, size, fill, frame);
  const left = center.x - size.x / 2;
  const right = center.x + size.x / 2;
  const front = center.z + size.z / 2 + 0.012;
  const bottom = center.y - size.y / 2 + 0.08;
  const top = center.y + size.y / 2 - 0.08;

  for (let x = left + 0.12; x < right; x += 0.28) {
    beam(
      parent,
      new THREE.Vector3(x, bottom, front),
      new THREE.Vector3(x, top, front),
      frame,
      0.014,
    );
  }
  for (let y = bottom + 0.12; y < top; y += 0.24) {
    beam(
      parent,
      new THREE.Vector3(left, y, front),
      new THREE.Vector3(right, y, front),
      frame,
      0.013,
    );
  }
  for (let x = left + 0.18; x < right - 0.14; x += 0.46) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.025), glass);
    window.position.set(x, center.y + 0.05, front + 0.014);
    parent.add(window);
  }
  const side = center.x + size.x / 2 + 0.012;
  for (let z = center.z - size.z / 2 + 0.15; z < center.z + size.z / 2; z += 0.3) {
    beam(
      parent,
      new THREE.Vector3(side, bottom, z),
      new THREE.Vector3(side, top, z),
      frame,
      0.014,
    );
  }
  for (let y = bottom + 0.12; y < top; y += 0.24) {
    beam(
      parent,
      new THREE.Vector3(side, y, center.z - size.z / 2),
      new THREE.Vector3(side, y, center.z + size.z / 2),
      frame,
      0.013,
    );
  }
}

function addVessel(
  parent: THREE.Group,
  x: number,
  z: number,
  baseY: number,
  height: number,
  shell: THREE.Material,
  rail: THREE.Material,
): void {
  const radius = 0.27;
  const vessel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius, height, 16, 1),
    shell,
  );
  vessel.position.set(x, baseY + height / 2, z);
  parent.add(vessel);
  for (const y of [baseY + 0.12, baseY + height * 0.52, baseY + height - 0.12]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.95, 0.018, 6, 24),
      rail,
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(x, y, z);
    parent.add(band);
  }
  const top = baseY + height;
  for (const railX of [x - 0.12, x + 0.12]) {
    beam(
      parent,
      new THREE.Vector3(railX, baseY + 0.14, z + radius),
      new THREE.Vector3(railX, top - 0.08, z + radius),
      rail,
      0.012,
    );
  }
  for (let y = baseY + 0.2; y < top - 0.1; y += 0.17) {
    beam(
      parent,
      new THREE.Vector3(x - 0.12, y, z + radius),
      new THREE.Vector3(x + 0.12, y, z + radius),
      rail,
      0.01,
    );
  }
  beam(
    parent,
    new THREE.Vector3(x, top, z),
    new THREE.Vector3(x, top + 0.24, z),
    rail,
    0.045,
  );
}

function addBeacon(
  parent: THREE.Group,
  position: THREE.Vector3,
  material: THREE.Material,
): void {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), material);
  marker.position.copy(position);
  parent.add(marker);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0x55e6f6,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  halo.position.copy(position);
  parent.add(halo);
}

function addSensorMast(
  parent: THREE.Group,
  x: number,
  z: number,
  baseY: number,
  height: number,
  frame: THREE.Material,
  darkFrame: THREE.Material,
  cyan: THREE.Material,
): void {
  const halfBase = 0.24;
  const halfTop = 0.12;
  const bottom = [
    new THREE.Vector3(x - halfBase, baseY, z - halfBase),
    new THREE.Vector3(x + halfBase, baseY, z - halfBase),
    new THREE.Vector3(x + halfBase, baseY, z + halfBase),
    new THREE.Vector3(x - halfBase, baseY, z + halfBase),
  ];
  const top = [
    new THREE.Vector3(x - halfTop, baseY + height, z - halfTop),
    new THREE.Vector3(x + halfTop, baseY + height, z - halfTop),
    new THREE.Vector3(x + halfTop, baseY + height, z + halfTop),
    new THREE.Vector3(x - halfTop, baseY + height, z + halfTop),
  ];
  for (let corner = 0; corner < 4; corner += 1) {
    beam(parent, bottom[corner]!, top[corner]!, frame, 0.026);
  }
  for (let y = baseY + 0.32; y < baseY + height; y += 0.32) {
    const fraction = (y - baseY) / height;
    const ring = bottom.map((point, index) => point.clone().lerp(top[index]!, fraction));
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      beam(parent, ring[side]!, ring[next]!, darkFrame, 0.018);
    }
    const nextFraction = Math.min(1, fraction + 0.32 / height);
    const upper = bottom.map((point, index) =>
      point.clone().lerp(top[index]!, nextFraction),
    );
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      beam(parent, ring[side]!, upper[next]!, darkFrame, 0.014);
    }
  }
  addBeacon(parent, new THREE.Vector3(x, baseY + height + 0.08, z), cyan);
}

function latticeBoom(
  parent: THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
): void {
  const axis = end.clone().sub(start).normalize();
  const side = new THREE.Vector3()
    .crossVectors(axis, new THREE.Vector3(0, 1, 0))
    .normalize();
  const normal = new THREE.Vector3().crossVectors(side, axis).normalize();
  const width = 0.48;
  const depth = 0.42;
  const sections = 12;
  const section = (index: number) => {
    const center = start.clone().lerp(end, index / sections);
    return [
      center
        .clone()
        .addScaledVector(side, -width / 2)
        .addScaledVector(normal, -depth / 2),
      center
        .clone()
        .addScaledVector(side, width / 2)
        .addScaledVector(normal, -depth / 2),
      center
        .clone()
        .addScaledVector(side, width / 2)
        .addScaledVector(normal, depth / 2),
      center
        .clone()
        .addScaledVector(side, -width / 2)
        .addScaledVector(normal, depth / 2),
    ];
  };
  for (let index = 0; index <= sections; index += 1) {
    const current = section(index);
    for (let corner = 0; corner < 4; corner += 1) {
      beam(parent, current[corner]!, current[(corner + 1) % 4]!, material, 0.025);
      if (index === sections) continue;
      const next = section(index + 1);
      beam(parent, current[corner]!, next[corner]!, material, 0.025);
      beam(parent, current[corner]!, next[(corner + 1) % 4]!, material, 0.017);
    }
  }
}

function addDerrick(
  parent: THREE.Group,
  frame: THREE.Material,
  darkFrame: THREE.Material,
  cyan: THREE.Material,
): void {
  const baseY = 5.55;
  const topY = 8.65;
  const base = [
    new THREE.Vector3(-0.65, baseY, -0.5),
    new THREE.Vector3(0.65, baseY, -0.5),
    new THREE.Vector3(0.65, baseY, 0.5),
    new THREE.Vector3(-0.65, baseY, 0.5),
  ];
  const top = [
    new THREE.Vector3(-0.2, topY, -0.16),
    new THREE.Vector3(0.2, topY, -0.16),
    new THREE.Vector3(0.2, topY, 0.16),
    new THREE.Vector3(-0.2, topY, 0.16),
  ];
  for (let corner = 0; corner < 4; corner += 1) {
    beam(parent, base[corner]!, top[corner]!, frame, 0.052);
    beam(parent, base[corner]!, base[(corner + 1) % 4]!, darkFrame, 0.04);
    beam(parent, top[corner]!, top[(corner + 1) % 4]!, frame, 0.03);
  }
  for (let y = baseY + 0.35; y < topY; y += 0.42) {
    const t0 = (y - baseY) / (topY - baseY);
    const t1 = Math.min(1, (y + 0.42 - baseY) / (topY - baseY));
    const lower = base.map((point, index) => point.clone().lerp(top[index]!, t0));
    const upper = base.map((point, index) => point.clone().lerp(top[index]!, t1));
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      beam(parent, lower[side]!, lower[next]!, darkFrame, 0.023);
      beam(parent, lower[side]!, upper[next]!, darkFrame, 0.02);
      beam(parent, lower[next]!, upper[side]!, darkFrame, 0.02);
    }
  }
  beam(
    parent,
    new THREE.Vector3(0, topY, 0),
    new THREE.Vector3(0, topY + 0.42, 0),
    frame,
    0.024,
  );
  addBeacon(parent, new THREE.Vector3(0, topY + 0.5, 0), cyan);
}

function addCrane(
  parent: THREE.Group,
  base: THREE.Vector3,
  tip: THREE.Vector3,
  frame: THREE.Material,
  darkFrame: THREE.Material,
  amber: THREE.Material,
  cyan: THREE.Material,
): void {
  const pivot = base.clone().add(new THREE.Vector3(0, 1.25, 0));
  const mast = pivot.clone().add(new THREE.Vector3(0, 1.12, 0));
  box(
    parent,
    base.clone().add(new THREE.Vector3(0, 0.2, 0)),
    new THREE.Vector3(0.9, 0.42, 0.82),
    darkFrame,
    frame,
  );
  box(parent, pivot, new THREE.Vector3(0.62, 0.48, 0.6), darkFrame, frame);
  latticeBoom(parent, pivot, tip, frame);
  for (const direction of [-1, 1]) {
    beam(
      parent,
      pivot.clone().add(new THREE.Vector3(direction * 0.28, 0.08, 0)),
      mast.clone().add(new THREE.Vector3(direction * 0.34, 0, 0)),
      frame,
      0.032,
    );
  }
  beam(
    parent,
    mast.clone().add(new THREE.Vector3(-0.34, 0, 0)),
    mast.clone().add(new THREE.Vector3(0.34, 0, 0)),
    darkFrame,
    0.026,
  );
  beam(parent, mast, tip, darkFrame, 0.014);
  const hookEnd = tip.clone().add(new THREE.Vector3(0, -1.5, 0));
  beam(parent, tip, hookEnd, darkFrame, 0.014);
  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.022, 6, 12, Math.PI * 1.5),
    amber,
  );
  hook.position.copy(hookEnd).add(new THREE.Vector3(0, -0.05, 0));
  hook.rotation.z = Math.PI;
  parent.add(hook);
  addBeacon(parent, tip, cyan);
}

export function buildOffshorePlatform(scene: THREE.Scene): void {
  const model = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({
    color: 0x65b6c8,
    metalness: 0.34,
    roughness: 0.42,
  });
  const darkFrame = new THREE.MeshStandardMaterial({
    color: 0x28667b,
    metalness: 0.42,
    roughness: 0.56,
  });
  const deckFill = new THREE.MeshBasicMaterial({
    color: 0x0b2335,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const moduleFill = new THREE.MeshBasicMaterial({
    color: 0x102b3e,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });
  const glass = new THREE.MeshBasicMaterial({
    color: 0x5da7bf,
    transparent: true,
    opacity: 0.6,
  });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffb84d });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x55e6f6 });

  const supports = [
    [-2.9, -1.95],
    [2.9, -1.95],
    [2.9, 1.95],
    [-2.9, 1.95],
  ] as const;
  const legHalf = 0.48;
  for (const [x, z] of supports) {
    const corners = [
      new THREE.Vector3(x - legHalf, 0.28, z - legHalf),
      new THREE.Vector3(x + legHalf, 0.28, z - legHalf),
      new THREE.Vector3(x + legHalf, 0.28, z + legHalf),
      new THREE.Vector3(x - legHalf, 0.28, z + legHalf),
    ];
    box(
      model,
      new THREE.Vector3(x, 0.22, z),
      new THREE.Vector3(1.42, 0.22, 1.42),
      deckFill,
      frame,
    );
    box(
      model,
      new THREE.Vector3(x, 2.34, z),
      new THREE.Vector3(0.96, 4.12, 0.96),
      deckFill,
      darkFrame,
    );
    for (const y of [0.38, 0.75, 1.12, 1.49, 1.86, 2.23, 2.6, 2.97, 3.34, 3.71, 4.08]) {
      const ring = corners.map((corner) => new THREE.Vector3(corner.x, y, corner.z));
      for (let side = 0; side < 4; side += 1) {
        beam(model, ring[side]!, ring[(side + 1) % 4]!, frame, 0.027);
      }
    }
    for (let side = 0; side < 4; side += 1) {
      const nextSide = (side + 1) % 4;
      for (let division = 1; division < 4; division += 1) {
        const ratio = division / 4;
        const bottom = corners[side]!.clone().lerp(corners[nextSide]!, ratio);
        const top = bottom.clone();
        top.y = 4.16;
        beam(model, bottom, top, darkFrame, 0.02);
      }
      for (let y = 0.38; y < 4.0; y += 0.74) {
        const upper = Math.min(y + 0.74, 4.08);
        const lowerFrame = corners.map(
          (corner) => new THREE.Vector3(corner.x, y, corner.z),
        );
        const upperFrame = corners.map(
          (corner) => new THREE.Vector3(corner.x, upper, corner.z),
        );
        beam(model, lowerFrame[side]!, upperFrame[nextSide]!, darkFrame, 0.018);
      }
    }
  }

  for (const y of [1.35, 2.55, 3.62]) {
    for (let index = 0; index < supports.length; index += 1) {
      const current = supports[index]!;
      const next = supports[(index + 1) % supports.length]!;
      beam(
        model,
        new THREE.Vector3(current[0], y, current[1]),
        new THREE.Vector3(next[0], y, next[1]),
        darkFrame,
        0.06,
      );
    }
  }
  for (const [low, high] of [
    [1.35, 2.55],
    [2.55, 3.62],
  ] as const) {
    for (let index = 0; index < supports.length; index += 1) {
      const current = supports[index]!;
      const next = supports[(index + 1) % supports.length]!;
      beam(
        model,
        new THREE.Vector3(current[0], low, current[1]),
        new THREE.Vector3(next[0], high, next[1]),
        frame,
        0.032,
      );
      beam(
        model,
        new THREE.Vector3(next[0], low, next[1]),
        new THREE.Vector3(current[0], high, current[1]),
        frame,
        0.032,
      );
    }
  }

  addDeck(model, 6.55, 4.55, 3.45, 0.15, deckFill, frame, darkFrame);
  addDeck(model, 7.1, 4.95, 4.02, 0.18, deckFill, frame, darkFrame);
  addDeck(model, 7.5, 5.25, 4.43, 0.2, deckFill, frame, darkFrame);
  addGuardrail(model, 7.3, 5.05, 4.54, frame);

  for (const [center, size] of [
    [
      [-1.85, 5.08, -1.0],
      [1.95, 1.05, 1.6],
    ],
    [
      [0.15, 5.02, -1.05],
      [1.6, 0.92, 1.45],
    ],
    [
      [-1.55, 5.02, 0.95],
      [1.55, 0.88, 1.25],
    ],
    [
      [0.3, 5.06, 0.95],
      [1.65, 0.96, 1.3],
    ],
    [
      [2.0, 5.08, -0.05],
      [1.25, 1.12, 1.9],
    ],
    [
      [-2.45, 5.05, -2.0],
      [0.68, 0.76, 0.56],
    ],
  ] as const) {
    addModule(
      model,
      new THREE.Vector3(...center),
      new THREE.Vector3(...size),
      moduleFill,
      frame,
      glass,
    );
  }

  addDeck(model, 4.5, 3.25, 5.62, 0.14, deckFill, frame, darkFrame);
  addGuardrail(model, 4.4, 3.15, 5.7, frame);
  addModule(
    model,
    new THREE.Vector3(-0.55, 6.04, -0.85),
    new THREE.Vector3(1.55, 0.72, 1.25),
    moduleFill,
    frame,
    glass,
  );

  const vesselShell = new THREE.MeshStandardMaterial({
    color: 0x1d5268,
    metalness: 0.4,
    roughness: 0.46,
    transparent: true,
    opacity: 0.78,
  });
  addVessel(model, -2.0, 0.05, 4.55, 1.55, vesselShell, frame);
  addVessel(model, -0.95, 0.15, 4.55, 1.16, vesselShell, frame);
  addVessel(model, 0.45, 0.12, 4.55, 1.36, vesselShell, frame);

  for (const [start, end] of [
    [
      [-2.7, 4.9, 0.7],
      [-2.7, 5.65, 0.7],
    ],
    [
      [-2.7, 5.65, 0.7],
      [1.0, 5.65, 0.7],
    ],
    [
      [-1.6, 4.75, -1.8],
      [-1.6, 5.42, -1.8],
    ],
    [
      [-1.6, 5.42, -1.8],
      [1.5, 5.42, -1.8],
    ],
    [
      [1.5, 5.42, -1.8],
      [1.5, 4.85, 1.2],
    ],
    [
      [-0.7, 5.2, 0.2],
      [-0.7, 5.75, 0.2],
    ],
  ] as const) {
    beam(model, new THREE.Vector3(...start), new THREE.Vector3(...end), frame, 0.035);
  }

  addDerrick(model, frame, darkFrame, cyan);
  addSensorMast(model, -1.65, -0.45, 5.42, 1.62, frame, darkFrame, cyan);
  addSensorMast(model, 1.38, -0.55, 5.35, 1.08, frame, darkFrame, cyan);
  addCrane(
    model,
    new THREE.Vector3(-2.45, 5.15, -1.45),
    new THREE.Vector3(-7.15, 7.62, 0.72),
    frame,
    darkFrame,
    amber,
    cyan,
  );
  addCrane(
    model,
    new THREE.Vector3(2.2, 5.12, -1.55),
    new THREE.Vector3(6.3, 7.55, -2.8),
    frame,
    darkFrame,
    amber,
    cyan,
  );

  const padCenter = new THREE.Vector3(3.92, 5.02, -1.45);
  box(
    model,
    new THREE.Vector3(3.65, 4.72, -1.45),
    new THREE.Vector3(2.65, 0.16, 2.0),
    deckFill,
    frame,
  );
  for (const x of [3.0, 4.55]) {
    for (const z of [-2.15, -0.75]) {
      beam(
        model,
        new THREE.Vector3(x, 4.48, z),
        new THREE.Vector3(x, 4.96, z),
        frame,
        0.05,
      );
    }
  }
  for (const z of [-2.15, -0.75]) {
    beam(
      model,
      new THREE.Vector3(2.25, 4.5, z),
      new THREE.Vector3(3.0, 4.96, z),
      darkFrame,
      0.035,
    );
    beam(
      model,
      new THREE.Vector3(3.0, 4.96, z),
      new THREE.Vector3(4.55, 4.96, z),
      darkFrame,
      0.035,
    );
  }
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.08, 48), deckFill);
  pad.position.copy(padCenter);
  model.add(pad);
  const padEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.22, 1.22, 0.08, 48)),
    frame,
  );
  padEdge.position.copy(padCenter);
  model.add(padEdge);
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.024, 6, 48), frame);
  padRing.rotation.x = Math.PI / 2;
  padRing.position.set(padCenter.x, padCenter.y + 0.05, padCenter.z);
  model.add(padRing);

  const markCanvas = document.createElement("canvas");
  markCanvas.width = 128;
  markCanvas.height = 128;
  const context = markCanvas.getContext("2d");
  if (context) {
    context.strokeStyle = "#e7f7fa";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(64, 64, 48, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#e7f7fa";
    context.font = "700 94px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("H", 64, 66);
    const texture = new THREE.CanvasTexture(markCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(padCenter.x, padCenter.y + 0.052, padCenter.z);
    model.add(mark);
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), amber);
    light.position.set(
      padCenter.x + Math.cos(angle) * 1.12,
      padCenter.y + 0.06,
      padCenter.z + Math.sin(angle) * 1.12,
    );
    model.add(light);
  }

  const grid = new THREE.GridHelper(22, 22, 0x2d8195, 0x1a465c);
  grid.position.y = 0.08;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of gridMaterials) {
    material.transparent = true;
    material.opacity = 0.42;
  }
  scene.add(grid, model);
}
