var {createApp} = Vue
var app = createApp({
    data() {
        return {
            items: [],
        }
    },
    methods: {
        formattedDate() {
            var today = new Date()
            var formattedDate = today.getFullYear() + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getDate()).padStart(2, '0')
            return formattedDate;
        },
        // 如果沒有任何人上榜，那就是第1名
        // 如果比最低分還低&&排行榜已有10名則放棄這次紀錄
        // 如果比最低分還低&&排行榜不滿10名，那就是倒數第一名
        // 如果排行榜長度大於等於10則插入到排行榜並刪除最後一位
        compareAndInset(newScore) {
            var formattedDate = this.formattedDate()

            // 如果沒有任何人上榜，那就是第1名
            if (!this.items || !this.items.length) {
                this.items.push({
                    rank: 1,
                    score: newScore,
                    date: formattedDate
                })
                return
            }

            var lowestScore = this.items[this.items.length - 1].score

            // 如果比最低分還低&&排行榜已有10名則放棄這次紀錄
            if (newScore < lowestScore && this.items.length >= 10)
                return

            // 如果比最低分還低&&排行榜不滿10名，那就是倒數第一名
            if (newScore < lowestScore && this.items.length < 10) {
                this.items.push({
                    rank: this.items.length + 1,
                    score: newScore,
                    date: formattedDate
                })
                return
            }

            // =================以下皆大於或等於最低分=================
            // 找到要插入的位置 rank+1
            var insetIndex = this.items.length  // 預設插入到最後
            for (let i = 0; i < this.items.length; i++)
                if (this.items[i].score <= newScore) {
                    insetIndex = i
                    break
                }

            // 插入新記錄
            this.items.splice(insetIndex, 0, {
                rank: insetIndex + 1,
                score: newScore,
                date: formattedDate
            })

            // 累計到最多第10名為止
            if (this.items.length > 10)
                this.items.pop()

            // 重新計算名次
            this.items.forEach((item, index) => item.rank = index + 1)
        },
        formattedScore(score) {
            var count = 0
            var newScoreText = ''
            var scoreText = String(score)
            for (let i = scoreText.length - 1; i >= 0; i--) {
                count++
                newScoreText = scoreText[i] + newScoreText
                if (count % 3 === 0 && i > 0) {
                    newScoreText = ',' + newScoreText
                }
            }
            return newScoreText
        }
        ,
    },
})
var vueInstance = app.mount('#app')


// 註冊事件並隱藏排行榜=========================================
var html = document.documentElement  // html 元素
var body = document.body  // body 元素
document.getElementById('showRecord').onclick = () => {
    toggleLeaderboard()
}
window.addEventListener("keydown", function (e) {
    if (e.key.toLowerCase() === 'l')
        toggleLeaderboard()
})
window.setViewState('body_when_gameStart')

function toggleLeaderboard() {
    // 顯示紀錄
    if (window.getViewState() !== 'body_when_gameRank') {
        // 遊戲進行中不要切換到排行榜
        if (window.game.playing && !window.game.keyStatus.paused)
            return
        window.setViewState('body_when_gameRank')
    }
    // 隱藏紀錄
    else {
        // 回到暫停畫面
        if (window.game.keyStatus.paused) {
            window.setViewState('body_when_gamePaused')
        }
        // 回到開始畫面
        else if (!window.game.playing) {
            window.setViewState('body_when_gameStart')
        }
    }
}

// ==========================================================

document.addEventListener('showRecordMethod', function (e) {
    vueInstance.compareAndInset(e.detail.level)
})
