const joystick = document.querySelector('#joystick')
const knob = document.querySelector('#joystick > #knob')
joystickRadius = null
knobRadius = null
maxDistance = null
rect = null
centerX = null
centerY = null
joystickNormalizeX = 0

function initJoystick() {
    joystickRadius = Math.floor(joystick.offsetWidth * 0.5)
    knobRadius = Math.floor(knob.offsetWidth * 0.5)
    maxDistance = joystickRadius - knobRadius
    rect = joystick.getBoundingClientRect()  // 獲取容器的中心座標（相對於視窗）
    centerX = joystickRadius
    centerY = joystickRadius
}

// 載入以及更改畫面尺寸時
initJoystick()
window.addEventListener("resize", initJoystick)

function updateJoystick(touchX, touchY) {
    // 計算觸控點相對於容器中心的距離
    const relativeX = touchX - rect.left
    const relativeY = touchY - rect.top
    const deltaX = relativeX - centerX
    const deltaY = relativeY - centerY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // 限制移動範圍
    if (distance > maxDistance) {
        // 超出範圍，限制在圓周邊緣
        const angle = Math.atan2(deltaY, deltaX)
        knobX = centerX + Math.cos(angle) * maxDistance
        knobY = centerY + Math.sin(angle) * maxDistance
    } else {
        // 在允許範圍內，直接使用觸控點
        knobX = relativeX
        knobY = relativeY
    }

    knob.style.left = knobX + 'px'
    knob.style.top = knobY + 'px'

    joystickNormalizeX = (knobX - centerX) / maxDistance
    // game.player.pos.x += CONFIG.PLAYER_SPEED * normalizeX
}

function resetJoystick() {
    // 1. 將控制點移回中心位置
    const knob = document.querySelector('#joystick > #knob')
    knob.style.left = '50%'
    knob.style.top = '50%'

    joystickNormalizeX = 0

    // 3. 重置搖桿的內部狀態
    joystick.isActive = false
    joystick.currentX = 0
    joystick.currentY = 0
}

let isMouseDown = false

// 滑鼠按下
joystick.addEventListener('mousedown', (e) => {
    e.preventDefault()  // 禁止選取
    isMouseDown = true
    const touchX = e.clientX
    const touchY = e.clientY
    updateJoystick(touchX, touchY)
})

// 滑鼠移動
document.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
        e.preventDefault()  // 禁止選取
        const touchX = e.clientX
        const touchY = e.clientY
        updateJoystick(touchX, touchY)
    }
})

// 滑鼠放開
document.addEventListener('mouseup', () => {
    isMouseDown = false
    resetJoystick()
})

// 觸控開始
joystick.addEventListener('touchstart', (e) => {
    e.preventDefault() // 防止頁面滾動
    const touch = e.touches[0] // 取得第一個觸控點
    const touchX = touch.clientX
    const touchY = touch.clientY
    updateJoystick(touchX, touchY)
})

// 觸控移動
joystick.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const touchX = touch.clientX
    const touchY = touch.clientY
    updateJoystick(touchX, touchY)
})

// 觸控結束
joystick.addEventListener('touchend', (e) => {
    e.preventDefault()
    resetJoystick()
})

showJoystick = document.querySelector('#showJoystick')
showJoystick.onclick = () => {
    showJoystick.classList.toggle('show')
    joystick.classList.toggle('show')
}
