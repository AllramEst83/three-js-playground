export default class UserMovementService {
  constructor(controls, collidableObjects, landableObjects, options = {}) {
    this.controls = controls;
    this.collidableObjects = collidableObjects;
    this.landableObjects = landableObjects;

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isRunning = false;
    this.isCrouching = false;

    this.canJump = false;
    this.isJumping = false;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.config = {
      GRAVITY: options.GRAVITY || 8.0,
      JUMP_VELOCITY: options.JUMP_VELOCITY || 250,
      GROUND_HEIGHT: options.GROUND_HEIGHT || 10,
      WALK_SPEED: options.WALK_SPEED || 450.0,
      RUN_SPEED: options.RUN_SPEED || 1000.0,
      CROUCH_SPEED: options.CROUCH_SPEED || 200.0,
      PLAYER_RADIUS: options.PLAYER_RADIUS || 5,
      PLAYER_HEIGHT: options.PLAYER_HEIGHT || 8,
      CROUCH_HEIGHT: options.CROUCH_HEIGHT || 2,
      VELOCITY_DAMPING: options.VELOCITY_DAMPING || 10.0,
      MOUSE_SENSITIVITY: options.MOUSE_SENSITIVITY || 0.002,
    };

    this.raycaster = new THREE.Raycaster();
    this.prevTime = performance.now();

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.update = this.update.bind(this);

    // Eye heights (camera offset inside the player)
    this.eye = { stand: 0, crouch: 0 };
    this.initEyeHeights();

    this.canJump = true;
  }

  initEyeHeights() {
    const current =
      this.controls.pitchObject?.position?.y ?? this.config.PLAYER_HEIGHT * 0.9;
    const delta = this.config.PLAYER_HEIGHT - this.config.CROUCH_HEIGHT;
    this.eye.stand = current;
    this.eye.crouch = current - delta * 2.5;
  }

  setupEventListeners() {
    document.addEventListener("keydown", this.onKeyDown, false);
    document.addEventListener("keyup", this.onKeyUp, false);
    document.addEventListener(
      "click",
      () => {
        // Only request pointer lock if game has started
        if (this.getGameStarted && this.getGameStarted()) {
          document.body.requestPointerLock();
        }
      },
      false
    );
    document.addEventListener(
      "pointerlockchange",
      this.onPointerLockChange,
      false
    );
    document.addEventListener("mousemove", this.onMouseMove, false);
    window.addEventListener("resize", this.onWindowResize, false);
  }

  removeEventListeners() {
    document.removeEventListener("keydown", this.onKeyDown, false);
    document.removeEventListener("keyup", this.onKeyUp, false);
    document.removeEventListener(
      "pointerlockchange",
      this.onPointerLockChange,
      false
    );
    document.removeEventListener("mousemove", this.onMouseMove, false);
    window.removeEventListener("resize", this.onWindowResize, false);
  }

  onKeyDown(event) {
    // Check if game has started (if callback exists)
    if (this.getGameStarted && !this.getGameStarted()) return;

    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = true; // fixed
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveBackward = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveRight = true; // fixed
        break;
      case "Space":
        event.preventDefault();
        if (this.canJump && !this.isCrouching) {
          this.velocity.y = this.config.JUMP_VELOCITY;
          this.canJump = false;
          this.isJumping = true;
        }
        break;
      case "ShiftLeft":
      case "ShiftRight":
        if (!this.isCrouching) this.isRunning = true;
        break;
      case "KeyC":
        this.toggleCrouch();
        break;
    }
  }

  onKeyUp(event) {
    // Check if game has started (if callback exists)
    if (this.getGameStarted && !this.getGameStarted()) return;

    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = false; // fixed
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveBackward = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveRight = false; // fixed
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.isRunning = false;
        break;
    }
  }

  onPointerLockChange() {
    this.controls.enabled = document.pointerLockElement === document.body;
  }

  onMouseMove(event) {
    if (!this.controls.enabled) return;
    // Check if game has started (if callback exists)
    if (this.getGameStarted && !this.getGameStarted()) return;

    const movementX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    this.controls.yawObject.rotation.y -=
      movementX * this.config.MOUSE_SENSITIVITY;
    this.controls.pitchObject.rotation.x -=
      movementY * this.config.MOUSE_SENSITIVITY;
    this.controls.pitchObject.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.controls.pitchObject.rotation.x)
    );
  }

  onWindowResize(camera, renderer) {
    if (camera && renderer) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  // Toggle crouch by moving the camera (eye) inside the player, not the player body itself
  toggleCrouch() {
    const goingToCrouch = !this.isCrouching;

    // prevent running while crouched
    if (goingToCrouch) this.isRunning = false;
    else {
      // optional: check headroom before standing
      if (!this.hasHeadroomToStand()) return; // stay crouched if blocked
    }

    this.isCrouching = goingToCrouch;
    const targetY = this.isCrouching ? this.eye.crouch : this.eye.stand;
    this.controls.pitchObject.position.y = targetY;
  }

  // Simple upward ray to ensure there's space to stand
  hasHeadroomToStand() {
    if (!this.isCrouching) return true;
    const origin = this.controls.yawObject.position.clone();
    const up = new THREE.Vector3(0, 1, 0);
    const needed = this.config.PLAYER_HEIGHT - this.config.CROUCH_HEIGHT;
    this.raycaster.set(origin, up);
    const hits = this.raycaster.intersectObjects(this.collidableObjects, true);
    const first = hits.find((h) => h.distance >= 0);
    return !first || first.distance > needed + 0.1;
  }

  checkOverheadCollision() {
    const playerPosition = this.controls.yawObject.position.clone();
    const currentPlayerHeight = this.getCurrentPlayerHeight();

    // Check directly above the player's head
    const headPosition = playerPosition.clone();
    headPosition.y += currentPlayerHeight / 2;

    this.raycaster.set(headPosition, new THREE.Vector3(0, 1, 0));
    const intersections = this.raycaster.intersectObjects(
      this.collidableObjects
    );

    // When crouching, we need more clearance to stand up
    const requiredClearance = this.isCrouching
      ? this.config.PLAYER_HEIGHT - this.config.CROUCH_HEIGHT + 0.5
      : 1;

    return (
      intersections.length > 0 && intersections[0].distance < requiredClearance
    );
  }

  // Specialized collision check for crouching movement
  checkCrouchCollision(direction) {
    const playerPosition = this.controls.yawObject.position.clone();

    this.raycaster.set(playerPosition, direction.normalize());
    const intersections = this.raycaster.intersectObjects(
      this.collidableObjects
    );

    if (intersections.length > 0) {
      const distance = intersections[0].distance;
      const hitObject = intersections[0].object;
      const collisionRadius = this.config.PLAYER_RADIUS * 0.6;

      if (distance < collisionRadius) {
        // Get object dimensions
        const objectBottom =
          hitObject.position.y -
          (hitObject.geometry.parameters
            ? hitObject.geometry.parameters.height / 2
            : 3);
        const objectTop =
          hitObject.position.y +
          (hitObject.geometry.parameters
            ? hitObject.geometry.parameters.height / 2
            : 3);
        const playerCrouchTop =
          playerPosition.y + this.config.CROUCH_HEIGHT / 2;

        // Check if this is marked as a crouch obstacle
        const isCrouchObstacle = hitObject.userData?.isCrouchObstacle || false;
        const obstacleType = hitObject.userData?.obstacleType || "unknown";

        console.log(
          `Collision with ${obstacleType} (crouch obstacle: ${isCrouchObstacle})`
        );
        console.log(
          `Object bottom: ${objectBottom.toFixed(
            2
          )}, Object top: ${objectTop.toFixed(
            2
          )}, Player crouch top: ${playerCrouchTop.toFixed(2)}`
        );

        // Dynamic clearance calculation
        const requiredClearance = 0.3; // Minimum buffer
        const actualClearance = objectBottom - playerCrouchTop;

        console.log(
          `Required clearance: ${requiredClearance}, Actual clearance: ${actualClearance.toFixed(
            2
          )}`
        );

        // If this is specifically designed as a crouch obstacle, be more lenient
        if (isCrouchObstacle && actualClearance > requiredClearance) {
          console.log(
            "CAN PASS UNDER - designed crouch obstacle with sufficient clearance"
          );
          return false;
        }

        // For any obstacle, check if there's clearance
        if (actualClearance > requiredClearance) {
          console.log("CAN PASS UNDER - sufficient vertical clearance");
          return false;
        }

        console.log("CROUCH COLLISION DETECTED - insufficient clearance");
        return true;
      }
    }

    return false;
  }

  // Keep for physics; player height affects landing math but we no longer move world Y when crouching
  getCurrentPlayerHeight() {
    return this.isCrouching
      ? this.config.CROUCH_HEIGHT
      : this.config.PLAYER_HEIGHT;
  }

  checkCollision(direction) {
    const playerPosition = this.controls.yawObject.position.clone();
    const currentPlayerHeight = this.getCurrentPlayerHeight();

    // Use smaller radius when crouching for more precise collision
    const effectiveRadius = this.isCrouching
      ? this.config.PLAYER_RADIUS * 0.7 // 30% smaller radius when crouching
      : this.config.PLAYER_RADIUS;

    const directions = [
      direction.clone(),
      direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
      direction
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4),
    ];

    for (let dir of directions) {
      // When crouching, only check at lower heights
      const checkHeights = this.isCrouching
        ? [-currentPlayerHeight * 0.3, 0] // Check lower positions when crouching
        : [-currentPlayerHeight * 0.3, 0, currentPlayerHeight * 0.3]; // Check bottom, middle, top when standing

      for (let heightOffset of checkHeights) {
        const checkPosition = playerPosition.clone();
        checkPosition.y += heightOffset;

        this.raycaster.set(checkPosition, dir.normalize());
        const intersections = this.raycaster.intersectObjects(
          this.collidableObjects
        );

        if (
          intersections.length > 0 &&
          intersections[0].distance < effectiveRadius
        ) {
          // Additional check: when crouching, ignore collisions that are above crouch height
          if (this.isCrouching) {
            const hitPoint = intersections[0].point;
            const playerBottom = playerPosition.y - currentPlayerHeight / 2;
            const playerTop = playerPosition.y + currentPlayerHeight / 2;

            // Only consider it a collision if the hit is within the crouched player's height
            if (hitPoint.y > playerTop + 1) {
              continue; // Ignore collisions above the crouched player
            }
          }

          return true;
        }
      }
    }
    return false;
  }

  checkTopCollision() {
    const playerPosition = this.controls.yawObject.position.clone();
    const currentPlayerHeight = this.getCurrentPlayerHeight();

    this.raycaster.set(playerPosition, new THREE.Vector3(0, -1, 0));
    const intersections = this.raycaster.intersectObjects(this.landableObjects);

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const objectTop = intersection.point.y;
      const playerBottom = playerPosition.y - currentPlayerHeight / 2;
      if (Math.abs(playerBottom - objectTop) < 2 && this.velocity.y <= 0) {
        return objectTop + currentPlayerHeight / 2;
      }
    }
    return null;
  }

  getGroundHeight() {
    const playerPosition = this.controls.yawObject.position.clone();
    const currentPlayerHeight = this.getCurrentPlayerHeight();

    this.raycaster.set(playerPosition, new THREE.Vector3(0, -1, 0));
    const intersections = this.raycaster.intersectObjects(this.landableObjects);

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const surfaceHeight = intersection.point.y + currentPlayerHeight / 2;
      if (Math.abs(playerPosition.y - surfaceHeight) < 3) return surfaceHeight;
    }
    return this.config.GROUND_HEIGHT;
  }

  update(delta) {
    if (!delta) {
      const time = performance.now();
      delta = (time - this.prevTime) / 1000;
      this.prevTime = time;
    }

    const currentGroundHeight = this.getGroundHeight();

    if (
      this.isJumping ||
      this.controls.yawObject.position.y > currentGroundHeight
    ) {
      this.velocity.y -= this.config.GRAVITY * 100 * delta;
    }

    this.velocity.x -= this.velocity.x * this.config.VELOCITY_DAMPING * delta;
    this.velocity.z -= this.velocity.z * this.config.VELOCITY_DAMPING * delta;

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveLeft) - Number(this.moveRight);
    this.direction.normalize();

    let currentSpeed = this.isCrouching
      ? this.config.CROUCH_SPEED
      : this.isRunning
      ? this.config.RUN_SPEED
      : this.config.WALK_SPEED;

    if (this.moveForward || this.moveBackward)
      this.velocity.z -= this.direction.z * currentSpeed * delta;
    if (this.moveLeft || this.moveRight)
      this.velocity.x -= this.direction.x * currentSpeed * delta;

    let canMoveX = true;
    let canMoveZ = true;

    if (this.velocity.x !== 0) {
      const xDirection = new THREE.Vector3(this.velocity.x > 0 ? 1 : -1, 0, 0);
      xDirection.applyQuaternion(this.controls.yawObject.quaternion);
      canMoveX = this.isCrouching
        ? !this.checkCrouchCollision(xDirection)
        : !this.checkCollision(xDirection);
    }

    if (this.velocity.z !== 0) {
      const zDirection = new THREE.Vector3(0, 0, this.velocity.z > 0 ? 1 : -1);
      zDirection.applyQuaternion(this.controls.yawObject.quaternion);
      canMoveZ = this.isCrouching
        ? !this.checkCrouchCollision(zDirection)
        : !this.checkCollision(zDirection);
    }

    if (canMoveX) this.controls.yawObject.translateX(this.velocity.x * delta);
    else this.velocity.x = 0;
    if (canMoveZ) this.controls.yawObject.translateZ(this.velocity.z * delta);
    else this.velocity.z = 0;

    // Check for overhead collision before moving up
    if (this.velocity.y > 0 && this.checkOverheadCollision()) {
      this.velocity.y = 0; // Stop upward movement if hitting ceiling
    }

    this.controls.yawObject.position.y += this.velocity.y * delta;

    const landingHeight = this.checkTopCollision();
    if (landingHeight !== null && this.velocity.y <= 0) {
      this.controls.yawObject.position.y = landingHeight;
      this.velocity.y = 0;
      this.canJump = true;
      this.isJumping = false;
    } else if (
      this.controls.yawObject.position.y <= this.config.GROUND_HEIGHT
    ) {
      this.controls.yawObject.position.y = this.config.GROUND_HEIGHT;
      this.velocity.y = 0;
      this.canJump = true;
      this.isJumping = false;
    }
  }

  setPosition(x, y, z) {
    this.controls.yawObject.position.set(x, y, z);
  }

  getPosition() {
    return this.controls.yawObject.position.clone();
  }

  resetVelocity() {
    this.velocity.set(0, 0, 0);
  }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.initEyeHeights(); // keep eye heights in sync with new sizes
    // snap eye to correct state after config change
    this.controls.pitchObject.position.y = this.isCrouching
      ? this.eye.crouch
      : this.eye.stand;
  }

  getConfig() {
    return { ...this.config };
  }
}
