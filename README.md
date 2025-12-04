# 3D Punch Game

<video width="100%" controls poster="public/screenshot.png">
  <source src="public/demo.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

A web-based 3D hand tracking application built with **Three.js** and **MediaPipe Hands**. It features a "Punch Tester" game mode where users can interact with a physics-based pendulum target using their hands.

## Origin Story

The idea for this project started with a simple thought: "Could I make a demo where a webcam tracks hand movements?"

As I explored this, a second realization hit: "Wait, I could build this entirely with **Antigravity**."

This project is the result of that experiment—a fully functional, physics-based 3D interaction demo built with the help of an advanced AI agent.

## Features

- **Real-time Hand Tracking**: Uses MediaPipe Hands to track 21 hand landmarks in 3D space.
- **3D Visualization**: Renders a skeletal hand model (joints and bones) using Three.js.
- **Punch Tester Game**:
    - **Physics-based Target**: A red sphere suspended on a rope that reacts to impacts.
    - **Velocity Tracking**: Calculates hand velocity to detect punches.
    - **Visual Effects**: Particle explosions, camera shake, and dynamic score display upon impact.
- **Premium UI**: Dark-themed, glassmorphism-inspired user interface.

## Tech Stack

- **Vite**: Build tool and dev server.
- **Three.js**: 3D rendering engine.
- **MediaPipe Hands**: Machine learning for hand tracking (loaded via CDN).
- **Vanilla JavaScript**: Core logic (Modular ES6).

## Setup & Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
3.  **Open in Browser**:
    Navigate to `http://localhost:5173/`.
4.  **Allow Camera**: Grant camera permissions when prompted.

## Known Issues

- **Camera Permissions**: Ensure your browser allows camera access.
- **Lighting**: Hand tracking works best in well-lit environments.
