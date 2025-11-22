import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- SETUP THREE.JS ---
const canvasContainer = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e0e0e, 20, 35); // Nebel etwas weiter weg geschoben

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
canvasContainer.appendChild(renderer.domElement);

// --- SETUP CANNON.JS ---
const world = new CANNON.World();
world.gravity.set(0, 0, 0); 
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
    friction: 0.2,      // Etwas mehr Reibung für mehr Kontrolle
    restitution: 0.7    // Weniger "Bouncy", wirkt wertiger
});
world.addContactMaterial(defaultContactMaterial);

// --- LICHT ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0xff5796, 0.8); 
pointLight.position.set(-5, 5, 5);
scene.add(pointLight);

// --- OBJEKTE ---
const objectsToUpdate = [];
const colors = [0xff5796, 0x00e6c3, 0xffdf3c]; 

const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
const torusGeo = new THREE.TorusGeometry(0.8, 0.35, 16, 100);
const coneGeo = new THREE.ConeGeometry(1, 2, 32);

const createObject = (position) => {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const type = Math.floor(Math.random() * 4);
    
    let geometry, shape;
    switch(type) {
        case 0: 
            geometry = boxGeo;
            shape = new CANNON.Box(new CANNON.Vec3(0.75, 0.75, 0.75));
            break;
        case 1: 
            geometry = sphereGeo;
            shape = new CANNON.Sphere(1);
            break;
        case 2: 
            geometry = torusGeo;
            shape = new CANNON.Sphere(1); 
            break;
        default: 
            geometry = coneGeo;
            shape = new CANNON.Cylinder(0, 1, 2, 8);
            break;
    }

    const material = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.3,
        metalness: 0.1 
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position);
    scene.add(mesh);

    const body = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        shape: shape,
        material: defaultMaterial
    });
    
    body.angularVelocity.set((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2);
    body.velocity.set((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5);
    body.linearDamping = 0.5;  // Objekte bremsen schneller ab (Space-Vibe)
    body.angularDamping = 0.5;

    world.addBody(body);
    objectsToUpdate.push({ mesh, body });
};

// Objekte initial erzeugen
for(let i=0; i < 15; i++){
    createObject({
        x: (Math.random() - 0.5) * 10, 
        y: (Math.random() - 0.5) * 10, 
        z: (Math.random() - 0.5) * 4
    });
}

// --- DYNAMISCHE WÄNDE ---
// Wir speichern die Physics-Bodies der Wände, um sie beim Resize zu updaten
const walls = {};

const createWall = (name, position, size) => {
    const body = new CANNON.Body({
        mass: 0, // Statisch
        material: defaultMaterial
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x, size.y, size.z)));
    body.position.copy(position);
    world.addBody(body);
    walls[name] = body;
};

// Funktion zur Berechnung der Bildschirm-Grenzen in 3D-Koordinaten
function updateWalls() {
    // Distanz von Kamera zu z=0
    const distance = camera.position.z;
    // Sichtfeld-Höhe bei z=0 berechnen
    const vFOV = THREE.MathUtils.degToRad(camera.fov); 
    const height = 2 * Math.tan(vFOV / 2) * distance;
    const width = height * camera.aspect;

    const w = width / 2;
    const h = height / 2;
    const thickness = 1; // Dicke der unsichtbaren Wände

    // Wände neu positionieren (Exakt am Rand)
    if(walls.left) {
        walls.left.position.set(-w - thickness, 0, 0);
        walls.right.position.set(w + thickness, 0, 0);
        walls.top.position.set(0, h + thickness, 0);
        walls.bottom.position.set(0, -h - thickness, 0);
    } else {
        // Erstes Mal erstellen
        createWall('left',   {x: -w - thickness, y: 0, z: 0}, {x: thickness, y: h*2, z: 10});
        createWall('right',  {x: w + thickness, y: 0, z: 0},  {x: thickness, y: h*2, z: 10});
        createWall('top',    {x: 0, y: h + thickness, z: 0},  {x: w*2, y: thickness, z: 10});
        createWall('bottom', {x: 0, y: -h - thickness, z: 0}, {x: w*2, y: thickness, z: 10});
        
        // Vorne und Hinten (feste Tiefe)
        createWall('back',   {x: 0, y: 0, z: -8},             {x: w*2, y: h*2, z: 1}); // Hinten (Limiter)
        createWall('front',  {x: 0, y: 0, z: 10},             {x: w*2, y: h*2, z: 1}); // Vorne (Glas)
    }
}

// Initial aufrufen
updateWalls();

// --- INTERAKTION ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const mouseSpeed = new THREE.Vector2();
let lastMousePosition = { x: 0, y: 0 };

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    mouseSpeed.x = event.clientX - lastMousePosition.x;
    mouseSpeed.y = event.clientY - lastMousePosition.y;
    lastMousePosition = { x: event.clientX, y: event.clientY };

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objectsToUpdate.map(obj => obj.mesh));

    if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        const item = objectsToUpdate.find(i => i.mesh === hitObject);
        
        if (item) {
            item.body.wakeUp();
            // FORCE UPDATE: Jetzt sanfter (Faktor 0.05 statt 0.2)
            const forceMultiplier = 0.05; 
            
            item.body.applyImpulse(
                new CANNON.Vec3(mouseSpeed.x * forceMultiplier, -mouseSpeed.y * forceMultiplier, -2), 
                new CANNON.Vec3(0, 0, 0)
            );
        }
    }
});

// --- ANIMATION ---
const clock = new THREE.Clock();
let oldElapsedTime = 0;

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - oldElapsedTime;
    oldElapsedTime = elapsedTime;

    world.step(1 / 60, deltaTime, 3);

    for (const object of objectsToUpdate) {
        object.mesh.position.copy(object.body.position);
        object.mesh.quaternion.copy(object.body.quaternion);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
};

tick();

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // WICHTIG: Wände beim Resizen neu berechnen
    updateWalls();
});


// --- DRAGGABLE SLIDER LOGIC ---
const sliders = document.querySelectorAll('.carousel-container');
let isDown = false;
let startX;
let scrollLeft;

sliders.forEach(slider => {
    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault(); // Verhindert Text-Markieren etc.
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // *2 für schnellere Scroll-Geschwindigkeit
        slider.scrollLeft = scrollLeft - walk;
    });
});
