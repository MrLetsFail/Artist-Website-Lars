import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- SETUP THREE.JS (Die Optik) ---
const canvasContainer = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// Dunkler Nebel, damit Objekte in der Tiefe verschwinden
scene.fog = new THREE.Fog(0x0e0e0e, 15, 25);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 18); // Kamera etwas weiter weg

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; // Schatten aktivieren für mehr Tiefe
canvasContainer.appendChild(renderer.domElement);

// --- SETUP CANNON.JS (Die Physik) ---
const world = new CANNON.World();
world.gravity.set(0, 0, 0); // Schwerelosigkeit
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

// Physische Materialien (wie "bouncy" sind die Objekte?)
const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
    friction: 0.1,      // Wenig Reibung
    restitution: 0.9    // Hohe Sprungkraft (bouncy)
});
world.addContactMaterial(defaultContactMaterial);

// --- LICHT ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0xff5796, 0.5); // Pinkes Zusatzlicht
pointLight.position.set(-5, 5, 5);
scene.add(pointLight);

// --- OBJEKTE ERSTELLEN ---
const objectsToUpdate = []; // Array speichert Paare von { mesh, body }

// Deine Neon-Farben
const colors = [0xff5796, 0x00e6c3, 0xffdf3c]; 

// Geometrien (Three.js)
const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
const torusGeo = new THREE.TorusGeometry(0.8, 0.35, 16, 100);
const coneGeo = new THREE.ConeGeometry(1, 2, 32);

const createObject = (position) => {
    // 1. Zufällige Auswahl von Form und Farbe
    const color = colors[Math.floor(Math.random() * colors.length)];
    const type = Math.floor(Math.random() * 4); // 0-3
    
    let geometry, shape;

    // Physik-Formen müssen zur Optik passen
    switch(type) {
        case 0: // Würfel
            geometry = boxGeo;
            shape = new CANNON.Box(new CANNON.Vec3(0.75, 0.75, 0.75)); // Hälfte der Größe
            break;
        case 1: // Kugel
            geometry = sphereGeo;
            shape = new CANNON.Sphere(1);
            break;
        case 2: // Donut (Torus ist physikalisch komplex, wir nehmen eine Kugel als Hitbox für Performance)
            geometry = torusGeo;
            shape = new CANNON.Sphere(1); 
            break;
        default: // Kegel (wir nehmen einen Zylinder als Hitbox, das ist stabiler)
            geometry = coneGeo;
            shape = new CANNON.Cylinder(0, 1, 2, 8);
            break;
    }

    // 2. Three.js Mesh (Das Auge sieht das)
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

    // 3. Cannon.js Body (Die Physik berechnet das)
    const body = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        shape: shape,
        material: defaultMaterial
    });
    
    // Zufällige Anfangsrotation und leichter Drift
    body.angularVelocity.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
    );
    body.velocity.set(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
    );
    
    // Dämpfung, damit sie nicht ewig schnell werden
    body.linearDamping = 0.3; 
    body.angularDamping = 0.3;

    world.addBody(body);

    // Speichern für Loop
    objectsToUpdate.push({ mesh, body });
};

// Erzeuge 12 Objekte verteilt im Raum (nicht mehr alle in der Mitte)
for(let i=0; i < 15; i++){
    createObject({
        x: (Math.random() - 0.5) * 12, 
        y: (Math.random() - 0.5) * 12, 
        z: (Math.random() - 0.5) * 5
    });
}

// --- UNSICHTBARE WÄNDE (Damit nichts wegfliegt) ---
// Wir bauen eine Box aus 6 Wänden
const createWall = (position, size) => {
    const body = new CANNON.Body({
        mass: 0, // 0 Masse = Statisch (bewegt sich nicht)
        material: defaultMaterial
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x, size.y, size.z)));
    body.position.copy(position);
    world.addBody(body);
}

// Wände platzieren (Links, Rechts, Oben, Unten, Vorne, Hinten)
createWall({x: -9, y: 0, z: 0}, {x: 0.1, y: 20, z: 10}); // Links
createWall({x: 9, y: 0, z: 0}, {x: 0.1, y: 20, z: 10});  // Rechts
createWall({x: 0, y: 9, z: 0}, {x: 20, y: 0.1, z: 10});  // Oben
createWall({x: 0, y: -9, z: 0}, {x: 20, y: 0.1, z: 10}); // Unten
createWall({x: 0, y: 0, z: -5}, {x: 20, y: 20, z: 0.1}); // Hinten
createWall({x: 0, y: 0, z: 8}, {x: 20, y: 20, z: 0.1});  // Vorne (Glas)

// --- INTERAKTION (Wegdrücken) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const mouseSpeed = new THREE.Vector2(); // Wie schnell bewegt sich die Maus?
let lastMousePosition = { x: 0, y: 0 };

window.addEventListener('mousemove', (event) => {
    // Mausposition normalisieren (-1 bis +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Maus-Geschwindigkeit berechnen
    mouseSpeed.x = event.clientX - lastMousePosition.x;
    mouseSpeed.y = event.clientY - lastMousePosition.y;
    lastMousePosition = { x: event.clientX, y: event.clientY };

    // Prüfen, ob wir ein Objekt berühren
    raycaster.setFromCamera(mouse, camera);
    
    // Wir testen nur die Meshes aus unserem Array
    const intersects = raycaster.intersectObjects(objectsToUpdate.map(obj => obj.mesh));

    if (intersects.length > 0) {
        // Das erste getroffene Objekt
        const hitObject = intersects[0].object;
        
        // Das zugehörige Physik-Objekt finden
        const item = objectsToUpdate.find(i => i.mesh === hitObject);
        
        if (item) {
            // IMPULS GEBEN (Wegkicken)
            // Wir drücken es in die Richtung der Mausbewegung + etwas weg von der Kamera
            const force = 30; // Stärke des Stoßes
            
            item.body.wakeUp(); // Falls es "eingeschlafen" ist
            item.body.applyImpulse(
                new CANNON.Vec3(mouseSpeed.x * 0.2, -mouseSpeed.y * 0.2, -10), // Kraft-Vektor
                new CANNON.Vec3(0, 0, 0) // Punkt am Objekt (Mitte)
            );
        }
    }
});

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();
let oldElapsedTime = 0;

const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - oldElapsedTime;
    oldElapsedTime = elapsedTime;

    // Physik updaten (60fps)
    world.step(1 / 60, deltaTime, 3);

    // Positionen synchronisieren (Physik -> Optik)
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
});
