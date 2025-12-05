// joystick.js (ganti penuh)
const joy = document.getElementById('joy');
const knob = document.getElementById('knob');

// global input yang bisa diakses oleh game.js
window.joyInput = window.joyInput || { x: 0, y: 0, magnitude: 0, angleDeg: 0 };

let activePointerId = null;
let baseRect = null;
let maxRadius = null; // px

// ensure knob is centered initially
knob.style.left = '50%';
knob.style.top = '50%';
knob.style.transform = 'translate(-50%,-50%)';

// recompute bounding rect & radius
function updateRect() {
  baseRect = joy.getBoundingClientRect();
  maxRadius = Math.min(baseRect.width, baseRect.height) * 0.5 - 20; // leave padding
}
updateRect();
window.addEventListener('resize', updateRect);

// helper to apply offset relative to center while keeping center transform
function applyKnobOffset(dx, dy) {
  // keep central translate then apply pixel offset
  knob.style.transform = `translate(-50%,-50%) translate(${dx}px, ${dy}px)`;
}

// reset knob to center
function resetKnob() {
  knob.style.transform = 'translate(-50%,-50%)';
  window.joyInput.x = 0;
  window.joyInput.y = 0;
  window.joyInput.magnitude = 0;
  window.joyInput.angleDeg = 0;
}

// pointer math
function handlePointerMoveClient(clientX, clientY) {
  if (!baseRect) updateRect();

  const cx = baseRect.left + baseRect.width / 2;
  const cy = baseRect.top + baseRect.height / 2;

  let dx = clientX - cx;
  let dy = clientY - cy;

  // clamp to radius
  const dist = Math.hypot(dx, dy);
  if (dist > maxRadius) {
    const s = maxRadius / dist;
    dx *= s;
    dy *= s;
  }

  // normalized [-1..1]
  const nx = dx / maxRadius;
  const ny = dy / maxRadius;
  const mag = Math.min(1, Math.hypot(nx, ny));
  const angleRad = Math.atan2(ny, nx);
  const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;

  // set global input (used by game loop)
  window.joyInput.x = nx;
  window.joyInput.y = ny;
  window.joyInput.magnitude = mag;
  window.joyInput.angleDeg = angleDeg;

  // visual
  applyKnobOffset(dx, dy);
}

// pointer events
joy.addEventListener('pointerdown', (e) => {
  // only track single pointer
  if (activePointerId !== null) return;
  activePointerId = e.pointerId;
  joy.setPointerCapture(activePointerId);

  updateRect(); // recompute in case layout changed
  handlePointerMoveClient(e.clientX, e.clientY);

  e.preventDefault();
}, { passive: false });

window.addEventListener('pointermove', (e) => {
  if (activePointerId === null || e.pointerId !== activePointerId) return;
  handlePointerMoveClient(e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false });

window.addEventListener('pointerup', (e) => {
  if (activePointerId === null || e.pointerId !== activePointerId) return;
  try { joy.releasePointerCapture(activePointerId); } catch (_) {}
  activePointerId = null;
  resetKnob();
  e.preventDefault();
}, { passive: false });

window.addEventListener('pointercancel', (e) => {
  if (activePointerId === null || e.pointerId !== activePointerId) return;
  try { joy.releasePointerCapture(activePointerId); } catch (_) {}
  activePointerId = null;
  resetKnob();
});