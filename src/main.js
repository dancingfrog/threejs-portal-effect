import * as THREE from "three";

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

import Stats from "https://unpkg.com/three@0.118.3/examples/jsm/libs/stats.module.js";

import setupScene from "./setup/setupScene";

import wavesVertexShader from "./shaders/waves/vertexShader.glsl";
import defaultFragmentShader from "./shaders/default/fragmentShader.glsl";

import starrySkyVertexShader from "./shaders/starry-sky/vertexShader.glsl";
import starrySkyFragmentShader from "./shaders/starry-sky/fragmentShader.glsl";


// Helper function to set nested meshes to layers
// https://github.com/mrdoob/three.js/issues/10959
function setLayer(object, layer) {
    object.layers.set(layer);
    object.traverse(function (child) {
        child.layers.set(layer);
    });
}

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

let currentSession;
let isInsidePortal = false;
let wasOutside = true;

function initListener (anchorObject) {
    const listener = new THREE.AudioListener();

    anchorObject.add(listener);

    anchorObject['listener'] = listener;

    window.listenerAnchor = anchorObject;

    return listener;
}

function initSoundAnalyzer (anchorObject, initSoundPath) {

    return new Promise((resolve, reject) => {

        const sound = new THREE.PositionalAudio(anchorObject.listener); // THREE.Audio(listener) ... for basic playback
        const loader = new THREE.AudioLoader();

        loader.load(initSoundPath, (buffer) => {
            sound.setBuffer(buffer);
            sound.setRefDistance(1);
            sound.setVolume(1);
            // sound.play();

            anchorObject['sound'] = sound;

            const analyzer = new THREE.AudioAnalyser(sound, 32);

            setTimeout(
                resolve,
                1500,
                analyzer
            );
        });
    });
}

async function initScene (setup = (scene, camera, controllers, players) => {}) {

    const clock = new THREE.Clock();
    let step_t = null;

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
        width: window.innerWidth, // / 2, // 640,
        height: window.innerHeight, // 480,
    };

    // Setup Renderer
    const portalRenderer = new THREE.WebGLRenderer({
        antialias: true,
    });
    portalRenderer.setPixelRatio(window.devicePixelRatio);
    portalRenderer.setSize(previewWindow.width, previewWindow.height);

    function resizePortal(width, height) {
        portalRenderer.domElement.width = width;
        portalRenderer.domElement.height = height;
        portalRenderer.setSize(width, height);
    }

    const portalTexture = new THREE.CanvasTexture(portalRenderer.domElement);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(previewWindow.width, previewWindow.height);
    renderer.xr.enabled = true;

    function resizeRenderer(width, height) {
        renderer.setSize(width, height);
    }

    portalRenderer.localClippingEnabled = true;
    renderer.localClippingEnabled = true;
    document.body.appendChild(portalRenderer.domElement);
    portalRenderer.domElement.style.display = "inline-block";
    document.body.appendChild(renderer.domElement);
    renderer.domElement.style.display = "inline-block";

    // Setup Scene
    const scene = new THREE.Scene();

    // Setup player
    const player = new THREE.Group();

    scene.add(player);

    const resolution = new THREE.Vector2();

    // Console div
    const data_pad = document.createElement("div");
    data_pad.id = "data-pad";
    data_pad.style = "max-width: 100px; min-width: 100px; min-height: 320px; color: white; background-color: black;";
    data_pad.innerHTML = "More stats... <br />";
    const data_pad_data = document.createElement("p");
    data_pad_data.id = "data-pad-data";
    data_pad_data.innerHTML = ""
    data_pad.append(data_pad_data);

    // Setup Stats
    const stats = new Stats();
    stats.showPanel(0);
    stats.dom.append(data_pad);
    // stats.dom.style += "max-width: 320px; background-color: black;";
    stats.dom.style.maxWidth = "100px";
    stats.dom.style.minWidth = "100px";
    stats.dom.style.backgroundColor = "black";
    document.body.appendChild(stats.dom);

    const statsMesh = new HTMLMesh( stats.dom );
    statsMesh.position.x = -0.75;
    statsMesh.position.y = 1.25;
    statsMesh.position.z = -0.5;
    statsMesh.rotation.y = Math.PI / 4;
    statsMesh.scale.setScalar( 2 );

    scene.add( statsMesh );

    const camera = new THREE.PerspectiveCamera(
        50,

        previewWindow.width / previewWindow.height,
        0.1,
        100,
    );
    camera.position.set(0, 1.6, 1);

    function resizeCamera(width, height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    // Setup Camera and Controls
    const cameraLookAtTarget = new THREE.Vector3(0, 0.5, -1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target = cameraLookAtTarget;
    controls.update();

    const controllerModelFactory = new XRControllerModelFactory();
    const controllers = {
        left: null,
        right: null,
    };

    for (let i = 0; i < 2; i++) {
        const raySpace = renderer.xr.getController(i);
        const gripSpace = renderer.xr.getControllerGrip(i);
        const mesh = controllerModelFactory.createControllerModel(gripSpace);

        gripSpace.add(mesh);

        gripSpace.addEventListener('connected', (e) => {

            raySpace.visible = true;
            gripSpace.visible = true;
            const handedness = e.data.handedness;
            controllers[handedness] = {
                gamepad: new GamepadWrapper(e.data.gamepad),
                raySpace,
                gripSpace,
                mesh,
            };
        });

        gripSpace.addEventListener('disconnected', (e) => {
            raySpace.visible = false;
            gripSpace.visible = false;
            const handedness = e.data.handedness;
            controllers[handedness] = null;
        });

        player.add(raySpace, gripSpace);
        // raySpace.visible = false;
        // gripSpace.visible = false;
    }

    player.add(camera);

    // // Setup Scene
    // const updateScene = await setup(renderer, scene, camera, controllers, player);

    // Setup Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 3);
    scene.add(hemisphereLight);

    // Setup texture`
    const textureCanvas = document.createElement('canvas');
    const textureCanvasCtx = textureCanvas.getContext('2d');
    const texture = new THREE.CanvasTexture(textureCanvas);

    textureCanvasCtx.canvas.width = textureCanvasCtx.canvas.height = window.innerWidth;

    textureCanvasCtx.fillStyle = "transparent";
    textureCanvasCtx.fillRect(0, 0, textureCanvasCtx.canvas.width, textureCanvasCtx.canvas.height);

    function randInt(min, max) {
        if (max === undefined) {
            max = min;
            min = 0;
        }
        return Math.random() * (max - min) + min | 0;
    }

    function drawRandomDot(ctx) {
        ctx.strokeStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
        ctx.fillStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
        ctx.beginPath();

        const x = randInt(ctx.canvas.width);
        const y = randInt(ctx.canvas.height);
        const radius = randInt(10, 64);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
    }

    // for (let i = 0; i < 1000; i++) {
    //     drawRandomDot(textureCanvasCtx);
    // }

    function generateFaceLabel(ctx, faceColor, textColor, text) {
        const {width, height} = ctx.canvas;
        ctx.fillStyle = faceColor;
        ctx.fillRect(0, 0, width, height);
        ctx.font = `${width * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(text, width / 2, height / 2);
    }

    function generateFaceGrid(ctx, gridColor, gridSpacingPixels) {
        ctx.strokeStyle = gridColor;
        const w = ctx.canvas.width,
            h = ctx.canvas.height;
        ctx.beginPath();
        for (let x=gridSpacingPixels/2; x<=w; x+=gridSpacingPixels){
            ctx.save();
            ctx.translate(0.5, 0);
            ctx.moveTo(x-0.5,0);      // 0.5 offset so that 1px lines are crisp
            ctx.lineTo(x-0.5,h);
            ctx.restore();
        }
        for (let y=gridSpacingPixels/2;y<=h;y+=gridSpacingPixels){
            ctx.save();
            ctx.translate(0, 0.5);
            ctx.moveTo(0,y-0.5);
            ctx.lineTo(w,y-0.5);
            ctx.restore();
        }
        ctx.stroke();
    }

    // generateFaceLabel(textureCanvasCtx, '#F00', '#0FF', '+X');
    generateFaceGrid(textureCanvasCtx, '#09F', 10.0);

    function createGround(width, height, groundColor, groundTexture) {
        const geometry = new THREE.PlaneGeometry(width, width, 1, 1);
        const material = (!!groundTexture && groundTexture !== null) ?
            new THREE.MeshBasicMaterial({
                map: groundTexture,
                doubleSided: true,
                opacity: 1.0,
                side: THREE.DoubleSide,
                transparent: true
            }) :
            new THREE.MeshPhysicalMaterial({ color: groundColor });
        const groundMesh = new THREE.Mesh(geometry, material);
        groundMesh.rotation.set(-Math.PI * 0.5, 0, 0);
        groundMesh.position.y = height;
        return groundMesh
    }

    const skyDomeRadius = 5.01;
    const uniforms = {
        ...THREE.ShaderLib.physical.uniforms,
        // diffuse: { value: "#5B82A6" }, // <= DO NO USE WITH THREE.ShaderChunk.meshphysical_frag ...
        diffuse: { value: { "r": 0.36, "g": 0.51, "b": 0.65 } },
        roughness: { value: 0.5 },
        amplitude: { value: 0.25},
        frequency: { value: 0.5 },
        speed: { value: 0.3 },
        // fogDensity: { value: 0.45 },
        // fogColor: { value: new THREE.Vector3( 0, 0, 0 ) },
        // uvScale: { value: new THREE.Vector2( 3.0, 1.0 ) },
        // texture1: { value: cloudTexture },
        // texture2: { value: lavaTexture },
        // env_c1: { value: { "r": 0.036, "g": 0.051, "b": 0.065 } },
        // env_c2: { value: { "r": 0.065, "g": 0.036, "b": 0.051 } },
        env_c1: { value: new THREE.Color("#0d1a2f") },
        env_c2: { value: new THREE.Color("#0f8682") },
        skyRadius: { value: skyDomeRadius },
        noiseOffset: { value: new THREE.Vector3(100.01, 100.01, 100.01) },
        starSize: { value: 0.01 },
        starDensity: { value: 0.09 },
        clusterStrength: { value: 0.2 },
        clusterSize: { value: 0.2 },
        time: { value: 1.0 }
    };

    function createSphere (size, color, skyTexture) {
        const geometry = new THREE.SphereGeometry(size, 128, 32);
        const material = (!!skyTexture && skyTexture !== null) ?
            new THREE.MeshBasicMaterial({
                uniforms: uniforms,
                map: skyTexture,
                doubleSided: true,
                defines: {
                    STANDARD: '',
                    PHYSICAL: '',
                },
                extensions: {
                    derivatives: true,
                },
                lights: true,
                opacity: 1.0,
                side: THREE.DoubleSide,
                transparent: true
            }) :
            new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: starrySkyVertexShader, // wavesVertexShader,
                fragmentShader: starrySkyFragmentShader, // defaultFragmentShader,
                doubleSided: true,
                defines: {
                    STANDARD: '',
                    PHYSICAL: '',
                },
                extensions: {
                    derivatives: true,
                },
                lights: true,
                opacity: 1.0,
                side: THREE.DoubleSide,
                transparent: true
            });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uResolution = new THREE.Uniform(resolution);
            shader.uniforms.time = new THREE.Uniform(1.0); // <= DOES NOT WORK w/ MeshBasicMaterial

            shader.vertexShader = starrySkyVertexShader; // wavesVertexShader; //
            shader.fragmentShader = starrySkyFragmentShader; // defaultFragmentShader; //
        };
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
            map: portalTexture,
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

    function createTorus(color, torusTexture) {
        const geometry = new THREE.TorusKnotGeometry(0.25, 0.03, 100, 16);
        const material = (!!torusTexture && torusTexture !== null) ?
            new THREE.MeshBasicMaterial({
                map: torusTexture,
                doubleSided: true,
                opacity: 1.0,
                side: THREE.DoubleSide,
                transparent: true
            }) :
            new THREE.MeshPhysicalMaterial({
                color,
                side: THREE.DoubleSide
            });
    //     material.onBeforeCompile = (shader) => {
    //         shader.uniforms.uResolution = new THREE.Uniform(resolution);
    //
    //         shader.fragmentShader =
    //             `
    //   uniform vec2 uResolution;
    // ` + shader.fragmentShader;
    //
    //         shader.fragmentShader = shader.fragmentShader.replace(
    //             "#include <map_fragment>",
    //             `
    //   vec2 pos = gl_FragCoord.xy/uResolution;
    //   vec4 sampledDiffuseColor = texture2D( map, pos );
    //   diffuseColor *= sampledDiffuseColor;
    // `
    //         );
    //     };

        return new THREE.Mesh(geometry, material);
    }

    function updateTorus() {
        torusMesh.rotation.x += 0.01;
        torusMesh.rotation.y += 0.01;

        // for (let i = 0; i < 1000; i++) {
        //     drawRandomDot(textureCanvasCtx);
        //     texture.needsUpdate = true;
        // }
    }

    const portalRadialBounds = 1.0; // relative to portal size
    // function testPortalBounds() {
    //     const isOutside = camera.position.z > 0;
    //     const distance = portalMesh.position.distanceTo(camera.position);
    //     const withinPortalBounds = distance < portalRadialBounds;
    //     if (wasOutside !== isOutside && withinPortalBounds) {
    //         isInsidePortal = !isOutside;
    //     }
    //     wasOutside = isOutside;
    // }

    // const groundInsideMesh = createGround(4, 0, mapColors.get("orangeLight"), null);
    // setLayer(groundInsideMesh, mapLayers.get("inside"));
    // scene.add(groundInsideMesh);

    const shelfInsideMesh = createGround(10, 1, mapColors.get("green"), texture);
    setLayer(shelfInsideMesh, mapLayers.get("inside"));
    scene.add(shelfInsideMesh);

    const skyInsideMesh = createSphere(5, mapColors.get("orangeDark")); //, texture);
    setLayer(skyInsideMesh, mapLayers.get("inside"));
    scene.add(skyInsideMesh);

    // const groundOutsideMesh = createGround(4, 4, mapColors.get("green"));
    // setLayer(groundOutsideMesh, mapLayers.get("outside"));
    // scene.add(groundOutsideMesh);

    // const skyOutsideMesh = createSphere(mapColors.get("blue"));
    // setLayer(skyOutsideMesh, mapLayers.get("outside"));
    // scene.add(skyOutsideMesh);

    // const boxMesh = createBox(0.2, 1, 0.2, mapColors.get("green"));
    // boxMesh.position.set(0, 0, -0.3);
    // setLayer(boxMesh, mapLayers.get("outside"));
    // scene.add(boxMesh);

    // const boxMesh2 = createBox(0.2, 0.2, 0.2, mapColors.get("green"));
    // boxMesh2.position.set(-0.4, 0, 0.2);
    // setLayer(boxMesh2, mapLayers.get("outside"));
    // scene.add(boxMesh2);

    // const boxMesh3 = createBox(0.2, 0.15, 0.2, mapColors.get("green"));
    // boxMesh3.position.set(0.4, 0, 0.2);
    // setLayer(boxMesh3, mapLayers.get("outside"));
    // scene.add(boxMesh3);

    const portalMesh = createPortal(portalRadialBounds * 2);
    portalMesh.position.set(0, 1.2, 0);
    setLayer(portalMesh, mapLayers.get("portal"));
    scene.add(portalMesh);

    const torusMesh = createTorus(mapColors.get("grey"), texture);
    torusMesh.position.set(0, 1, 0);
    scene.add(torusMesh);

    // // Initialize sound and play song with sound analyzer
    // const soundListener = initListener(torusMesh);
    // const soundAnalyzer = await initSoundAnalyzer(torusMesh, "assets/audio/Dream Song.mp3");
    // const soundData = [];

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

    function getDirectionalEndPoint (A, D) {
        const B = new THREE.Vector3();
        const distance = 100; // at what distance to determine pointB
        D.normalize();
        B.addVectors (A, D.multiplyScalar( distance ) );
        return B;
    }

    // Draw a line from pointA in the given direction at distance 100
    // From https://stackoverflow.com/questions/38205340/draw-line-in-direction-of-raycaster-in-three-js#answer-42498256
    const pointA = new THREE.Vector3( 0, 1.0, -0.0 );
    const pointB = getDirectionalEndPoint(pointA, new THREE.Vector3( 0.0, -1.0, -1.0 )); // <= , direction

    // Create points on a line
    const points = [];
    points.push(pointA);
    points.push(pointB);

    const lineGeometry = new THREE.BufferGeometry();

    lineGeometry.setFromPoints(points);

    const geometry = lineGeometry;
    const material = new THREE.LineBasicMaterial( { color : 0xff0000 } );
    const line = new THREE.Line( geometry, material );
    setLayer(line, mapLayers.get("outside"));
    scene.add( line );

    // Setup Clipping planes
    const clippingPlaneInside = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const clippingPlaneOutside = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    function renderPortal() {

        camera.layers.disable(mapLayers.get("portal"));
        // if (isInsidePortal) {
        //     camera.layers.disable(mapLayers.get("inside"));
        //     camera.layers.enable(mapLayers.get("outside"));
        // } else {
            camera.layers.disable(mapLayers.get("outside"));
            camera.layers.enable(mapLayers.get("inside"));
        // }

        torusMesh.material.clippingPlanes = (isInsidePortal) ? [
            clippingPlaneInside
        ] : [
            clippingPlaneOutside
        ];

        portalRenderer.clippingPlanes = (isInsidePortal) ? [
            clippingPlaneInside
        ] : [
            clippingPlaneOutside
        ];

        portalRenderer.render(scene, camera);
        // renderer.render(scene, camera);
    }

    function renderWorld() {

        portalRenderer.clippingPlanes = [];

        // camera.layers.enable(mapLayers.get("portal"));
        // if (isInsidePortal) {
        //     camera.layers.disable(mapLayers.get("outside"));
            camera.layers.enable(mapLayers.get("inside"));
        // } else {
        //     camera.layers.disable(mapLayers.get("inside"));
            camera.layers.enable(mapLayers.get("outside"));
        // }

        // xrCameraDirection From:
        // https://stackoverflow.com/questions/59554505/how-can-i-get-camera-world-direction-with-webxr#answer-59687055
        let xrCamera = renderer.xr.getCamera(camera);
        let xrCameraMatrix = xrCamera.matrixWorld;
        // let xrCameraX = xrCameraMatrix.elements[3],
        //     xrCameraY = xrCameraMatrix.elements[4],
        //     xrCameraZ = xrCameraMatrix.elements[5];
        let xrCameraA = new THREE.Vector3();
        xrCameraA.setFromMatrixPosition(xrCameraMatrix);
        let xrCameraDX = xrCameraMatrix.elements[8],
            xrCameraDY = xrCameraMatrix.elements[9],
            xrCameraDZ = xrCameraMatrix.elements[10];
        let xrCameraDirection = new THREE.Vector3(-xrCameraDX, -xrCameraDY, -xrCameraDZ).normalize();

        // console.log(xrCameraA);

        const viewingPlaneLeft = -1; // x left
        const viewingPlaneRight = 2; // x right
        const viewingPlaneTop = 2; // y top
        const viewingPlaneBottom = 1; // y bottom
        const viewingPlaneDepth = 0; // z

        const clippingTopP = new THREE.Vector3(xrCameraA.x, viewingPlaneTop, viewingPlaneDepth);
        const clippingBottomP = new THREE.Vector3(xrCameraA.x, viewingPlaneBottom, viewingPlaneDepth);

        const vDTop = new THREE.Vector3();
        vDTop.subVectors(clippingTopP, xrCameraA);
        const vDBottom = new THREE.Vector3();
        vDBottom.subVectors(clippingBottomP, xrCameraA);

        const clippingTopUnitVector = new THREE.Vector3(0, -1.0, 0);
        const clippingTopDirection = vDTop.clone().cross(new THREE.Vector3(1, 0, 0)).normalize();
        const clippingTopUnitAngleToDirection = clippingTopUnitVector.angleTo(clippingTopDirection.clone());
        const clippingTopY = Math.cos(clippingTopUnitAngleToDirection) * viewingPlaneTop;
        const clippingBottomUnitVector = (xrCameraA.z > viewingPlaneDepth) ?
            new THREE.Vector3(0, 1.0, 0) :
            new THREE.Vector3(0, -1.0, 0);
        const clippingBottomDirection = vDBottom.clone().cross(new THREE.Vector3(-1, 0, 0)).normalize(); // new THREE.Vector3(0, 1, 0);
        const clippingBottomUnitAngleToDirection = clippingBottomUnitVector.angleTo(clippingBottomDirection.clone());
        const clippingBottomY = Math.cos(clippingBottomUnitAngleToDirection) * viewingPlaneBottom; // viewingPlaneBottom = 1.0 // length on unit circle

        // console.log("clippingBottomAngleTo:", clippingBottomUnitAngleToDirection);
        // console.log("clippingBottomY:", clippingBottomY);

        // // Create points on a line
        points[0] = new THREE.Vector3( 0, clippingTopP.y, 0 ); // xrCameraA; // new THREE.Vector3( 0, 1.0, 0.0 );
        points[1] = getDirectionalEndPoint(points[0], clippingTopDirection.clone()); // clippingBottomDirection.clone()); // xrCameraDirection.clone());
        lineGeometry.setFromPoints(points);

        // const clippingBottomPlane = new THREE.Plane(clippingBottomUnitVector.clone(), -(viewingPlaneBottom - 0.001));
        const clippingBottomPlane = new THREE.Plane(clippingBottomDirection.clone(), -(viewingPlaneBottom - 0.001) * clippingBottomY);
        // const clippingTopPlane = new THREE.Plane(clippingTopUnitVector.clone(), 2.0);
        const clippingTopPlane = new THREE.Plane(clippingTopDirection.clone(), clippingTopY);

        line.geometry = lineGeometry;
        line.material.clippingPlanes = null;

        portalMesh.material.side = isInsidePortal ? THREE.BackSide : THREE.FrontSide;

        skyInsideMesh.material.clippingPlanes = [
            clippingPlaneOutside,
            clippingTopPlane,
            clippingBottomPlane,
            new THREE.Plane(clippingBottomUnitVector.clone(), -0.999)
        ];

        torusMesh.material.clippingPlanes = [
            new THREE.Plane(clippingBottomUnitVector.clone(), -0.999)
        ];

        const new_data = JSON.stringify({
            "topΘ": clippingTopUnitAngleToDirection,
            "topY": clippingTopY,
            "bottomΘ": clippingBottomUnitAngleToDirection,
            "bottomY": clippingBottomY
        })
            .replace(new RegExp("\\\\n", "g"), '<br />')
            .replace(new RegExp('"\:', "g"), '":<br />')
            .replace(new RegExp(',', "g"), '",<br />')
            .replace(new RegExp("{", "g"), '{<br />')
            .replace(new RegExp("}", "g"), '<br />}');

        data_pad_data.innerHTML = new_data;

        renderer.clippingPlanes = (xrCameraA.z > viewingPlaneDepth) ? [
            clippingPlaneOutside,
            clippingTopPlane,
            clippingBottomPlane
        ] : [
            clippingPlaneInside,
            clippingPlaneOutside,
            clippingTopPlane,
            clippingBottomPlane
        ];

        renderer.render(scene, camera);
    }

    function animate(t) {

        const delta = clock.getDelta();
        const timeElapsed = clock.getElapsedTime();

        if (step_t === null) {
            step_t = t
        } else {
            step_t = t - step_t;
        }

        // console.log("step_t:", step_t);

        const sceneDataUpdate = {};

        stats.begin();

        // if (!!soundAnalyzer
        //     && soundAnalyzer.hasOwnProperty("analyser")
        //     && typeof soundAnalyzer.getFrequencyData === "function"
        // ) {
        //
        //     if (torusMesh.hasOwnProperty("sound") && !!torusMesh['sound'].isPlaying) {
        //
        //         // sound analysis
        //         soundData.push([...soundAnalyzer.getFrequencyData()]);
        //
        //         // console.log("Last soundData:", soundData[(soundData.length - 1)]);
        //     }
        //
        // } else {
        //     console.log("soundAnalyzer is not ready:", soundAnalyzer);s
        // }

        // testPortalBounds();

        skyInsideMesh.material.uniforms.time.value = timeElapsed; // <= DOES NOT WORK w/ MeshBasicMaterial

        // updateScene(currentSession, delta, timeElapsed, (Object.keys(sceneDataUpdate).length > 0) ? sceneDataUpdate : null);

        updateTorus();
        updateCameraPosition();
        updateCameraTarget();

        renderPortal();
        renderWorld();

        stats.end();

        // Canvas elements doesn't trigger DOM updates, so we have to update the texture
        portalTexture.needsUpdate = true;
        statsMesh.material.map.update();
    }

    function resize(width, height) {

        resolution.set(width, height);

        resizePortal(width, height);
        resizeRenderer(width, height);
        resizeCamera(width, height);
    }

    function handleResize() {
        previewWindow.width = window.innerWidth;
        previewWindow.height = window.innerHeight;

        resize(previewWindow.width, previewWindow.height);
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

    function startXR() {
        const sessionInit = {
            optionalFeatures: [
                "local-floor",
                "bounded-floor",
                "hand-tracking",
                "layers"
            ],
            requiredFeatures: [
                // "webgpu"
            ]
        };

        navigator.xr
            .requestSession("immersive-ar", sessionInit)
            .then(onSessionStarted);

        const vrDisplays = [];

        if (navigator.getVRDisplays) {
            function updateDisplay() {
                // Call `navigator.getVRDisplays` (before Firefox 59).
                navigator.getVRDisplays().then(displays => {
                    console.log("Checking VR display");
                    if (!displays.length) {
                        throw new Error('No VR display found');
                    } else {
                        for (const display of displays) {
                            console.log("Found VR Display:", display);
                            vrDisplays.push(display);
//                             document.body.innerHTML += `<br />
// <span style="color: greenyellow">VR Display Connected!</span> <br />
// <span style="color: greenyellow">Reload page to reset XR scene.</span>
// `;
                        }
                    }
                });
            }

            // As of Firefox 59, it's preferred to also wait for the `vrdisplayconnect` event to fire.
            window.addEventListener('vrdisplayconnect', updateDisplay);
            window.addEventListener('vrdisplaydisconnect', e => console.log.bind(console));
            window.addEventListener('vrdisplayactivate', e => console.log.bind(console));
            window.addEventListener('vrdisplaydeactivate', e => console.log.bind(console));
            window.addEventListener('vrdisplayblur', e => console.log.bind(console));
            window.addEventListener('vrdisplayfocus', e => console.log.bind(console));
            window.addEventListener('vrdisplaypointerrestricted', e => console.log.bind(console));
            window.addEventListener('vrdisplaypointerunrestricted', e => console.log.bind(console));
            window.addEventListener('vrdisplaypresentchange', e => console.log.bind(console))
        }
    }

    async function onSessionStarted(session) {
        renderer.xr.setSession(session)
            .then(() => {
                currentSession = session;
                currentSession.addEventListener("end", onSessionEnded);
            });

        // if (torusMesh.hasOwnProperty("sound")) {
        //     torusMesh['sound'].play();
        // }
    }

    function onSessionEnded() {
        currentSession.removeEventListener("end", onSessionEnded);
        currentSession = null;
    }

    const xr_button = // VRButton.createButton(renderer);
        document.createElement("button");
    // xr_button.className = "vr-button";
    xr_button.className = "xr-button";
    xr_button.innerHTML = "Enter XR";
    xr_button.addEventListener('click', async () => {

        console.log("XR Button clicked");

        startXR();

        // Set camera position
        camera.position.y = 0;

        player.position.z = camera.position.z;
        player.position.y = camera.position.y;

        previewWindow.width = window.innerWidth;
        previewWindow.height = window.innerHeight;

        resize(previewWindow.width, previewWindow.height);
    });

    document.body.appendChild(xr_button);

    // window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    resize(previewWindow.width, previewWindow.height);

    renderer.setAnimationLoop(animate);
}

initScene(setupScene)
    .then(() => {
        console.log("WebGL scene has been initialized");
    });

