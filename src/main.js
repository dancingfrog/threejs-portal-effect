import * as THREE from "three";

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

import setupScene from "./setup/setupScene";

let currentSession;

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const controllerModelFactory = new XRControllerModelFactory();
const controllers = {
    left: null,
    right: null,
};

let waiting_for_confirmation = false;

const mapLayers = new Map();
mapLayers.set("inside", 1);
mapLayers.set("outside", 2);
mapLayers.set("portal", 3);

const mapColors = new Map();
mapColors.set("white", new THREE.Color(0xffffff));
mapColors.set("grey", new THREE.Color(0xdddddd));
mapColors.set("orangeLight", new THREE.Color(0xffd5c9));
mapColors.set("orangeDark", new THREE.Color(0xfbb282));
mapColors.set("green", new THREE.Color(0xc8d3cb));
mapColors.set("blue", new THREE.Color(0xbbd1de));

const mapDirection = new Map();
mapDirection.set("isLeft", false);
mapDirection.set("isRight", false);
mapDirection.set("isUp", false);
mapDirection.set("isDown", false);

const mapKeys = new Map();
mapKeys.set("a", "isLeft");
mapKeys.set("ArrowLeft", "isLeft");
mapKeys.set("w", "isUp");
mapKeys.set("ArrowUp", "isUp");
mapKeys.set("s", "isDown");
mapKeys.set("ArrowDown", "isDown");
mapKeys.set("d", "isRight");
mapKeys.set("ArrowRight", "isRight");

let isInsidePortal = false;
let wasOutside = true;

async function initScene (setup = (scene, camera, controllers, players) => {}) {

    // iwer setup
    let nativeWebXRSupport = false;

    if (navigator.xr) {
        nativeWebXRSupport = await (navigator.xr.isSessionSupported('immersive-ar')
            || navigator.xr.isSessionSupported('immersive-vr'));
    }

    // Setup Immersive Web Emulation Runtime (iwer) and emulated XR device (@iwer/devui)
    if (!nativeWebXRSupport) {
        const xrDevice = new XRDevice(metaQuest3);
        xrDevice.installRuntime();
        xrDevice.fovy = (75 / 180) * Math.PI;
        xrDevice.ipd = 0;
        window.xrdevice = xrDevice;
        xrDevice.controllers.right.position.set(0.15649, 1.43474, -0.38368);
        xrDevice.controllers.right.quaternion.set(
            0.14766305685043335,
            0.02471366710960865,
            -0.0037767395842820406,
            0.9887216687202454,
        );
        xrDevice.controllers.left.position.set(-0.15649, 1.43474, -0.38368);
        xrDevice.controllers.left.quaternion.set(
            0.14766305685043335,
            0.02471366710960865,
            -0.0037767395842820406,
            0.9887216687202454,
        );
        new DevUI(xrDevice);

    }

    const previewWindow = {
        width: window.innerWidth / 2, // 640,
        height: window.innerHeight, // 480,
    };

//     const body = document.body,
//         container = document.createElement('div');
//     container.style = `display: block; background-color: #FFF; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;
//     body.appendChild(container);
//
//     console.log(container);
//
//     const canvas = window.document.createElement('canvas');
//     canvas.width = window.innerWidth / 2;
//     canvas.height = window.innerHeight;

    const portalCanvas = document.createElement('canvas');
    const ctx = portalCanvas.getContext("webgl2");

    ctx.canvas.width = previewWindow.width;
    ctx.canvas.height = previewWindow.height;

// Setup Renderer
//     const portalRenderer = new THREE.WebGLRenderer({
//         antialias: true
//     });
    const portalRenderer = new THREE.WebGLRenderer({
        antialias: true,
        // canvas: portalCanvas
    });
    portalRenderer.setPixelRatio(window.devicePixelRatio);
    portalRenderer.setSize(previewWindow.width, previewWindow.height);
    portalRenderer.xr.enabled = true;
    portalRenderer.xr.enabled = false;
    portalRenderer.localClippingEnabled = false;
    // portalRenderer.localClippingEnabled = true;

    const texture = new THREE.CanvasTexture(portalRenderer.domElement);

    const testCanvas = document.createElement('canvas');
    const testCtx = testCanvas.getContext('2d');
    const testTexture = new THREE.CanvasTexture(testCanvas);

    testCtx.canvas.width = previewWindow.width;
    testCtx.canvas.height = previewWindow.height;

    testCtx.fillStyle = "transparent";
    testCtx.fillRect(0, 0, testCtx.canvas.width, testCtx.canvas.height);

    function randInt(min, max) {
        if (max === undefined) {
            max = min;
            min = 0;
        }
        return Math.random() * (max - min) + min | 0;
    }

    function drawRandomDot() {
        testCtx.strokeStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
        testCtx.fillStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
        testCtx.beginPath();

        const x = randInt(testCtx.canvas.width);
        const y = randInt(testCtx.canvas.height);
        const radius = randInt(10, 64);
        testCtx.arc(x, y, radius, 0, Math.PI * 2);
        testCtx.stroke();
        testCtx.fill();
    }

    for (let i = 0; i < 1000; i++) {
        drawRandomDot();
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(previewWindow.width, previewWindow.height);
    renderer.xr.enabled = true;

    const resolution = new THREE.Vector2();

    portalRenderer.localClippingEnabled = true;
    renderer.localClippingEnabled = true;
    document.body.appendChild(portalRenderer.domElement);
    portalRenderer.domElement.style.display = "inline-block";
    document.body.appendChild(renderer.domElement);
    renderer.domElement.style.display = "inline-block";

    function resizeRenderer(width, height) {
        renderer.setSize(width, height);
    }

// Setup Portal RenderTarget
    const renderTarget = new THREE.WebGLRenderTarget(1, 1);

    function resizePortalRenderTarget( width, height) {
        renderTarget.setSize(width, height);
    }

// Setup Scene
//     const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        50,

        previewWindow.width / previewWindow.height,
        0.1,
        100,
    );
    camera.position.set(0, 1.6, 3);

//     const controls = new OrbitControls(camera, container);
//     controls.target.set(0, 1.6, 0);
//     controls.update();

// Setup Camera and Controls
//     const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 100);
//     camera.position.set(-1.5, 0.5, 0.6);
//
    const cameraLookAtTarget = new THREE.Vector3(0, 0.5, 0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target = cameraLookAtTarget;
    controls.update();

    function resizeCamera(width, height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

// Setup Clipping planes
    const globalPlaneInside = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)];
    const globalPlaneOutside = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];

// Helper function to set nested meshes to layers
// https://github.com/mrdoob/three.js/issues/10959
    function setLayer(object, layer) {
        object.layers.set(layer);
        object.traverse(function (child) {
            child.layers.set(layer);
        });
    }

//     const environment = new RoomEnvironment(renderer);
//     const pmremGenerator = new THREE.PMREMGenerator(renderer);
//     scene.environment = pmremGenerator.fromScene(environment).texture;
//
//     const player = new THREE.Group();
//     scene.add(player);
//
//     for (let i = 0; i < 2; i++) {
//         const raySpace = renderer.xr.getController(i);
//         const gripSpace = renderer.xr.getControllerGrip(i);
//         const mesh = controllerModelFactory.createControllerModel(gripSpace);
//
//         gripSpace.add(mesh);
//
//         gripSpace.addEventListener('connected', (e) => {
//
//             raySpace.visible = true;
//             gripSpace.visible = true;
//             const handedness = e.data.handedness;
//             controllers[handedness] = {
//                 gamepad: new GamepadWrapper(e.data.gamepad),
//                 raySpace,
//                 gripSpace,
//                 mesh,
//             };
//         });
//
//         gripSpace.addEventListener('disconnected', (e) => {
//             raySpace.visible = false;
//             gripSpace.visible = false;
//             const handedness = e.data.handedness;
//             controllers[handedness] = null;
//         });
//
//         player.add(raySpace, gripSpace);
//         // raySpace.visible = false;
//         // gripSpace.visible = false;
//     }
//
//     const updateScene = await setup(scene, camera, controllers, player);
//
//     renderer.setAnimationLoop(() => {
//         const delta = clock.getDelta();
//         const time = clock.getElapsedTime();
//         Object.values(controllers).forEach((controller) => {
//             if (controller?.gamepad) {
//                 controller.gamepad.update();
//             }
//         });
//
//         const data = {};
//
//         if (controllers.hasOwnProperty("right") && controllers.right !== null) {
//
//             const { gamepad, raySpace } = controllers.right;
//
//             if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
//                 console.log("Trigger on right controller was activated:", XR_BUTTONS.TRIGGER, gamepad);
//
//                 const controller_vector = new THREE.Group();
//
//                 raySpace.getWorldPosition(controller_vector.position);
//                 raySpace.getWorldQuaternion(controller_vector.quaternion);
//
//                 if (!!waiting_for_confirmation) {
//                     console.log("Cancel action");
//                     waiting_for_confirmation = false;
//                 }
//
//                 data.action = `Trigger on right controller was activated: ${XR_BUTTONS.TRIGGER}`;
//                 data.controller_vector = controller_vector;
//                 data.waiting_for_confirmation = waiting_for_confirmation;
//
//             } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_1)) {
//                 console.log("BUTTON_1 (A) on right controller was activated:", XR_BUTTONS.BUTTON_1, gamepad);
//                 if (!!waiting_for_confirmation) {
//                     console.log("Confirm action");
//                     waiting_for_confirmation = false;
//
//                     console.log("End session");
//
//                     data.action = "End session confirmed";
//                     data.waiting_for_confirmation = waiting_for_confirmation;
//                     currentSession.end();
//                 }
//
//             } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_2)) {
//                 console.log("BUTTON_2 (B) on right controller was activated:", XR_BUTTONS.BUTTON_2, gamepad);
//
//                 if (!!waiting_for_confirmation) {
//                     console.log("Cancel action");
//                     waiting_for_confirmation = false;
//                     data.action = "End session cancelled";
//                 } else {
//                     console.log("Waiting for confirmation...")
//                     waiting_for_confirmation = true;
//                     data.action = "End session initiated";
//                 }
//
//                 data.waiting_for_confirmation = waiting_for_confirmation;
//
//             } else {
//                 for (const b in XR_BUTTONS) {
//                     if (XR_BUTTONS.hasOwnProperty(b)) {
//                         // console.log("Check button: ", XR_BUTTONS[b]);
//                         if (gamepad.getButtonClick(XR_BUTTONS[b])) {
//                             console.log("Button on right controller was activated:", XR_BUTTONS[b], gamepad);
//
//                             if (!!waiting_for_confirmation) {
//                                 console.log("Cancel action");
//                                 waiting_for_confirmation = false;
//                             }
//
//                             data.waiting_for_confirmation = waiting_for_confirmation;
//                         }
//                     }
//                 }
//             }
//         }
//
//         if (controllers.hasOwnProperty("left") && controllers.left !== null) {
//
//             const { gamepad, raySpace } = controllers.left;
//
//             if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
//                 console.log("Trigger on left controller was activated:", XR_BUTTONS.TRIGGER, gamepad);
//
//                 const controller_vector = new THREE.Group();
//
//                 raySpace.getWorldPosition(controller_vector.position);
//                 raySpace.getWorldQuaternion(controller_vector.quaternion);
//
//                 if (!!waiting_for_confirmation) {
//                     console.log("Cancel action");
//                     waiting_for_confirmation = false;
//                 }
//
//                 data.action = `Trigger on left controller was activated: ${XR_BUTTONS.TRIGGER}`;
//                 data.controller_vector = controller_vector;
//                 data.waiting_for_confirmation = waiting_for_confirmation;
//
//             } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_1)) {
//                 console.log("BUTTON_1 (X) on left controller was activated:", XR_BUTTONS.BUTTON_1, gamepad);
//
//                 if (!!waiting_for_confirmation) {
//                     console.log("Cancel action");
//                     waiting_for_confirmation = false;
//                 }
//
//                 data.waiting_for_confirmation = waiting_for_confirmation;
//
//             } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_2)) {
//                 console.log("BUTTON_2 (Y) on left controller was activated:", XR_BUTTONS.BUTTON_2, gamepad);
//
//                 if (!!waiting_for_confirmation) {
//                     console.log("Cancel action");
//                     waiting_for_confirmation = false;
//                 }
//
//                 data.waiting_for_confirmation = waiting_for_confirmation;
//
//             } else {
//                 for (const b in XR_BUTTONS) {
//                     if (XR_BUTTONS.hasOwnProperty(b)) {
//                         // console.log("Check button: ", XR_BUTTONS[b]);
//                         if (gamepad.getButtonClick(XR_BUTTONS[b])) {
//                             console.log("Button on left controller was activated:", XR_BUTTONS[b], gamepad);
//
//                             if (!!waiting_for_confirmation) {
//                                 console.log("Cancel action");
//                                 waiting_for_confirmation = false;
//                             }
//
//                             data.waiting_for_confirmation = waiting_for_confirmation;
//                         }
//                     }
//                 }
//             }
//         }
//
//         updateScene(currentSession, delta, time, (data.hasOwnProperty("action")) ? data : null);
//
//         renderer.render(scene, camera);
//     });
//
//     function startXR() {
//         const sessionInit = {
//             optionalFeatures: [
//                 "local-floor",
//                 "bounded-floor",
//                 "hand-tracking",
//                 "layers"
//             ],
//             requiredFeatures: [
//                 // "webgpu"
//             ]
//         };
//
//         navigator.xr
//             .requestSession("immersive-ar", sessionInit)
//             .then(onSessionStarted);
//
//         const vrDisplays = [];
//
//         if (navigator.getVRDisplays) {
//             function updateDisplay() {
//                 // Call `navigator.getVRDisplays` (before Firefox 59).
//                 navigator.getVRDisplays().then(displays => {
//                     constole.log("Checking VR display");
//                     if (!displays.length) {
//                         throw new Error('No VR display found');
//                     } else {
//                         for (const display of displays) {
//                             console.log("Found VR Display:", display);
//                             vrDisplays.push(display);
//                             container.innerHTML += `<br />
// <span style="color: greenyellow">VR Display Connected!</span> <br />
// <span style="color: greenyellow">Reload page to reset XR scene.</span>
// `;
//                         }
//                     }
//                 });
//             }
//
//             // As of Firefox 59, it's preferred to also wait for the `vrdisplayconnect` event to fire.
//             window.addEventListener('vrdisplayconnect', updateDisplay);
//             window.addEventListener('vrdisplaydisconnect', e => console.log.bind(console));
//             window.addEventListener('vrdisplayactivate', e => console.log.bind(console));
//             window.addEventListener('vrdisplaydeactivate', e => console.log.bind(console));
//             window.addEventListener('vrdisplayblur', e => console.log.bind(console));
//             window.addEventListener('vrdisplayfocus', e => console.log.bind(console));
//             window.addEventListener('vrdisplaypointerrestricted', e => console.log.bind(console));
//             window.addEventListener('vrdisplaypointerunrestricted', e => console.log.bind(console));
//             window.addEventListener('vrdisplaypresentchange', e => console.log.bind(console))
//         }
//     }
//
//     async function onSessionStarted(session) {
//         session.addEventListener("end", onSessionEnded);
//         await renderer.xr.setSession(session);
//         currentSession = session;
//     }
//
//     function onSessionEnded() {
//         currentSession.removeEventListener("end", onSessionEnded);
//         currentSession = null;
//     }
//
//     const xr_button = // VRButton.createButton(renderer);
//         document.createElement("button");
//     // xr_button.className = "vr-button";
//     xr_button.className = "xr-button";
//     xr_button.innerHTML = "Enter XR";
//     xr_button.addEventListener('click', async () => {
//
//         console.log("XR Button clicked");
//
//         const delta = clock.getDelta();
//         const time = clock.getElapsedTime();
//
//         startXR();
//
//         previewWindow.width = window.innerWidth;
//         previewWindow.height = window.innerHeight;
//
//         renderer.setSize(previewWindow.width, previewWindow.height);
//
//         camera.aspect = previewWindow.width / previewWindow.height;
//         camera.updateProjectionMatrix();
//
//         // Set camera position
//         // camera.position.z = 0;
//         camera.position.y = 0;
//
//         player.position.z = camera.position.z;
//         player.position.y = camera.position.y;
//
//         updateScene(currentSession, delta, time);
//
//         renderer.render(scene, camera);
//
//         container.style = `display: block; color: #FFF; font-size: 24px; text-align: center; background-color: #FFF; height: 100vh; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;
//         container.innerHTML = "Reload page";
//     });
//
//     container.appendChild(xr_button);

// Setup World
    function createPlane(width, height, color) {
        const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
        const material = new THREE.MeshPhysicalMaterial({ color });
        return new THREE.Mesh(geometry, material);
    }

    function createTorus(color) {
        const geometry = new THREE.TorusKnotGeometry(0.25, 0.03, 100, 16);
        const material = new THREE.MeshPhysicalMaterial({
            color,
            side: THREE.DoubleSide
        });
        return new THREE.Mesh(geometry, material);
    }

    function createSphere(color) {
        const geometry = new THREE.SphereGeometry(7, 32, 32);
        const material = new THREE.MeshPhysicalMaterial({
            color,
            side: THREE.BackSide
        });
        return new THREE.Mesh(geometry, material);
    }

    function createBox(width, height, depth, color) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshPhysicalMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y += height * 0.5;

        const wrapper = new THREE.Object3D();
        wrapper.add(mesh);
        return wrapper;
    }

    function createPortal(size) {
        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshBasicMaterial({
            // map: testTexture,
            map: texture,
            // map: renderTarget.texture,
            opacity: 1.0,
            side: THREE.DoubleSide,
        });
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uResolution = new THREE.Uniform(resolution);

            shader.fragmentShader =
                `
      uniform vec2 uResolution;
    ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `
      vec2 pos = gl_FragCoord.xy/uResolution;
      vec4 sampledDiffuseColor = texture2D( map, pos );
      diffuseColor *= sampledDiffuseColor;
    `
            );
        };

        return new THREE.Mesh(geometry, material);
    }

    const portalRadialBounds = 1.0; // relative to portal size
    function testPortalBounds() {
        const isOutside = camera.position.z > 0;
        const distance = portalMesh.position.distanceTo(camera.position);
        const withinPortalBounds = distance < portalRadialBounds;
        if (wasOutside !== isOutside && withinPortalBounds) {
            isInsidePortal = !isOutside;
        }
        wasOutside = isOutside;
    }

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 3);
    scene.add(hemisphereLight);

    const groundOutsideMesh = createPlane(4, 4, mapColors.get("green"));
    groundOutsideMesh.rotation.set(-Math.PI * 0.5, 0, 0);
    setLayer(groundOutsideMesh, mapLayers.get("outside"));
    scene.add(groundOutsideMesh);

    const groundInsideMesh = createPlane(4, 4, mapColors.get("orangeLight"));
    groundInsideMesh.rotation.set(-Math.PI * 0.5, 0, 0);
    setLayer(groundInsideMesh, mapLayers.get("inside"));
    scene.add(groundInsideMesh);

    const skyOutsideMesh = createSphere(mapColors.get("blue"));
    setLayer(skyOutsideMesh, mapLayers.get("outside"));
    scene.add(skyOutsideMesh);

    const skyInsideMesh = createSphere(mapColors.get("orangeDark"));
    setLayer(skyInsideMesh, mapLayers.get("inside"));
    scene.add(skyInsideMesh);

    const torusMesh = createTorus(mapColors.get("grey"));
    torusMesh.position.set(0, 1, 0);
    scene.add(torusMesh);

    const boxMesh = createBox(0.2, 1, 0.2, mapColors.get("green"));
    boxMesh.position.set(0, 0, -0.3);
    setLayer(boxMesh, mapLayers.get("outside"));
    scene.add(boxMesh);

    const boxMesh2 = createBox(0.2, 0.2, 0.2, mapColors.get("green"));
    boxMesh2.position.set(-0.4, 0, 0.2);
    setLayer(boxMesh2, mapLayers.get("outside"));
    scene.add(boxMesh2);

    const boxMesh3 = createBox(0.2, 0.15, 0.2, mapColors.get("green"));
    boxMesh3.position.set(0.4, 0, 0.2);
    setLayer(boxMesh3, mapLayers.get("outside"));
    scene.add(boxMesh3);

    const portalMesh = createPortal(portalRadialBounds * 2);
    portalMesh.position.set(0, 1.2, 0);
    setLayer(portalMesh, mapLayers.get("portal"));
    scene.add(portalMesh);

    // const portalBackgroundMesh = createPlane(1, 1, mapColors.get("white"));
    // portalBackgroundMesh.position.set(0, 0.5, 0);
    // setLayer(portalBackgroundMesh, mapLayers.get("portal"));
    // scene.add(portalBackgroundMesh);

    function animate() {
        requestAnimationFrame(animate);

        testPortalBounds();

        updateTorus();
        updateCameraPosition();
        updateCameraTarget();

        renderPortal();
        renderWorld();
    }

    function updateTorus() {
        torusMesh.rotation.x += 0.01;
        torusMesh.rotation.y += 0.01;
    }

    const speed = 0.05;
    const directionVector = new THREE.Vector3();
    function up() {
        directionVector.setFromMatrixColumn(camera.matrix, 0);
        directionVector.crossVectors(camera.up, directionVector);
        camera.position.addScaledVector(directionVector, speed);
    }
    function down() {
        directionVector.setFromMatrixColumn(camera.matrix, 0);
        directionVector.crossVectors(camera.up, directionVector);
        camera.position.addScaledVector(directionVector, -speed);
    }
    function left() {
        directionVector.setFromMatrixColumn(camera.matrix, 0);
        camera.position.addScaledVector(directionVector, -speed);
    }
    function right() {
        directionVector.setFromMatrixColumn(camera.matrix, 0);
        camera.position.addScaledVector(directionVector, speed);
    }
    function updateCameraPosition() {
        if (mapDirection.get("isUp")) up();
        if (mapDirection.get("isDown")) down();
        if (mapDirection.get("isLeft")) left();
        if (mapDirection.get("isRight")) right();
    }

    const worldDirection = new THREE.Vector3();
    function updateCameraTarget() {
        camera.getWorldDirection(worldDirection);
        cameraLookAtTarget
            .copy(camera.position)
            .add(worldDirection.multiplyScalar(0.01));
    }

    // const environment = new RoomEnvironment(renderer);
    // const pmremGenerator = new THREE.PMREMGenerator(renderer);
    // scene.environment = pmremGenerator.fromScene(environment).texture; // <= light + texture for quest controllers

    function renderPortal() {
        // renderer.clippingPlanes = isInsidePortal
        //     ? globalPlaneInside
        //     : globalPlaneOutside;
        portalRenderer.clippingPlanes = isInsidePortal
            ? globalPlaneInside
            : globalPlaneOutside;

        torusMesh.material.clippingPlanes = isInsidePortal
            ? globalPlaneInside
            : globalPlaneOutside;

        camera.layers.disable(mapLayers.get("portal"));
        // if (isInsidePortal) {
        //     camera.layers.disable(mapLayers.get("inside"));
        //     camera.layers.enable(mapLayers.get("outside"));
        // } else {
            camera.layers.disable(mapLayers.get("outside"));
            camera.layers.enable(mapLayers.get("inside"));
        // }

        portalRenderer.render(scene, camera);
        // renderer.setRenderTarget(renderTarget);
        // renderer.render(scene, camera);
    }

    function renderWorld() {
        // renderer.clippingPlanes = [];
        portalRenderer.clippingPlanes = [];

        torusMesh.material.clippingPlanes = isInsidePortal
            ? globalPlaneOutside
            : globalPlaneInside;

        portalMesh.material.side = isInsidePortal ? THREE.BackSide : THREE.FrontSide;
        // portalBackgroundMesh.material.side = isInsidePortal
        //     ? THREE.FrontSide
        //     : THREE.BackSide;

        camera.layers.enable(mapLayers.get("portal"));
        // if (isInsidePortal) {
            camera.layers.disable(mapLayers.get("outside"));
        //     camera.layers.enable(mapLayers.get("inside"));
        // } else {
            camera.layers.disable(mapLayers.get("inside"));
        //     camera.layers.enable(mapLayers.get("outside"));
        // }

        texture.needsUpdate = true;
        // portalRenderer.render(scene, camera);
        // renderer.setRenderTarget(null);
        renderer.render(scene, camera);
    }

//     function onWindowResize() {
//         camera.aspect = previewWindow.width / previewWindow.height;
//         camera.updateProjectionMatrix();
//
//         renderer.setSize(previewWindow.width, previewWindow.height);
//     }
//
//     window.addEventListener('resize', onWindowResize);

    function resize() {
        const width = previewWindow.width;
        const height = window.innerHeight;

        resolution.set(width, height);

        resizeRenderer(width, height);
        resizePortalRenderTarget(width, height);
        resizeCamera(width, height);
    }

    function handleResize() {
        resize();
    }

    function updateMovement(direction, isEnabled) {
        mapDirection.set(direction, isEnabled);
    }

    function handleKeyDown(e) {
        const direction = mapKeys.get(e.key);
        if (direction) updateMovement(direction, true);
    }

    function handleKeyUp(e) {
        const direction = mapKeys.get(e.key);
        if (direction) updateMovement(direction, false);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    animate();
    resize();
}

initScene(setupScene)
    .then(() => {
        console.log("WebGL scene has been initialized");
    });

