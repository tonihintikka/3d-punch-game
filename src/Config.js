import * as THREE from 'three';

export const CONFIG = {
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
        targetRestPos: new THREE.Vector3(0, 0, -0.5), // Position in front of camera
        punchThreshold: 0.5, // Min velocity to trigger punch
        maxScore: 9999
    }
};
