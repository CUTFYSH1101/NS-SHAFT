var html = document.documentElement  // html 元素
var body = document.body  // body 元素
window.setViewState = function(stateClass) {
    html.className = ''
    body.className = ''
    html.classList.add(stateClass)
    body.classList.add(stateClass)
    console.log('setViewState', stateClass)
}
window.getViewState = function() {
    return html.className
}