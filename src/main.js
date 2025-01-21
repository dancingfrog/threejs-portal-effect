import * as THREE from "three";

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import setupScene from "./setup/setupScene";

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

    const portalCanvas = document.createElement('canvas');
    const ctx = portalCanvas.getContext("webgl2");

    ctx.canvas.width = previewWindow.width;
    ctx.canvas.height = previewWindow.height;

    // Setup Renderer
    const portalRenderer = new THREE.WebGLRenderer({
        antialias: true,
    });
    portalRenderer.setPixelRatio(window.devicePixelRatio);
    portalRenderer.setSize(previewWindow.width, previewWindow.height);

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

    // Setup Scene
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        50,

        previewWindow.width / previewWindow.height,
        0.1,
        100,
    );
    camera.position.set(0, 1.6, 1);

    // Setup Camera and Controls
    const cameraLookAtTarget = new THREE.Vector3(0, 0.5, -1);
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
            map: texture,
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

    function renderPortal() {
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
    }

    function renderWorld() {
        portalRenderer.clippingPlanes = [];

        torusMesh.material.clippingPlanes = null;

        portalMesh.material.side = isInsidePortal ? THREE.BackSide : THREE.FrontSide;

        camera.layers.enable(mapLayers.get("portal"));
        // if (isInsidePortal) {
            camera.layers.disable(mapLayers.get("outside"));
            camera.layers.enable(mapLayers.get("inside"));
        // } else {
        //     camera.layers.disable(mapLayers.get("inside"));
        //     camera.layers.enable(mapLayers.get("outside"));
        // }

        texture.needsUpdate = true;
        renderer.render(scene, camera);
    }

    function resize() {
        const width = previewWindow.width;
        const height = window.innerHeight;

        resolution.set(width, height);

        resizeRenderer(width, height);
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

