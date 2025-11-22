import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- SETUP ---
const canvasContainer = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// Nebel für Tiefe, passend zum Dark Mode
scene.fog = new THREE.Fog(0x0e0e0e, 10, 50);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Performance
canvasContainer.appendChild(renderer.domElement);

// --- LICHT ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// --- OBJEKTE (Deine "Blender" Platzhalter) ---
const objects = [];
const geometries = [
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.TorusGeometry(0.8, 0.3, 16, 100),
    new THREE.ConeGeometry(1, 2, 32)
];

const colors = [0xff5796, 0x00e6c3, 0xffdf3c]; // Deine Akzentfarben

// Erzeuge zufällige schwebende Objekte
for (let i = 0; i < 15; i++) {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const material = new THREE.MeshStandardMaterial({ 
        color: colors[Math.floor(Math.random() * colors.length)],
        roughness: 0.4,
        metalness: 0.1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Zufällige Positionen
    mesh.position.x = (Math.random() - 0.5) * 20;
    mesh.position.y = (Math.random() - 0.5) * 10;
    mesh.position.z = (Math.random() - 0.5) * 10;
    
    // Zufällige Rotation speichern
    mesh.userData = {
        rotSpeedX: (Math.random() - 0.5) * 0.02,
        rotSpeedY: (Math.random() - 0.5) * 0.02,
        originalY: mesh.position.y
    };

    scene.add(mesh);
    objects.push(mesh);
}

// --- MAUS INTERAKTION (Parallax) ---
let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
});

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();

    // Objekte sanft bewegen
    objects.forEach((obj, i) => {
        // Rotation
        obj.rotation.x += obj.userData.rotSpeedX;
        obj.rotation.y += obj.userData.rotSpeedY;
        
        // Schwebendes "Floating"
        obj.position.y = obj.userData.originalY + Math.sin(time + i) * 0.5;
        
        // Leichte Reaktion auf Maus
        obj.position.x += (mouseX * 5 - obj.position.x) * 0.01;
        obj.position.y += (mouseY * 2 - obj.position.y) * 0.01;
    });

    renderer.render(scene, camera);
}

animate();

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- SMOOTH SCROLL (Lenis) ---
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
