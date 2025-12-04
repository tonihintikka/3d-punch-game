export class UI {
    constructor() {
        this.scoreElement = null;
        this.loadingScreen = document.getElementById('loading-screen');
        this.init();
    }

    init() {
        this.scoreElement = document.getElementById('score-display');
        this.resetBtn = document.getElementById('reset-btn');
        this.onResetCallback = null;

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => {
                if (this.onResetCallback) this.onResetCallback();
            });
        }
    }

    onReset(callback) {
        this.onResetCallback = callback;
    }

    updateScore(score) {
        if (!this.scoreElement) return;

        this.scoreElement.textContent = score;
        this.scoreElement.style.color = `hsl(${Math.max(0, 120 - score / 10)}, 100%, 50%)`; // Green to Red
        this.scoreElement.style.transform = 'scale(1.5)';
        this.scoreElement.style.opacity = '1';

        setTimeout(() => {
            this.scoreElement.style.transform = 'scale(1)';
            this.scoreElement.style.opacity = '1'; // Keep it visible but normal size
        }, 200);
    }

    resetScore() {
        if (this.scoreElement) {
            this.scoreElement.textContent = '0';
            this.scoreElement.style.color = 'rgba(255, 255, 255, 0.1)';
        }
    }

    setLoadingText(text, isError = false) {
        const p = this.loadingScreen.querySelector('p');
        if (p) {
            p.textContent = text;
            if (isError) {
                p.style.color = '#ff4444';
            }
        }
    }

    hideLoading() {
        if (this.loadingScreen && !this.loadingScreen.classList.contains('hidden')) {
            this.loadingScreen.classList.add('hidden');
        }
    }
}
