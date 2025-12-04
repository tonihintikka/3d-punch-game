const Hands = window.Hands;
const Camera = window.Camera;

export class HandTracker {
    constructor(videoElement, config) {
        this.videoElement = videoElement;
        this.config = config;
        this.onResultsCallback = null;
        this.hands = null;
        this.camera = null;
    }

    init() {
        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        this.hands.onResults((results) => {
            if (this.onResultsCallback) {
                this.onResultsCallback(results);
            }
        });

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => await this.hands.send({ image: this.videoElement }),
            width: this.config.width,
            height: this.config.height
        });
    }

    start() {
        return this.camera.start();
    }

    onResults(callback) {
        this.onResultsCallback = callback;
    }
}
