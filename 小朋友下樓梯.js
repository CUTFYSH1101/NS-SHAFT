var time = 0

var controls = {
    value: 1,
}
var gui = new dat.GUI()
gui
    .add(controls, "value", 1, 2.5)
    .step(0.5)
    .name('遊戲難度')
    .onChange(function (value) {
        adjustDifficulty(value)
        controls.value = difficulty
    })

// 音效
class SoundManager {
    arePlaying = []

    mute(open = true) {
        if (open) {
            this.volume('bgm', 0)
            this.volume('conveyorBelt', 0)
            this.volume('hurt', 0)
            this.volume('dead', 0)
            this.volume('normal', 0)
            this.volume('jump', 0)
        } else {
            this.volume('bgm', 0.5)
            this.volume('conveyorBelt', 0.2)
            this.volume('hurt', 0.5)
            this.volume('dead', 0.6)
            this.volume('normal', 0.4)
            this.volume('jump', 0.6)
        }
    }

    playSound(id) {
        let element = document.getElementById(id)
        element.currentTime = 0
        element.play()
    }

    volume(id, value) {
        document.getElementById(id).volume = value
    }

    pause(id) {
        document.getElementById(id).pause()
    }

    pauseAllWithoutBgm(paused = true) {
        let sounds = ['normal', 'jump', 'conveyorBelt', 'hurt', 'dead']
        if (paused) {
            this.arePlaying = []
            for (let i = 0; i < sounds.length; i++) {
                this.arePlaying.push(this.isPlaying(sounds[i]))
                this.pause(sounds[i])
            }
        } else if (this.arePlaying.length > 0) {
            for (let i = 0; i < this.arePlaying.length; i++) {
                if (this.arePlaying[i])
                    document.getElementById(sounds[i]).play()  // 從中斷點繼續播放
            }
            this.arePlaying = []  // 避免用到舊的數據
        }
    }

    isPlaying(id) {
        let sound = document.getElementById(id)
        return !sound.paused && sound.currentTime > 0 && !sound.ended
    }

    backToStart(id) {
        document.getElementById(id).currentTime = 0
    }
}

// 全域設定與常數
const CONFIG = {
    BG_COLOR: '#0f2d48',                // 背景顏色是黑色
    STAIR_SLIDE_COLOR: '#ff6b6b',
    PLAYER_BODY_COLOR: '#45b7b5',
    TEXT_COLOR: '#00ced1',
    STAIR_HURT_COLOR: '#b0ffbd',
    STAIR_JUMP_COLOR: '#4bc6bf',
    STAIR_NORMAL_COLOR: '#4bc6bf',
    STAIR_FADE_COLOR: 'rgba(75, 198, 191, 0.4)',
    OUTLINE_BACKGROUND_COLOR: '#000517',
    OUTLINE_STROKE_COLOR: '#60afa8',
    UPDATE_FPS: 30,                     // 每秒幾幀
    SHOW_MOUSE: true,                   // 顯示游標
    GAME_WIDTH: 700,                    // 遊戲視窗寬度
    GRAVITY: 0.8,                       // 角色往下掉的重力單位
    PLAYER_SPEED: 10,                   // 角色操作左右移動時的速度單位
    STAIR_JUMP_SPEED: -15,              // 跳跳梯給玩家的速度
    INITIAL_STAIR_JUMP_SPEED: -15,
    STAIR_STEP_OFFSET: 20,
    STAIR_SPAWN_INTERVAL: 20,           // 遊戲進行中，間隔20幀(2/3秒)一個，相當於間隔每100px一個
    INITIAL_STAIR_SPAWN_INTERVAL: 20,
    INITIAL_STAIR_SPACING: 100,         // 遊戲剛開始生成的階梯，間隔每100px一個
    STAIRS_PER_DIFFICULTY_INCREASE: 30,
    INITIAL_STAIR_VELOCITY: -5         // 階梯預設往上跑
}

// -----------------------------------------
// Vec2

class Vec2 {
    constructor(x, y) {
        this.x = x
        this.y = y
    }

    set(x, y) {
        this.x = x
        this.y = y
    }

    move(x, y) {
        this.x += x
        this.y += y
    }

    add(vec) {
        return new Vec2(this.x + vec.x, this.y + vec.y)
    }

    sub(vec) {
        return new Vec2(this.x - vec.x, this.y - vec.y)
    }

    mul(scalar) {
        return new Vec2(this.x * scalar, this.y * scalar)
    }

    get length() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    set length(length) {
        this.set(this.mul(length / this.length))
    }

    clone() {
        return new Vec2(this.x, this.y)
    }

    toString() {
        return `(${this.x}, ${this.y}),)`
    }

    equals(v) {
        return this.x === v.x && this.y === v.y
    }

    get angle() {
        return Math.atan2(this.y, this.x)
    }
}

// 難度調整
var difficulty = 1

function addDifficulty() {
    if (difficulty >= 2.5) return  // 難度範圍[1, 1.5, 2, 2.5]
    difficulty += 0.5
    adjustDifficulty(difficulty)
}

function adjustDifficulty(value) {
    // 難度範圍[1,1,5,2,2.5]
    if (value < 1) value = 1
    if (value > 2.5) value = 2.5

    // 梯子生成速度、移動速度都會加快
    difficulty = value
    game.stairs.forEach(stair => stair.v.y = CONFIG.INITIAL_STAIR_VELOCITY * difficulty)
    CONFIG.STAIR_SPAWN_INTERVAL = CONFIG.INITIAL_STAIR_SPAWN_INTERVAL / difficulty
    time = 0 // 避免Stairs不生成
    CONFIG.STAIR_JUMP_SPEED = CONFIG.INITIAL_STAIR_JUMP_SPEED - 3 * (difficulty - 1)

    // 玩家移動速度變快
    CONFIG.PLAYER_SPEED = 10 * difficulty
}

// 遊戲
class Game {
    constructor() {
        this.player = null
        this.stairs = []
        this.width = CONFIG.GAME_WIDTH
        this.height = windowHeight
        this.stairTypes = [
            'normal',
            'jump',
            'slideLeft',
            'slideRight',
            'hurt',
            'fade',
        ]
        this.hurt = 0
        this.playing = false
        this.keyStatus = {
            left: false,
            right: false,
            paused: false,
        }
        this.level = 0
        this.stairSpawnTimer = 0
        this.lastDifficultyAdjustedLevel = -1  // 記錄上次調整難度的層數
    }

    init() {
        this.drawStairs()
        this.drawPlayerInMiddle()
        console.log('game started')
    }

    drawPlayerInMiddle() {
        this.player = new Player({
            pos: new Vec2(CONFIG.GAME_WIDTH / 2, 200),
        })
    }

    drawStairs() {
        // 遊戲剛開始生成的階梯間隔每150單位一個
        this.stairs = []

        // 一開始生成時不要生成地刺或fade
        let types = this.stairTypes.filter(type => type !== 'fade' && type !== 'hurt')
        for (let i = 0; i < windowHeight / CONFIG.INITIAL_STAIR_SPACING; i++) {
            this.stairs.push(new Stair({
                // 0~700, 100~
                pos: new Vec2(Math.random() * CONFIG.GAME_WIDTH, i * CONFIG.INITIAL_STAIR_SPACING + 100),
                type: randomSelect(types),
            }))
        }
    }


    update() {
        if (!this.playing) return
        if (this.keyStatus.paused) return

        // 每30層調整一次難度
        if (this.level % 30 === 0 && this.level > 1
            && this.lastDifficultyAdjustedLevel !== this.level) {
            this.lastDifficultyAdjustedLevel = this.level
            addDifficulty()
            controls.value = difficulty
            gui.updateDisplay()
        }

        this.spawnStairs()                                           // 生成階梯
        this.stairs = this.stairs.filter(stair => stair.active) // 拋棄超過螢幕範圍的階梯
        this.stairs.forEach(stair => stair.update())            // 梯子移動

        this.playerHorizontalMovement()                             // 操作玩家左右移動
        this.hurtOnTop()                                            // 碰到上方尖刺會先受傷
        this.keepPlayerInBounds()                                   // 上/左/右限制玩家在界內
        this.checkPlayerTouchStairs()                               // 呼叫step方法
        this.checkPlayerTouchBottom()                               // 玩家掉出視窗外，呼叫gameOver
        this.player.update()                                        // 玩家移動
    }

    // 操作玩家左右移動
    playerHorizontalMovement() {
        if (typeof joystickNormalizeX !== 'undefined' && joystickNormalizeX !== 0)
            this.player.pos.x += CONFIG.PLAYER_SPEED * joystickNormalizeX
        else if (this.keyStatus.left)
            this.player.pos.x -= CONFIG.PLAYER_SPEED
        else if (this.keyStatus.right)
            this.player.pos.x += CONFIG.PLAYER_SPEED
    }

    // 碰到上方尖刺會先受傷
    hurtOnTop() {
        if (this.player.pos.y - this.player.height < 30) {
            if (this.hurt === 0) {  // 搭配TweenMax最快每隔0.5秒再受傷一次
                this.player.addBlood(-4)
                hurtEffect()
            }
        }
    }

    // 上/左/右限制玩家在界內
    keepPlayerInBounds() {
        if (this.player.pos.y - this.player.height < 30) {
            this.player.pos.y = this.player.height + 30   // 不超出邊界
            this.player.v.y = 5  // 把玩家往下彈
        }
        if (this.player.pos.x - this.player.width / 2 < 0) {
            this.player.pos.x = this.player.width / 2
        }
        if (this.player.pos.x + this.player.width / 2 > CONFIG.GAME_WIDTH) {
            this.player.pos.x = CONFIG.GAME_WIDTH - this.player.width / 2
        }
    }

    // 呼叫step方法
    checkPlayerTouchStairs() {
        let player = this.player
        let touching = false
        this.stairs.forEach(stair => {
            let playerLeft = player.pos.x - player.width / 2
            let stairRight = stair.pos.x + stair.width / 2
            let playerRight = player.pos.x + player.width / 2
            let stairLeft = stair.pos.x - stair.width / 2
            let diffY = Math.abs(player.pos.y - stair.pos.y)
            if (playerLeft < stairRight &&
                playerRight > stairLeft &&
                player.pos.y > stair.pos.y &&
                diffY < stair.height + CONFIG.STAIR_STEP_OFFSET) {
                touching = true
                stair.step(player)
                player.lastStair = stair
            }
        })
        if (!touching) {
            player.lastStair = null
            soundManager.pause('conveyorBelt')
        }
    }

    // 生成階梯
    spawnStairs() {
        this.stairSpawnTimer++

        // 每隔30個單位時間重新產生
        if (this.stairSpawnTimer >= CONFIG.STAIR_SPAWN_INTERVAL) {
            this.stairSpawnTimer = 0

            // 避免連續兩個fade、hurt梯子
            let type = randomSelect(this.stairTypes)
            while (type === 'fade' || type === 'hurt') {
                if (this.stairs[this.stairs.length - 1].type === type)
                    type = randomSelect(this.stairTypes)
                else break
            }

            // 倒數5個梯子內不能有3個以上重複
            while (true) {
                let arr = this.stairs.slice(-5)
                if (arr.filter(stair => stair.type === type).length >= 2)
                    type = randomSelect(this.stairTypes)
                else break
            }

            // 倒數5個梯子內不能有4個以上都靠在右側或是靠在左側
            let x = Math.random() * CONFIG.GAME_WIDTH
            let arr = this.stairs.slice(-5)
            if (x > CONFIG.GAME_WIDTH / 2
                && arr.filter(stair => stair.pos.x > CONFIG.GAME_WIDTH / 2).length >= 3)
                x = Math.random() * CONFIG.GAME_WIDTH / 2  // 強制生成左邊
            else if (x < CONFIG.GAME_WIDTH / 2
                && arr.filter(stair => stair.pos.x < CONFIG.GAME_WIDTH / 2).length >= 3)
                x = Math.random() * CONFIG.GAME_WIDTH / 2 + CONFIG.GAME_WIDTH / 2  // 強制生成右邊

            this.stairs.push(new Stair({
                // 0~700, 100~
                pos: new Vec2(x, this.height),  // 在畫面外生成
                type: type
            }))
            this.level++
        }
    }

    // 玩家掉出視窗外，呼叫gameOver
    checkPlayerTouchBottom() {
        if (this.player.pos.y - this.player.height > this.height)
            this.gameOver()
    }


    draw() {
        ctx.save()
        ctx.translate((windowWidth - CONFIG.GAME_WIDTH) / 2, 0)    // 遊戲畫面置中
        this.player.draw()
        this.stairs.forEach(stair => stair.draw())
        this.drawTopHurt()                                  // 上方尖刺形狀
        this.drawBounds()                                   // 遊戲邊界
        this.drawHurtEffect()                               // hurt紅螢幕特效
        this.drawScore()                                    // 地下幾層
        ctx.restore()
    }

    // 遊戲邊界
    drawBounds() {
        // 白色邊界
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, windowHeight)
        ctx.moveTo(CONFIG.GAME_WIDTH, 0)
        ctx.lineTo(CONFIG.GAME_WIDTH, windowHeight)
        ctx.lineWidth = 10
        ctx.strokeStyle = CONFIG.OUTLINE_STROKE_COLOR
        ctx.stroke()

        // 超出範圍隱藏
        ctx.fillStyle = CONFIG.OUTLINE_BACKGROUND_COLOR
        ctx.fillRect(-(windowWidth / 2 - CONFIG.GAME_WIDTH / 2), 0, (windowWidth - CONFIG.GAME_WIDTH) / 2, windowHeight)
        ctx.fillRect(CONFIG.GAME_WIDTH, 0, (windowWidth - CONFIG.GAME_WIDTH) / 2, windowHeight)
    }

    // 上方尖刺形狀，※遊戲畫面為700單位，取該值的因數
    drawTopHurt() {
        let count = 70
        let gap = CONFIG.GAME_WIDTH / count
        let height = 30
        ctx.beginPath()
        ctx.moveTo(0, 0)
        for (let i = 0; i * gap <= CONFIG.GAME_WIDTH + gap; i++)
            ctx.lineTo(i * gap, (i % 2) * height)
        ctx.lineTo(CONFIG.GAME_WIDTH, 0)
        ctx.closePath()
        ctx.fillStyle = CONFIG.STAIR_HURT_COLOR
        ctx.fill()
    }

    // hurt紅螢幕特效
    drawHurtEffect() {
        ctx.fillStyle = `rgba(255, 0, 0, ${this.hurt})`
        ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, this.height)
    }

    // 地下幾層
    drawScore() {
        ctx.fillStyle = CONFIG.TEXT_COLOR
        ctx.font = '36px Arial, sans-serif'
        blur(CONFIG.TEXT_COLOR, 3)
        ctx.fillText(`地下 ${this.level} 階`, 20, 120)
    }

    start() {
        this.init()
        this.playing = true
        this.level = 0
        time = 0
        adjustDifficulty(1)
        controls.value = difficulty
        gui.updateDisplay()

        window.setViewState('body_when_gamePlaying')
        soundManager.backToStart('bgm')
        soundManager.playSound('bgm')
        $('#bgm').attr('loop', true)  // 循環播放
    }

    gameOver() {
        this.playing = false
        window.setViewState('body_when_gameStart')
        soundManager.playSound('dead')
        document.dispatchEvent(new CustomEvent('showRecordMethod', {
            detail: {level: this.level}
        }))
    }
}

function randomSelect(selections) {
    let randomIndex = Math.floor(
        Math.random() * selections.length
    )
    return selections[randomIndex]
}

function hurtEffect() {
    game.hurt = 1
    TweenMax.to(game, 0.5, {hurt: 0})
    soundManager.playSound("hurt")
}

// Stair 梯子
class Stair {
    constructor(args) {
        let default_ = {
            pos: new Vec2(0, 0),
            v: new Vec2(0, CONFIG.INITIAL_STAIR_VELOCITY * difficulty), // 預設往上跑
            a: new Vec2(0, 0),
            width: 150,
            height: 20,
            extraHeight: 0,  // 彈跳階梯
            type: 'normal',
            active: true,  // 階梯是否超出視窗外
        }
        // args -> default -> this
        Object.assign(default_, args)
        Object.assign(this, default_)
    }


    update() {
        // 難度[2,2.5]時梯子會左右亂動，2.5時亂動更快
        if (difficulty === 2)
            this.a.x = Math.floor(Math.random() * 2) === 1 ? -0.1 : 0.1
        if (difficulty === 2.5)
            this.a.x = Math.floor(Math.random() * 2) === 1 ? -0.2 : 0.2

        this.v = this.v.add(this.a)
        this.pos = this.pos.add(this.v)
        if (this.pos.y < -20)
            this.active = false
    }

    draw() {
        ctx.save()
        ctx.translate(this.pos.x - this.width / 2, this.pos.y - this.extraHeight)
        this.drawBottom()
        this.drawFade()
        this.drawJump()
        this.drawHurt()
        this.drawSlide()
        ctx.restore()
    }

    drawBottom() {
        ctx.fillStyle = CONFIG.STAIR_NORMAL_COLOR
        if (this.type === 'normal')  // 只有刺刺和普通的有底板
            ctx.fillRect(0, 0, this.width, this.height / 2)  // 相對x,y座標,寬,高
    }

    drawFade() {
        if (this.type === 'fade') {
            ctx.fillStyle = CONFIG.STAIR_FADE_COLOR
            ctx.fillRect(0, 0, this.width, this.height)
        }
    }

    drawJump() {
        if (this.type === 'jump') {
            ctx.beginPath()
            ctx.rect(0, 0, this.width, 5)
            ctx.rect(0, this.height + this.extraHeight, this.width, 5)
            ctx.fillStyle = CONFIG.STAIR_JUMP_COLOR
            ctx.fill()
        }
    }

    // ※梯子寬度160單位，取該值的因數
    drawHurt() {
        if (this.type === 'hurt') {
            let count = 16
            let gap = this.width / count  // 160/16 = 10
            let height = 15
            ctx.beginPath()
            ctx.moveTo(0, 0)
            for (let i = 0; i <= count; i++)  // [0,count]
                ctx.lineTo(i * gap, -(i % 2) * height)
            ctx.lineTo(this.width, 0)
            ctx.closePath()
            ctx.fillStyle = CONFIG.STAIR_HURT_COLOR
            ctx.fill()
            ctx.fillRect(0, 0, this.width, this.height / 2)  // 繪製底板
        }
    }

    drawSlide() {
        if (this.type === 'slideLeft' || this.type === 'slideRight') {
            let dir = this.type === 'slideRight' ? 1 : -1
            let gap = 20
            let width = 10
            let x = 0
            ctx.fillStyle = CONFIG.STAIR_SLIDE_COLOR
            for (let i = 0; x <= this.width; i++) {
                x = i * gap + time % gap * dir
                width = 10
                if (x + width > this.width) {  // 右方塊
                    width = this.width - x
                    if (width < 0) width = 0
                } else if (i === 0 && x < 0) { // 左方塊消失
                    width += x
                    x = 0
                    if (width < 0) width = 0
                } else if (i === 0 && x > gap - width) {  // 左方塊出現
                    this.fillRect(0, x - (gap - width), dir)
                }
                this.fillRect(x, width, dir)
            }
        }
    }

    fillRect(x, width, dir) {
        ctx.save()
        ctx.transform(1, 0, 0.5 * dir, 1, 0, 0)
        ctx.fillRect(x, 0, width, this.height)
        ctx.restore()
    }

    step(player) {
        // 下一幀 update() 時，重力 a = Vec2(0, 0.8) 會讓玩家繼續下落
        player.v.y = 0

        if (this.type !== 'fade')
            player.pos.y = this.pos.y

        if (this.type === "slideLeft") player.pos.x -= 3
        if (this.type === "slideRight") player.pos.x += 3
        if (this.type === "fade") player.v.y -= 3   // 在fade上每幀向上移動2.2單位 (0.8-3)

        // 只有第一次碰到才執行
        if (player.lastStair !== this) {
            if (this.type === "jump") {
                player.v.y = CONFIG.STAIR_JUMP_SPEED  // 跳高一點
                this.extraHeight = 10
                TweenMax.to(this, 0.2, {extraHeight: 0})
            }

            if (this.type === 'hurt') {
                player.addBlood(-4)
                hurtEffect()
            } else
                player.addBlood(1)  // 除了hurt以外踩到其他梯子都回血

            if (this.type === 'normal')
                soundManager.playSound('normal')
            if (this.type === 'jump')
                soundManager.playSound('jump')
            if (this.type === 'slideLeft' || this.type === 'slideRight') {
                soundManager.backToStart('conveyorBelt')
                soundManager.playSound('conveyorBelt')
            }
        }
    }
}

// Player 玩家
class Player {
    constructor(args) {
        let default_ = {
            pos: new Vec2(0, 0),
            v: new Vec2(0, 0),
            a: new Vec2(0, CONFIG.GRAVITY),
            width: 40,
            height: 55,
            lastStair: null,
            blood: 10,
            maxBlood: 10,
        }
        // args -> default -> this
        Object.assign(default_, args)
        Object.assign(this, default_)
    }

    update() {
        this.v = this.v.add(this.a)
        this.pos = this.pos.add(this.v)
    }

    draw() {
        ctx.save()
        {
            var bodyColor = 'rgb(0, 206, 209)'

            ctx.translate(this.pos.x, this.pos.y)

            // body
            blur(CONFIG.PLAYER_BODY_COLOR, 3)
            ctx.fillStyle = CONFIG.PLAYER_BODY_COLOR
            ctx.fillRect(-this.width / 2, -this.height, this.width, this.height)

            // eyes
            ctx.beginPath()
            ctx.circle(new Vec2(-8, -40), 5)
            ctx.circle(new Vec2(8, -40), 5)
            ctx.fillStyle = 'white'
            ctx.fill()

            ctx.beginPath()
            ctx.circle(new Vec2(-8, -40), 3)
            ctx.circle(new Vec2(8, -40), 3)
            ctx.fillStyle = 'black'
            ctx.fill()

            // nose
            drawTriangle(-6, -34, 12, 16, 'yellow')

            // hand
            let v = this.v.y >= 2 ? this.v.y : 2  // 避免log後為負值
            ctx.save()
            {
                ctx.translate(this.width / 2, -40)
                ctx.rotate(-Math.log(v / 2))
                blur(CONFIG.PLAYER_BODY_COLOR, 3)
                ctx.fillStyle = CONFIG.PLAYER_BODY_COLOR
                ctx.fillRect(0, 0, 10, this.height / 2)
            }
            ctx.restore()

            ctx.save()
            {
                ctx.translate(-this.width / 2, -40)
                ctx.rotate(Math.log(v / 2))
                blur(CONFIG.PLAYER_BODY_COLOR, 3)
                ctx.fillStyle = CONFIG.PLAYER_BODY_COLOR
                ctx.fillRect(-10, 0, 10, this.height / 2)
            }
            ctx.restore()
        }
        ctx.restore()

        this.drawBlood()
    }

    drawBlood() {
        let gap = 20
        let width = 10
        let height = 30
        ctx.save()
        ctx.translate(20, 40)
        ctx.fillStyle = CONFIG.STAIR_SLIDE_COLOR
        blur(CONFIG.STAIR_SLIDE_COLOR, 3)
        for (let i = 0; i < this.maxBlood; i++) {
            if (i >= this.blood)
                ctx.fillStyle = 'gray'
            ctx.fillRect(i * gap, 0, width, height)
        }
        ctx.restore()
    }

    addBlood(append) {
        this.blood += append
        if (this.blood > this.maxBlood)
            this.blood = this.maxBlood
        else if (this.blood < 0)
            this.blood = 0
        if (this.blood <= 0)
            game.gameOver()
    }
}

function drawTriangle(x, y, width, height, color) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + width, y)
    ctx.lineTo(x + width / 2, y + height)
    ctx.closePath()
    ctx.fill()
}

// 設定光暈效果
function blur(color, blur) {
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
}

// -----------------------------------------
// Canvas
var canvas = document.getElementById("myCanvas")
var ctx = canvas.getContext("2d")

ctx.circle = function (pos, radius) {
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
}
ctx.line = function (start, end) {
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
}
ctx.color = function (color) {
    ctx.fillStyle = color
    ctx.strokeStyle = color
}

function initCanvas() {
    windowWidth = canvas.width = window.innerWidth
    windowHeight = canvas.height = window.innerHeight

    // RWD。寬度不同於700時
    if (700 > windowWidth && windowWidth > 380)
        CONFIG.GAME_WIDTH = windowWidth
    else if (380 > windowWidth)
        CONFIG.GAME_WIDTH = 380
    else if (windowWidth > 700) CONFIG.GAME_WIDTH = 700

    // RWD。高度不同於700時
    let heightRatio = -1
    let maxHeight = 1500
    if (maxHeight > windowHeight && windowHeight > 380)
        heightRatio = windowHeight / 700
    else if (windowHeight > maxHeight)
        heightRatio = maxHeight / 700
    if (heightRatio > 0) {
        CONFIG.STAIR_SPAWN_INTERVAL = 20 * heightRatio
        CONFIG.INITIAL_STAIR_SPAWN_INTERVAL = 20 * heightRatio
        CONFIG.INITIAL_STAIR_SPACING = 100 * heightRatio
        CONFIG.INITIAL_STAIR_VELOCITY = -5 * heightRatio
        CONFIG.GRAVITY = 0.8 * heightRatio
        CONFIG.PLAYER_SPEED = 10 * heightRatio
        CONFIG.STAIR_JUMP_SPEED = -15 * heightRatio
        CONFIG.INITIAL_STAIR_JUMP_SPEED = -15 * heightRatio
        CONFIG.STAIR_STEP_OFFSET = 20 * heightRatio
    }
}

// 初始化
var game
var soundManager

function init() {
    game = new Game()
    game.init()
    soundManager = new SoundManager()
    soundManager.mute(false)  // 調整音量
    window.game = game
}

// 遊戲邏輯更新
function update() {
    time++
    game.update()
}

function crossArrow() {
    var l = 20
    ctx.fillStyle = "red"
    ctx.beginPath()
    ctx.circle(mousePos, 3)
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.strokeStyle = "red"
    ctx.translate(mousePos.x, mousePos.y)
    ctx.line(new Vec2(-l, 0), new Vec2(l, 0))
    ctx.fillText(mousePos.toString(), 5, -5)
    ctx.rotate(Math.PI / 2)
    ctx.line(new Vec2(-l, 0), new Vec2(l, 0))
    ctx.stroke()
    ctx.restore()
}

// 畫面更新
function draw() {
    // 清空背景
    ctx.fillStyle = CONFIG.BG_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // -----------------------------
    // 在這裡繪製
    game.draw()

    // -----------------------------
    crossArrow()

    requestAnimationFrame(draw)
}

// 頁面載入
function loaded() {
    console.log("loaded")

    initCanvas()
    init()
    requestAnimationFrame(draw)
    setInterval(update, 1000 / CONFIG.UPDATE_FPS)
}

// 載入&縮放事件
// 自定義的組裝器造成window.load已經執行完畢，不會呼叫它
// window.addEventListener('load', loaded)
loaded() // 改用這個
window.addEventListener("resize", initCanvas)

// -----------------------------------------
// 滑鼠事件跟紀錄
var mousePos = new Vec2(0, 0)
var mousePosUp = new Vec2(0, 0)
var mousePosDown = new Vec2(0, 0)

function mousemove(e) {
    mousePos.set(e.offsetX, e.offsetY)
}

function mouseup(e) {
    mousePos.set(e.offsetX, e.offsetY)
    mousePosUp = mousePos.clone()

    // 用滑鼠控制左右移動
    if (e.button === 0)
        game.keyStatus.left = false
    else if (e.button === 2)
        game.keyStatus.right = false
}

// 阻止整個頁面的右鍵選單
document.addEventListener('contextmenu', function (event) {
    event.preventDefault()
})

function mousedown(e) {
    mousePos.set(e.offsetX, e.offsetY)
    mousePosDown = mousePos.clone()

    // 用滑鼠控制左右移動
    if (e.button === 0)
        game.keyStatus.left = true
    else if (e.button === 2)
        game.keyStatus.right = true
    else if (e.button === 1)
        togglePause()
}

function keydown(e) {
    // 用鍵盤控制左右移動
    let left = ['a', 'A', 'ArrowLeft']
    let right = ['d', 'D', 'ArrowRight']
    if (left.includes(e.key))
        game.keyStatus.left = true
    if (right.includes(e.key))
        game.keyStatus.right = true

    // 用空白鍵暫停/繼續/開始遊戲
    if (e.key === ' ' && game.playing && window.getViewState() !== 'body_when_gameRank')
        togglePause()
    else if (e.key === ' ' && !game.playing && window.getViewState() === 'body_when_gameStart')
        game.start()
    else if (e.key.toLowerCase() === 'm') {
        muteControl.classList.toggle('mute')
        soundManager.mute(muteControl.classList.contains('mute'))  // 用是否顯示來判斷是否要靜音
    }
}

function togglePause() {
    game.keyStatus.paused = !game.keyStatus.paused
    soundManager.pauseAllWithoutBgm(game.keyStatus.paused)
    window.setViewState(
        game.keyStatus.paused
            ? 'body_when_gamePaused'
            : 'body_when_gamePlaying')
}

function keyup(e) {
    // 用鍵盤控制左右移動
    let left = ['a', 'A', 'ArrowLeft']
    let right = ['d', 'D', 'ArrowRight']
    if (left.includes(e.key))
        game.keyStatus.left = false
    if (right.includes(e.key))
        game.keyStatus.right = false
}

window.addEventListener("mousemove", mousemove)
window.addEventListener("mouseup", mouseup)
window.addEventListener("mousedown", mousedown)
window.addEventListener("keydown", keydown)
window.addEventListener("keyup", keyup)

// 用滑鼠控制開始/靜音與否/暫停
document.querySelector('#btnStart').onclick = () => game.start()
var muteControl = document.querySelector('#muteControl')
document.getElementById('mute').onclick = () => {
    muteControl.classList.toggle('mute')
    soundManager.mute(false)
}
document.getElementById('muteOff').onclick = () => {
    muteControl.classList.toggle('mute')
    soundManager.mute(true)
}

document.getElementById('panelPause').onclick = () => {
    window.setViewState('body_when_gamePlaying')
    game.keyStatus.paused = false
    soundManager.pauseAllWithoutBgm(false)
}
window.setViewState('body_when_gameStart')

var showRecordMethod = function () {}
