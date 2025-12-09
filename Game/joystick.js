let joy = document.getElementById("joy");
let knob = document.getElementById("knob");

let joyRect = null;
let touchId = null;
window.joyInput = { x:0, y:0 };

joy.addEventListener("touchstart", e => {
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    joyRect = joy.getBoundingClientRect();
});

joy.addEventListener("touchmove", e => {
    if (touchId === null) return;
    for (let t of e.changedTouches) {
        if (t.identifier === touchId) {
            let dx = t.clientX - (joyRect.left + joyRect.width/2);
            let dy = t.clientY - (joyRect.top + joyRect.height/2);

            const max = 60;
            const dist = Math.hypot(dx, dy);
            if (dist > max) {
                dx = dx/dist * max;
                dy = dy/dist * max;
            }

            knob.style.transform =
                `translate(${dx}px, ${dy}px)`;

            window.joyInput.x = dx/60;
            window.joyInput.y = dy/60;
        }
    }
});

joy.addEventListener("touchend", e => {
    for (let t of e.changedTouches) {
        if (t.identifier === touchId) {
            touchId = null;
            knob.style.transform = "translate(-50%, -50%)";
            window.joyInput = {x:0,y:0};
        }
    }
});