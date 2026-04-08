// --- 音声生成 (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
// 心地よいペンタトニックスケール (ド、レ、ミ、ソ、ラ)
const pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
}

function playNote(x, y) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    // Y座標で音階を決定 (上が高い音)
    const index = Math.floor((1 - (y / window.innerHeight)) * pentatonicScale.length);
    const safeIndex = Math.max(0, Math.min(pentatonicScale.length - 1, index));
    const frequency = pentatonicScale[safeIndex];
    
    // X座標でパン振り(左右)
    const pan = (x / window.innerWidth) * 2 - 1;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // やわらかいサイン波
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // エンベロープ（音の減衰）
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05); // アタック
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0); // リリース
    
    osc.connect(gainNode);

    // パンの設定
    if (audioCtx.createStereoPanner) {
        const panner = audioCtx.createStereoPanner();
        panner.pan.value = pan;
        gainNode.connect(panner);
        panner.connect(audioCtx.destination);
    } else {
        gainNode.connect(audioCtx.destination);
    }
    
    osc.start();
    osc.stop(audioCtx.currentTime + 2.0);
}

// --- キャンバスとパーティクル ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let width, height;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// モード設定 (0: キラキラ, 1: ぽわぽわバブル)
let currentMode = 0;
const modeBtn = document.getElementById('mode-btn');

modeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMode = (currentMode + 1) % 2;
    modeBtn.textContent = currentMode === 0 ? '✨' : '💧';
});

class Particle {
    constructor(x, y, hue) {
        this.x = x;
        this.y = y;
        
        const angle = Math.random() * Math.PI * 2;
        // モードによるスピードの変化
        const speed = Math.random() * (currentMode === 0 ? 6 : 3) + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.hue = hue;
        this.life = 1.0;
        this.decay = Math.random() * 0.015 + 0.01;
        
        // モードによるサイズの変化
        this.size = currentMode === 0 ? (Math.random() * 10 + 5) : (Math.random() * 35 + 15);
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // 摩擦
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        // 重力(少し下に落ちる)
        this.vy += currentMode === 0 ? 0.08 : -0.02; // バブルモードは上にふわふわ
        
        this.life -= this.decay;
        // ※修正完了ポイント：サイズがマイナスにならないように安全装置を追加
        this.size = Math.max(0, this.size - 0.15);
    }
    
    draw() {
        if(this.life <= 0 || this.size <= 0) return; // ※安全装置
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        if (currentMode === 0) {
            // ✨ キラキラモード
            ctx.fillStyle = `hsla(${this.hue}, 100%, 65%, ${this.life})`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
        } else {
            // 💧 ぽわぽわバブルモード
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, `hsla(${this.hue}, 90%, 70%, ${this.life})`);
            gradient.addColorStop(1, `hsla(${this.hue}, 90%, 50%, 0)`);
            ctx.fillStyle = gradient;
            ctx.shadowBlur = 0;
        }
        
        ctx.fill();
    }
}

let particles = [];
let globalHue = 0;

// 入力ハンドリング
let isDrawing = false;
let touches = {};

function addParticles(x, y) {
    globalHue = (globalHue + 2) % 360; // 色がゆっくり変化する
    
    const count = currentMode === 0 ? 6 : 4;
    for(let i=0; i<count; i++) {
        // タッチ座標の周りにランダムにちりばめる
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        particles.push(new Particle(x + offsetX, y + offsetY, globalHue + (Math.random() * 40 - 20)));
    }
}

// マウスイベント
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    addParticles(e.clientX, e.clientY);
    playNote(e.clientX, e.clientY);
});
canvas.addEventListener('mousemove', (e) => {
    if(isDrawing) {
        addParticles(e.clientX, e.clientY);
        if(Math.random() > 0.92) playNote(e.clientX, e.clientY); // ドラッグ中もたまに音を鳴らす
    }
});
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseleave', () => isDrawing = false);

// タッチイベント (マルチタッチ対応)
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        touches[t.identifier] = {x: t.clientX, y: t.clientY};
        addParticles(t.clientX, t.clientY);
        playNote(t.clientX, t.clientY);
    }
}, {passive: false});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for(let i=0; i<e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if(touches[t.identifier]) {
             const dx = t.clientX - touches[t.identifier].x;
             const dy = t.clientY - touches[t.identifier].y;
             // 一定距離動いたら音を鳴らす（鳴りすぎ防止）
             if(Math.sqrt(dx*dx + dy*dy) > 30) {
                 if(Math.random() > 0.7) playNote(t.clientX, t.clientY);
                 touches[t.identifier] = {x: t.clientX, y: t.clientY};
             }
        }
        addParticles(t.clientX, t.clientY);
    }
}, {passive: false});

canvas.addEventListener('touchend', (e) => {
    for(let i=0; i<e.changedTouches.length; i++) {
        delete touches[e.changedTouches[i].identifier];
    }
});
canvas.addEventListener('touchcancel', (e) => {
    for(let i=0; i<e.changedTouches.length; i++) {
        delete touches[e.changedTouches[i].identifier];
    }
});

// アニメーションループ
function animate() {
    // 軌跡を残す（残像効果）
    if (currentMode === 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(5, 5, 16, 0.25)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter'; // 光るブレンド
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(5, 5, 16, 0.35)'; // バブルは少し残像短め
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'screen'; // やわらかいブレンド
    }
    
    for(let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        
        if(particles[i].life <= 0 || particles[i].size <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // 何もしていない時でも少しだけパーティクルを出して「生きている」感を出す
    if(particles.length < 10 && Math.random() < 0.05) {
        globalHue = (globalHue + 1) % 360;
        particles.push(new Particle(Math.random() * width, Math.random() * height, globalHue));
    }
    
    requestAnimationFrame(animate);
}

// 開始ボタンの処理
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-overlay').classList.add('hidden');
    initAudio();
    if(audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    // オープニング演出
    setTimeout(() => {
        const cx = width / 2;
        const cy = height / 2;
        for(let i=0; i<30; i++) {
            particles.push(new Particle(cx, cy, Math.random() * 360));
        }
        playNote(cx, cy);
    }, 300);
});

animate();
