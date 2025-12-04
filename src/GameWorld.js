import * as THREE from 'three';
import { CONFIG } from './Config.js';

// Helper class for Particles
class Particle {
    constructor(scene, position, color, speed) {
        this.scene = scene;
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({ color: color, transparent: true })
        );
        this.mesh.position.copy(position);

        // Random direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        this.velocity = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).multiplyScalar(speed);

        this.life = 1.0;
        this.scene.add(this.mesh);
    }

    update(dt) {
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
        this.life -= dt * 2; // Fade out speed
        this.mesh.material.opacity = this.life;
        this.mesh.scale.setScalar(this.life);
        return this.life > 0;
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

export class GameWorld {
    constructor(canvasElement, onScoreUpdate) {
        this.canvasElement = canvasElement;
        this.onScoreUpdate = onScoreUpdate;

        // Globals within the class
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.handGroup = null;
        this.joints = [];
        this.bones = [];
        this.targetMesh = null;
        this.targetPivot = null;
        this.particles = [];

        this.lastHandPos = new THREE.Vector3();
        this.handVelocity = new THREE.Vector3();
        this.lastTime = 0;
        this.cameraShake = 0;

        // MediaPipe globals
        this.HAND_CONNECTIONS = window.HAND_CONNECTIONS;

        this.init();
    }

    init() {
        this.initThree();
        this.initGameObjects();
        this.initHandModel();

        // Bind animate to this context
        this.animate = this.animate.bind(this);
        this.animate(0);
    }

    initThree() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.scene.bgColor);
        this.scene.fog = new THREE.FogExp2(CONFIG.scene.bgColor, 0.05);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.z = 2;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvasElement, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        // Lighting
        const ambientLight = new THREE.AmbientLight(CONFIG.scene.ambientLight, CONFIG.scene.ambientIntensity);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(CONFIG.scene.dirLight, CONFIG.scene.dirIntensity);
        dirLight.position.set(2, 5, 5);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    initGameObjects() {
        // Target (Pendulum)
        this.targetPivot = new THREE.Group();
        this.targetPivot.position.set(0, 3, CONFIG.game.targetRestPos.z); // Pivot point high up
        this.scene.add(this.targetPivot);

        // Rope
        const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 3, 8);
        const ropeMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.position.y = -1.5; // Half length down
        rope.castShadow = true;
        this.targetPivot.add(rope);

        // Target Sphere
        const targetGeo = new THREE.SphereGeometry(CONFIG.game.targetRadius, 32, 32);
        const targetMat = new THREE.MeshPhysicalMaterial({
            color: CONFIG.game.targetColor,
            metalness: 0.2,
            roughness: 0.1,
            clearcoat: 1.0,
            emissive: 0x220000
        });
        this.targetMesh = new THREE.Mesh(targetGeo, targetMat);
        this.targetMesh.position.y = -3; // End of rope
        this.targetMesh.castShadow = true;
        this.targetMesh.receiveShadow = true;
        this.targetPivot.add(this.targetMesh);

        // Physics properties attached to pivot
        this.targetPivot.userData = {
            velocity: 0,
            angle: 0
        };
    }

    initHandModel() {
        this.handGroup = new THREE.Group();
        this.scene.add(this.handGroup);

        const jointMaterial = new THREE.MeshPhysicalMaterial({
            color: CONFIG.hand.jointColor,
            metalness: 0.5,
            roughness: 0.1
        });

        const jointGeo = new THREE.SphereGeometry(CONFIG.hand.jointSize, 16, 16);
        for (let i = 0; i < 21; i++) {
            const joint = new THREE.Mesh(jointGeo, jointMaterial);
            joint.castShadow = true;
            this.handGroup.add(joint);
            this.joints.push(joint);
        }
    }

    updateHandModel(landmarks) {
        this.handGroup.visible = true;

        // Update Joints
        let centerPos = new THREE.Vector3();

        landmarks.forEach((lm, i) => {
            const joint = this.joints[i];
            if (joint) {
                const x = (0.5 - lm.x) * 4;
                const y = (0.5 - lm.y) * 3;
                const z = -lm.z * 5;
                joint.position.set(x, y, z);

                // Calculate center of hand (approx)
                if (i === 9) { // Middle finger knuckle
                    centerPos.copy(joint.position);
                }
            }
        });

        // Calculate Velocity
        const currentTime = performance.now() / 1000;
        const dt = currentTime - this.lastTime;
        if (dt > 0) {
            this.handVelocity.subVectors(centerPos, this.lastHandPos).divideScalar(dt);
            this.lastHandPos.copy(centerPos);
            this.lastTime = currentTime;
        }

        // Check Collision
        this.checkCollision(centerPos);

        // Update Bones
        let boneIndex = 0;
        for (const connection of this.HAND_CONNECTIONS) {
            const start = this.joints[connection[0]].position;
            const end = this.joints[connection[1]].position;

            let bone = this.bones[boneIndex];
            if (!bone) {
                const boneGeo = new THREE.CylinderGeometry(CONFIG.hand.boneThickness, CONFIG.hand.boneThickness, 1, 8);
                const boneMat = new THREE.MeshPhysicalMaterial({
                    color: CONFIG.hand.boneColor,
                    metalness: 0.1,
                    roughness: 0.5,
                    transparent: true,
                    opacity: 0.8
                });
                bone = new THREE.Mesh(boneGeo, boneMat);
                this.handGroup.add(bone);
                this.bones.push(bone);
            }

            const distance = start.distanceTo(end);
            bone.scale.y = distance;
            bone.position.copy(start).add(end).multiplyScalar(0.5);
            bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
            bone.visible = true;
            boneIndex++;
        }
    }

    hideHand() {
        if (this.handGroup) {
            this.handGroup.visible = false;
        }
    }

    checkCollision() {
        // Get world position of target sphere
        const targetWorldPos = new THREE.Vector3();
        this.targetMesh.getWorldPosition(targetWorldPos);

        let hit = false;
        const hitThreshold = CONFIG.game.targetRadius + 0.05; // Slightly tighter

        // Check all joints for collision
        for (const joint of this.joints) {
            if (joint.position.distanceTo(targetWorldPos) < hitThreshold) {
                hit = true;
                break;
            }
        }

        if (hit) {
            const speed = this.handVelocity.length();

            // Only register hit if moving fast enough and moving TOWARDS target (roughly)
            // Also added a cooldown or check to prevent multiple hits in one swing potentially, 
            // but for now relying on velocity direction is a good start.
            if (speed > CONFIG.game.punchThreshold && this.handVelocity.z < 0) {
                // HIT!
                this.triggerHit(speed);
            }
        }
    }

    triggerHit(force) {
        // 1. Apply Physics to Pendulum
        // Add angular velocity based on force
        // Cap the force to prevent crazy spinning
        const effectiveForce = Math.min(force, 5.0);
        this.targetPivot.userData.velocity += effectiveForce * 0.8;

        // 2. Visual Effects
        // Camera Shake
        this.cameraShake = Math.min(effectiveForce * 0.1, 0.5);

        // Particles
        const targetWorldPos = new THREE.Vector3();
        this.targetMesh.getWorldPosition(targetWorldPos);
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(this.scene, targetWorldPos, 0xffaa00, effectiveForce * 0.5));
        }

        // Flash Target Color
        this.targetMesh.material.emissive.setHex(0xffffff);
        setTimeout(() => {
            this.targetMesh.material.emissive.setHex(0x220000);
        }, 100);

        // 3. Score
        const score = Math.min(Math.floor(effectiveForce * 100), 9999);
        if (this.onScoreUpdate) {
            this.onScoreUpdate(score);
        }
    }

    reset() {
        this.targetPivot.userData.velocity = 0;
        this.targetPivot.userData.angle = 0;
        this.targetPivot.rotation.x = 0;

        // Clear particles
        for (const p of this.particles) {
            p.dispose();
        }
        this.particles = [];
    }

    updatePhysics(dt) {
        // Pendulum Physics
        const gravity = 15; // Reduced gravity for more "floaty" feel
        const damping = 0.96; // More damping to stop it swinging forever

        const accel = -gravity * Math.sin(this.targetPivot.userData.angle) / 3; // length 3
        this.targetPivot.userData.velocity += accel * dt;
        this.targetPivot.userData.velocity *= damping;
        this.targetPivot.userData.angle += this.targetPivot.userData.velocity * dt;

        this.targetPivot.rotation.x = this.targetPivot.userData.angle;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate(time) {
        requestAnimationFrame(this.animate);

        const dt = 0.016; // Approx 60fps

        this.updatePhysics(dt);

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (!this.particles[i].update(dt)) {
                this.particles[i].dispose();
                this.particles.splice(i, 1);
            }
        }

        // Camera Shake
        if (this.cameraShake > 0) {
            this.camera.position.x = (Math.random() - 0.5) * this.cameraShake;
            this.camera.position.y = (Math.random() - 0.5) * this.cameraShake;
            this.cameraShake *= 0.9;
        } else {
            this.camera.position.set(0, 0, 2);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
