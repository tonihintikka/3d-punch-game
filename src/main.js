import './style.css'
import * as THREE from 'three'

// MediaPipe globals
const Hands = window.Hands
const Camera = window.Camera
const HAND_CONNECTIONS = window.HAND_CONNECTIONS

// --- Configuration ---
const CONFIG = {
  camera: { width: 1280, height: 720 },
  scene: {
    bgColor: 0x0f0f13,
    ambientLight: 0xffffff,
    ambientIntensity: 0.5,
    dirLight: 0xffffff,
    dirIntensity: 1.0
  },
  hand: {
    jointColor: 0x646cff,
    boneColor: 0xffffff,
    jointSize: 0.025,
    boneThickness: 0.015
  },
  game: {
    targetRadius: 0.5,
    targetColor: 0xff0000, // Red
    targetRestPos: new THREE.Vector3(0, 0, -2), // Position in front of camera
    punchThreshold: 0.5, // Min velocity to trigger punch
    maxScore: 9999
  }
}

// --- Globals ---
let scene, camera, renderer
let handGroup
let joints = []
let bones = []
let targetMesh, targetPivot
let particles = []
let scoreElement
let lastHandPos = new THREE.Vector3()
let handVelocity = new THREE.Vector3()
let lastTime = 0
let cameraShake = 0

const videoElement = document.getElementById('input-video')
const canvasElement = document.getElementById('output-canvas')
const loadingScreen = document.getElementById('loading-screen')

// --- Classes ---

class Particle {
  constructor(position, color, speed) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: color, transparent: true })
    )
    this.mesh.position.copy(position)

    // Random direction
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI
    this.velocity = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ).multiplyScalar(speed)

    this.life = 1.0
    scene.add(this.mesh)
  }

  update(dt) {
    this.mesh.position.add(this.velocity.clone().multiplyScalar(dt))
    this.life -= dt * 2 // Fade out speed
    this.mesh.material.opacity = this.life
    this.mesh.scale.setScalar(this.life)
    return this.life > 0
  }

  dispose() {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}

// --- Initialization ---
function init() {
  initUI()
  initThree()
  initGameObjects()
  initHandModel()
  initMediaPipe()
  animate(0)
}

function initUI() {
  // Create Score Overlay
  const uiLayer = document.getElementById('ui-layer')
  scoreElement = document.createElement('div')
  scoreElement.id = 'score-display'
  scoreElement.style.position = 'absolute'
  scoreElement.style.top = '50%'
  scoreElement.style.left = '50%'
  scoreElement.style.transform = 'translate(-50%, -50%)'
  scoreElement.style.fontSize = '5rem'
  scoreElement.style.fontWeight = 'bold'
  scoreElement.style.color = 'rgba(255, 255, 255, 0.1)' // Faint initially
  scoreElement.style.pointerEvents = 'none'
  scoreElement.style.transition = 'all 0.1s ease-out'
  scoreElement.textContent = '0'
  uiLayer.appendChild(scoreElement)
}

function initThree() {
  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(CONFIG.scene.bgColor)
  scene.fog = new THREE.FogExp2(CONFIG.scene.bgColor, 0.05)

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.z = 2

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true

  // Lighting
  const ambientLight = new THREE.AmbientLight(CONFIG.scene.ambientLight, CONFIG.scene.ambientIntensity)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(CONFIG.scene.dirLight, CONFIG.scene.dirIntensity)
  dirLight.position.set(2, 5, 5)
  dirLight.castShadow = true
  scene.add(dirLight)

  window.addEventListener('resize', onWindowResize)
}

function initGameObjects() {
  // Target (Pendulum)
  // We create a pivot point at the top to simulate hanging
  targetPivot = new THREE.Group()
  targetPivot.position.set(0, 3, -2) // Pivot point high up
  scene.add(targetPivot)

  // Rope
  const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 3, 8)
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x888888 })
  const rope = new THREE.Mesh(ropeGeo, ropeMat)
  rope.position.y = -1.5 // Half length down
  rope.castShadow = true
  targetPivot.add(rope)

  // Target Sphere
  const targetGeo = new THREE.SphereGeometry(CONFIG.game.targetRadius, 32, 32)
  const targetMat = new THREE.MeshPhysicalMaterial({
    color: CONFIG.game.targetColor,
    metalness: 0.2,
    roughness: 0.1,
    clearcoat: 1.0,
    emissive: 0x220000
  })
  targetMesh = new THREE.Mesh(targetGeo, targetMat)
  targetMesh.position.y = -3 // End of rope
  targetMesh.castShadow = true
  targetMesh.receiveShadow = true
  targetPivot.add(targetMesh)

  // Physics properties attached to pivot
  targetPivot.userData = {
    velocity: 0,
    angle: 0
  }
}

function initHandModel() {
  handGroup = new THREE.Group()
  scene.add(handGroup)

  const jointMaterial = new THREE.MeshPhysicalMaterial({
    color: CONFIG.hand.jointColor,
    metalness: 0.5,
    roughness: 0.1
  })
  const boneMaterial = new THREE.MeshPhysicalMaterial({
    color: CONFIG.hand.boneColor,
    metalness: 0.1,
    roughness: 0.5,
    transparent: true,
    opacity: 0.8
  })

  const jointGeo = new THREE.SphereGeometry(CONFIG.hand.jointSize, 16, 16)
  for (let i = 0; i < 21; i++) {
    const joint = new THREE.Mesh(jointGeo, jointMaterial)
    joint.castShadow = true
    handGroup.add(joint)
    joints.push(joint)
  }
}

function initMediaPipe() {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  })
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })
  hands.onResults(onResults)

  const camera = new Camera(videoElement, {
    onFrame: async () => await hands.send({ image: videoElement }),
    width: CONFIG.camera.width,
    height: CONFIG.camera.height
  })

  camera.start()
    .then(() => {
      const p = loadingScreen.querySelector('p')
      if (p) p.textContent = 'Starting Hand Tracking...'
    })
    .catch(err => {
      console.error(err)
      const p = loadingScreen.querySelector('p')
      if (p) {
        p.textContent = 'Camera error. Please reload.'
        p.style.color = '#ff4444'
      }
    })
}

function onResults(results) {
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
    loadingScreen.classList.add('hidden')
  }

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handGroup.visible = true
    updateHandModel(results.multiHandLandmarks[0])
  } else {
    handGroup.visible = false
  }
}

function updateHandModel(landmarks) {
  // Update Joints
  let centerPos = new THREE.Vector3()

  landmarks.forEach((lm, i) => {
    const joint = joints[i]
    if (joint) {
      const x = (0.5 - lm.x) * 4
      const y = (0.5 - lm.y) * 3
      const z = -lm.z * 5
      joint.position.set(x, y, z)

      // Calculate center of hand (approx)
      if (i === 9) { // Middle finger knuckle
        centerPos.copy(joint.position)
      }
    }
  })

  // Calculate Velocity
  const currentTime = performance.now() / 1000
  const dt = currentTime - lastTime
  if (dt > 0) {
    handVelocity.subVectors(centerPos, lastHandPos).divideScalar(dt)
    lastHandPos.copy(centerPos)
    lastTime = currentTime
  }

  // Check Collision
  checkCollision(centerPos)

  // Update Bones (Simplified for brevity, reusing previous logic logic conceptually)
  // Re-implementing bone update to ensure it works
  let boneIndex = 0
  for (const connection of HAND_CONNECTIONS) {
    const start = joints[connection[0]].position
    const end = joints[connection[1]].position

    let bone = bones[boneIndex]
    if (!bone) {
      const boneGeo = new THREE.CylinderGeometry(CONFIG.hand.boneThickness, CONFIG.hand.boneThickness, 1, 8)
      const boneMat = new THREE.MeshPhysicalMaterial({ color: CONFIG.hand.boneColor })
      bone = new THREE.Mesh(boneGeo, boneMat)
      handGroup.add(bone)
      bones.push(bone)
    }

    const distance = start.distanceTo(end)
    bone.scale.y = distance
    bone.position.copy(start).add(end).multiplyScalar(0.5)
    bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())
    bone.visible = true
    boneIndex++
  }
}

function checkCollision(handPos) {
  // Get world position of target sphere
  const targetWorldPos = new THREE.Vector3()
  targetMesh.getWorldPosition(targetWorldPos)

  const dist = handPos.distanceTo(targetWorldPos)

  // Simple sphere collision
  if (dist < CONFIG.game.targetRadius + 0.1) { // +0.1 for hand size approx
    const speed = handVelocity.length()

    // Only register hit if moving fast enough and moving TOWARDS target (roughly)
    if (speed > CONFIG.game.punchThreshold && handVelocity.z < 0) {
      // HIT!
      triggerHit(speed)
    }
  }
}

function triggerHit(force) {
  // 1. Apply Physics to Pendulum
  // Add angular velocity based on force
  targetPivot.userData.velocity += force * 0.5

  // 2. Visual Effects
  // Camera Shake
  cameraShake = Math.min(force * 0.1, 0.5)

  // Particles
  const targetWorldPos = new THREE.Vector3()
  targetMesh.getWorldPosition(targetWorldPos)
  for (let i = 0; i < 20; i++) {
    particles.push(new Particle(targetWorldPos, 0xffaa00, force * 0.5))
  }

  // Flash Target Color
  targetMesh.material.emissive.setHex(0xffffff)
  setTimeout(() => {
    targetMesh.material.emissive.setHex(0x220000)
  }, 100)

  // 3. Score
  const score = Math.min(Math.floor(force * 100), 9999)
  scoreElement.textContent = score
  scoreElement.style.color = `hsl(${Math.max(0, 120 - score / 10)}, 100%, 50%)` // Green to Red
  scoreElement.style.transform = 'translate(-50%, -50%) scale(1.5)'
  scoreElement.style.opacity = '1'

  setTimeout(() => {
    scoreElement.style.transform = 'translate(-50%, -50%) scale(1)'
    scoreElement.style.opacity = '0.3'
  }, 200)
}

function updatePhysics(dt) {
  // Pendulum Physics
  const gravity = 20
  const damping = 0.98

  const accel = -gravity * Math.sin(targetPivot.userData.angle) / 3 // length 3
  targetPivot.userData.velocity += accel * dt
  targetPivot.userData.velocity *= damping
  targetPivot.userData.angle += targetPivot.userData.velocity * dt

  targetPivot.rotation.x = targetPivot.userData.angle
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate(time) {
  requestAnimationFrame(animate)

  const dt = 0.016 // Approx 60fps

  updatePhysics(dt)

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update(dt)) {
      particles[i].dispose()
      particles.splice(i, 1)
    }
  }

  // Camera Shake
  if (cameraShake > 0) {
    camera.position.x = (Math.random() - 0.5) * cameraShake
    camera.position.y = (Math.random() - 0.5) * cameraShake
    cameraShake *= 0.9
  } else {
    camera.position.set(0, 0, 2)
  }

  renderer.render(scene, camera)
}

// Start
init()
