# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **UI Enhancements**:
    - Added "Reset Target" button to stop the pendulum.
    - Improved Score display with HTML/CSS for better scaling and visibility.
- **Physics Tuning**:
    - Improved collision detection to check against all hand joints, not just the center.
    - Tuned gravity and damping for a more realistic pendulum feel.
    - Added velocity threshold to ensure only "punches" register as hits.
- **Architecture**:
    - Refactored monolithic `main.js` into modular components:
        - `HandTracker.js`: MediaPipe integration.
        - `GameWorld.js`: Three.js scene and physics.
        - `UI.js`: DOM manipulation.
        - `Config.js`: Centralized constants.

### Fixed
- **Crash**: Fixed a runtime error where `HandTracker.init()` was not called.
- **Gameplay**: Fixed issue where target was too far away (`z=-2`) by moving it closer (`z=-0.5`).

### Changed
- **Documentation**: Updated README with origin story and project details.
