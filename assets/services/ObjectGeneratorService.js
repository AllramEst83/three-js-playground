export default class ObjectGeneratorService {
  constructor(scene, collidableObjects, landableObjects, GROUND_HEIGHT) {
    console.log("ObjectGenerator constructor called");
    this.scene = scene;
    this.collidableObjects = collidableObjects;
    this.landableObjects = landableObjects;
    this.GROUND_HEIGHT = GROUND_HEIGHT;

    // Dynamic crouch configuration
    this.crouchConfig = {
      PLAYER_CROUCH_HEIGHT: 2, // Should match UserMovementService config
      MIN_CROUCH_CLEARANCE: 0.5, // Minimum space above crouched player
      BARRIER_HEIGHT: 6,
      TUNNEL_HEIGHT: 8,
    };

    this.materials = {
      box: new THREE.MeshStandardMaterial({
        color: 0xff0000,
        roughness: 0.7,
        metalness: 0.1,
      }),
      cylinder: new THREE.MeshStandardMaterial({
        color: 0x0000ff,
        roughness: 0.6,
        metalness: 0.2,
      }),
      platform: new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        roughness: 0.8,
        metalness: 0.0,
      }),
      tall: new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        roughness: 0.5,
        metalness: 0.3,
      }),
      lowBarrier: new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        roughness: 0.9,
        metalness: 0.0,
      }),
      tunnel: new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        metalness: 0.6,
      }),
    };

    this.geometries = {
      box: new THREE.BoxGeometry(20, 20, 20),
      cylinder: new THREE.CylinderGeometry(5, 5, 40, 32),
      platform: new THREE.BoxGeometry(30, 5, 30),
      tallBox: new THREE.BoxGeometry(15, 60, 15),
      lowBarrier: new THREE.BoxGeometry(
        40,
        this.crouchConfig.BARRIER_HEIGHT,
        8
      ),
      tunnel: new THREE.BoxGeometry(50, this.crouchConfig.TUNNEL_HEIGHT, 12),
    };
  }

  // Calculate the optimal Y position for crouch obstacles
  calculateCrouchBarrierY(barrierType = "lowBarrier") {
    const barrierHeight = this.geometries[barrierType].parameters.height;
    const requiredBottom =
      this.GROUND_HEIGHT +
      this.crouchConfig.PLAYER_CROUCH_HEIGHT +
      this.crouchConfig.MIN_CROUCH_CLEARANCE;
    return requiredBottom + barrierHeight / 2;
  }

  // Create a crouch obstacle with automatic height calculation
  createCrouchObstacle(type, x, z, rotation = 0, isLandable = false) {
    const y = this.calculateCrouchBarrierY(type);
    const mesh = this.createObject(
      type,
      new THREE.Vector3(x, y, z),
      isLandable
    );
    mesh.rotation.y = rotation;

    // Mark as crouch obstacle for collision detection
    mesh.userData.isCrouchObstacle = true;
    mesh.userData.obstacleType = type;

    console.log(
      `Created ${type} at Y=${y.toFixed(2)} (barrier bottom at ${(
        y -
        this.geometries[type].parameters.height / 2
      ).toFixed(2)})`
    );
    return mesh;
  }

  createObject(type, position, isLandable = true) {
    const mesh = new THREE.Mesh(
      this.geometries[type],
      this.materials[
        type === "tallBox"
          ? "tall"
          : type === "lowBarrier"
          ? "lowBarrier"
          : type === "tunnel"
          ? "tunnel"
          : type
      ]
    );
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);
    this.collidableObjects.push(mesh);
    if (isLandable) {
      this.landableObjects.push(mesh);
    }

    return mesh;
  }

  createPlatformTower(baseX, baseZ, levels = 3) {
    const spacing = 25;
    const heightIncrement = 30;

    for (let i = 0; i < levels; i++) {
      const angle = (i * Math.PI * 2) / levels;
      const radius = i === 0 ? 0 : 40;

      const x = baseX + Math.cos(angle) * radius;
      const z = baseZ + Math.sin(angle) * radius;
      const y = this.GROUND_HEIGHT + i * heightIncrement;

      this.createObject("platform", new THREE.Vector3(x, y, z));
    }
  }

  createStaircase(startX, startZ, direction, steps = 5) {
    const stepHeight = 15;
    const stepDepth = 25;

    for (let i = 0; i < steps; i++) {
      const x = startX + direction.x * i * stepDepth;
      const z = startZ + direction.z * i * stepDepth;
      const y = this.GROUND_HEIGHT + i * stepHeight;

      this.createObject("box", new THREE.Vector3(x, y, z));
    }
  }

  scatterObjects(
    area,
    count,
    types,
    heightRange = { min: this.GROUND_HEIGHT, max: this.GROUND_HEIGHT + 20 }
  ) {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * area.width;
      const z = (Math.random() - 0.5) * area.depth;
      const y =
        heightRange.min + Math.random() * (heightRange.max - heightRange.min);

      const type = types[Math.floor(Math.random() * types.length)];
      this.createObject(type, new THREE.Vector3(x, y, z));
    }
  }

  createJumpingChallenges() {
    // Challenge area 1: Stepping stones
    const baseX = 600;
    const baseZ = 600;
    const heights = [15, 25, 35, 45, 35, 25, 40, 55];

    for (let i = 0; i < heights.length; i++) {
      const angle = (i / heights.length) * Math.PI * 2;
      const radius = 30 + i * 10;
      const x = baseX + Math.cos(angle) * radius;
      const z = baseZ + Math.sin(angle) * radius;
      const y = this.GROUND_HEIGHT + heights[i];

      this.createObject("platform", new THREE.Vector3(x, y, z));
    }

    // Challenge area 2: Linear jumping course
    const startX = -600;
    const startZ = 600;
    const courseLength = 8;

    for (let i = 0; i < courseLength; i++) {
      const x = startX + i * 40;
      const z = startZ + Math.sin(i * 0.5) * 30;
      const y = this.GROUND_HEIGHT + 20 + Math.sin(i * 0.8) * 15;

      this.createObject("platform", new THREE.Vector3(x, y, z));
    }

    // Challenge area 3: Pyramid structure
    const pyramidX = 0;
    const pyramidZ = -600;
    const levels = 4;

    for (let level = 0; level < levels; level++) {
      const y = this.GROUND_HEIGHT + level * 20;
      const size = (levels - level) * 2;

      for (let x = -size; x <= size; x += 2) {
        for (let z = -size; z <= size; z += 2) {
          if (Math.abs(x) === size || Math.abs(z) === size) {
            this.createObject(
              "box",
              new THREE.Vector3(pyramidX + x * 15, y, pyramidZ + z * 15)
            );
          }
        }
      }
    }
  }

  createCrouchObstacles() {
    // Create some low barriers that require crouching to pass under
    const barriers = [
      { x: -150, z: 0, rotation: 0 },
      { x: 100, z: -100, rotation: Math.PI / 2 },
      { x: -50, z: 200, rotation: 0 },
      { x: 250, z: 150, rotation: Math.PI / 4 },
      { x: -300, z: -50, rotation: Math.PI / 2 },
      { x: 0, z: -250, rotation: 0 },
    ];

    barriers.forEach((barrier) => {
      this.createCrouchObstacle(
        "lowBarrier",
        barrier.x,
        barrier.z,
        barrier.rotation,
        true
      );
    });

    // Create a tunnel-like structure that requires crouching
    for (let i = 0; i < 5; i++) {
      const x = 400 + i * 15;
      const z = -400;
      this.createCrouchObstacle("lowBarrier", x, z - 10, Math.PI / 2, false);
      this.createCrouchObstacle("lowBarrier", x, z + 10, Math.PI / 2, false);
    }

    // Create some tunnel obstacles with different heights
    const tunnelObstacles = [
      { x: -400, z: -200, type: "tunnel" },
      { x: 300, z: -400, type: "lowBarrier" },
      { x: -100, z: 300, type: "tunnel" },
    ];

    tunnelObstacles.forEach((obstacle) => {
      this.createCrouchObstacle(
        obstacle.type,
        obstacle.x,
        obstacle.z,
        0,
        false
      );
    });
  }

  generateWorldObjects() {
    const mapSize = { width: 1800, depth: 1800 };

    // Scatter random objects across the entire map
    this.scatterObjects(mapSize, 35, ["box", "cylinder"], {
      min: this.GROUND_HEIGHT,
      max: this.GROUND_HEIGHT + 10,
    });

    // Create platform towers for vertical platforming
    this.createPlatformTower(-200, -200, 8);
    this.createPlatformTower(300, 300, 7);
    this.createPlatformTower(-400, 400, 9);
    this.createPlatformTower(500, -300, 7);

    // Create staircases
    this.createStaircase(-100, 100, new THREE.Vector3(1, 0, 0), 6);
    this.createStaircase(200, -200, new THREE.Vector3(0, 0, 1), 5);
    this.createStaircase(
      -300,
      -100,
      new THREE.Vector3(-1, 0, 1).normalize(),
      4
    );

    // Add some tall obstacles
    this.scatterObjects(mapSize, 15, ["tallBox"], {
      min: this.GROUND_HEIGHT + 30,
      max: this.GROUND_HEIGHT + 30,
    });

    // Create jumping challenge areas
    this.createJumpingChallenges();

    // Create crouch obstacles
    this.createCrouchObstacles();
  }
}

// Make ObjectGenerator available globally for script tag usage
console.log("ObjectGeneratorService.js loaded");
window.ObjectGeneratorService = ObjectGeneratorService;
console.log(
  "ObjectGeneratorService assigned to window:",
  typeof window.ObjectGeneratorService
);
