import './style.css'
import { CONFIG } from './Config.js'
import { UI } from './UI.js'
import { HandTracker } from './HandTracker.js'
import { GameWorld } from './GameWorld.js'

const videoElement = document.getElementById('input-video')
const canvasElement = document.getElementById('output-canvas')

function init() {
  const ui = new UI()
  const gameWorld = new GameWorld(canvasElement, (score) => ui.updateScore(score))

  ui.onReset(() => {
    gameWorld.reset()
    ui.resetScore()
  })

  const handTracker = new HandTracker(videoElement, CONFIG.camera)
  handTracker.init()

  handTracker.onResults((results) => {
    ui.hideLoading()

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      gameWorld.updateHandModel(results.multiHandLandmarks[0])
    } else {
      gameWorld.hideHand()
    }
  })

  ui.setLoadingText('Starting Hand Tracking...')

  handTracker.start()
    .catch(err => {
      console.error(err)
      ui.setLoadingText('Camera error. Please reload.', true)
    })
}

init()
