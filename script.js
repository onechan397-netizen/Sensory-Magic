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

// 嫌な音（黒板をひっかく音）を生成する関数
function playScreech(x, y) {
    const pan = (x / window.innerWidth) * 2 - 1;
    
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // 黒板を引っ掻くような不協和音と高い周波数
    const baseFreq = 2500 + Math.random() * 1500;
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq + 800, audioCtx.currentTime + 0.1);
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(baseFreq * 1.15, audioCtx.currentTime); // 不協和音
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.02); // 鋭い立ち上がり
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4); // すぐ消える
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);

    if (audioCtx.createStereoPanner) {
        const panner = audioCtx.createStereoPanner();
        panner.pan.value = pan;
        gainNode.connect(panner);
        panner.connect(audioCtx.destination);
    } else {
        gainNode.connect(audioCtx.destination);
    }
    
    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.5);
    osc2.stop(audioCtx.currentTime + 0.5);
}

function playNote(x, y) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    
    // モード2（釘モード）の時は嫌な音を鳴らす
    if (currentMode === 2) {
        playScreech(x, y);
        return;
    }
    
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

// モード設定 (0: キラキラ, 1: ぽわぽわバブル, 2: 釘/黒板ひっかき)
let currentMode = 0;
const modeBtn = document.getElementById('mode-btn');

modeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMode = (currentMode + 1) % 3; // 3種類で切り替え
    if (currentMode === 0) modeBtn.textContent = '✨';
    else if (currentMode === 1) modeBtn.textContent = '💧';
    else if (currentMode === 2) modeBtn.textContent = '📍'; // 釘モード
});

class Particle {
    constructor(x, y, hue) {
        this.x = x;
        this.y = y;
        
        const angle = Math.random() * Math.PI * 2;
        // モードによるスピードの変化
        let speed = Math.random() * (currentMode === 0 ? 6 : 3) + 1;
        if (currentMode === 2) speed = Math.random() * 8 + 2; // 釘モードは勢いよく飛ぶ
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.hue = hue;
        this.life = 1.0;
        this.decay = Math.random() * 0.015 + 0.01;
        
        // モードによるサイズの変化
        if (currentMode === 0) this.size = Math.random() * 10 + 5;
        else if (currentMode === 1) this.size = Math.random() * 35 + 15;
        else this.size = Math.random() * 5 + 2; // 釘モードは細かく鋭い破片
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // 摩擦
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        // 重力(少し下に落ちる)
        if (currentMode === 0) this.vy += 0.08;
        else if (currentMode === 1) this.vy += -0.02;
        else this.vy += 0.2; // 釘モードは破片が重く落ちる
        
        this.life -= this.decay;
        this.size = Math.max(0, this.size - 0.15);
    }
    
    draw() {
        if(this.life <= 0 || this.size <= 0) return;
        
        ctx.beginPath();
        
        if (currentMode === 0) {
            // ✨ キラキラモード
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 100%, 65%, ${this.life})`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsl(${this.hue}, 100%, 50%)`;
            ctx.fill();
        } else if (currentMode === 1) {
            // 💧 ぽわぽわバブルモード
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, `hsla(${this.hue}, 90%, 70%, ${this.life})`);
            gradient.addColorStop(1, `hsla(${this.hue}, 90%, 50%, 0)`);
            ctx.fillStyle = gradient;
            ctx.shadowBlur = 0;
            ctx.fill();
        } else {
            // 📍 釘・黒板ひっかきモード (チョークの粉や傷跡のような描写)
            ctx.fillStyle = `rgba(230, 240, 255, ${this.life})`;
            // 尖った四角形（破砕片）を描画
            ctx.fillRect(this.x, this.y, this.size * 0.5, this.size * 2);
            ctx.shadowBlur = 0;
        }
    }
}

let particles = [];
let globalHue = 0;

// 入力ハンドリング
let isDrawing = false;
let touches = {};

function addParticles(x, y) {
    globalHue = (globalHue + 2) % 360; 
    
    let count = currentMode === 0 ? 6 : 4;
    if (currentMode === 2) count = 10; // 釘モードはガリガリっと粉を多めに出す
    
    for(let i=0; i<count; i++) {
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
        if(Math.random() > 0.92) playNote(e.clientX, e.clientY); 
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
    if (currentMode === 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(5, 5, 16, 0.25)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter'; 
    } else if (currentMode === 1) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(5, 5, 16, 0.35)'; 
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'screen'; 
    } else {
        // 釘モード (背景が急に暗くなるような演出)
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over'; // 色と混ざらない生々しさ
    }
    
    for(let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        
        if(particles[i].life <= 0 || particles[i].size <= 0) {
            particles.splice(i, 1);
        }
    }
    
    if(particles.length < 10 && Math.random() < 0.05) {
        globalHue = (globalHue + 1) % 360;
        particles.push(new Particle(Math.random() * width, Math.random() * height, globalHue));
    }
    
    requestAnimationFrame(animate);
}

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-overlay').classList.add('hidden');
    initAudio();
    if(audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
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
