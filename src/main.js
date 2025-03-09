import * as THREE from "three";

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

import Stats from "https://unpkg.com/three@0.118.3/examples/jsm/libs/stats.module.js";

import loadManager from "./loadManager";
import setupScene from "./setup/setupScene";

// import wavesVertexShader from "./shaders/waves/vertexShader.glsl";
// import defaultFragmentShader from "./shaders/default/fragmentShader.glsl";

// import starrySkyVertexShader from "./shaders/starry-sky/vertexShader.glsl";
// import starrySkyFragmentShader from "./shaders/starry-sky/fragmentShader.glsl";

// import textureVertexShader from "./shaders/texture/vertexShader.glsl";
// import textureFragmentShader from "./shaders/texture/fragmentShader.glsl";

import starrySkyVertexShader from "./shaders/starry-sky-texture/vertexShader.glsl";
import starrySkyFragmentShader from "./shaders/starry-sky-texture/fragmentShader.glsl";
import canvasTexture from "./material/canvasTexture";


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

let currentSession = null;
let isInsidePortal = false;
let wasOutside = true;

let soundAnalyzer = null;
const soundData = [];
let soundMesh = null;

function initSound (anchorObject, initSoundPath) {
    const listener = new THREE.AudioListener();

    anchorObject.add(listener);

    anchorObject['listener'] = listener;

    window.listenerAnchor = anchorObject;

    return new Promise((resolve, reject) => {

        const sound = new THREE.PositionalAudio(anchorObject.listener); // THREE.Audio(listener) ... for basic playback
        const loader = new THREE.AudioLoader(loadManager);

        document.body.append(loadManager.div);

        loader.load(initSoundPath, (buffer) => {
            sound.setBuffer(buffer);
            sound.setRefDistance(1);
            sound.setVolume(1);

            anchorObject['sound'] = sound;

            console.log("Play sound!");

            sound.play();

            setTimeout(
                resolve,
                1500,
                sound
            );
            // });

        });
    });
}

function initSoundAnalyzer (sound) {

    return new Promise((resolve, reject) => {

        const analyzer = new THREE.AudioAnalyser(sound, 32);

        loadManager.addLoadHandler(() => {
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

    // const statsMesh = new HTMLMesh( stats.dom );
    // statsMesh.position.x = -0.75;
    // statsMesh.position.y = 1.25;
    // statsMesh.position.z = -0.5;
    // statsMesh.rotation.y = Math.PI / 4;
    // statsMesh.scale.setScalar( 2 );
    //
    // scene.add( statsMesh );

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

    // Make sure session is explicitly null before setting up the scene
    currentSession = null;

    // Setup Scene
    const updateScene = setup(renderer, scene, camera, controllers, player, async (data) => {

        if (data.hasOwnProperty("soundMesh")) {
            soundMesh = data["soundMesh"];
            soundAnalyzer = await initSoundAnalyzer(await initSound(soundMesh, "assets/audio/the_bardos_beyond_christmas.mp3"));
        }
    });

    // // Start loading the music
    // setTimeout(async (data) => {
    //
    //     if (data.hasOwnProperty("soundMesh")) {
    //         soundMesh = data["soundMesh"];
    //         soundAnalyzer = await initSoundAnalyzer(await initSound(soundMesh, "assets/audio/the_bardos_beyond_christmas.mp3"));
    //     }
    // }, 533);

    // // Setup Light
    // const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    // directionalLight.position.set(0, 1, 1);
    // scene.add(directionalLight);
    //
    // const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 3);
    // scene.add(hemisphereLight);

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

        if (!!skyTexture && skyTexture !== null) {
            material.onBeforeCompile = (shader) => {
                shader.uniforms.time = new THREE.Uniform(1.0); // <= DOES NOT WORK w/ MeshBasicMaterial
                shader.uniforms.uResolution = new THREE.Uniform(resolution);

                shader.vertexShader = starrySkyVertexShader;

                // console.log(shader.vertexShader);

                shader.fragmentShader = starrySkyFragmentShader;

                shader.fragmentShader = `
      uniform float time;
      uniform vec2 uResolution;
`
                    + shader.fragmentShader;

                // console.log(shader.fragmentShader);
            };

            material.onBeforeRender = (ctx) => {
                // console.log(ctx.constructor,  ": ", ctx);
            };
        }

        return new THREE.Mesh(geometry, material);
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

            shader.fragmentShader = `
      uniform vec2 uResolution;
`
                + shader.fragmentShader;

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

        return new THREE.Mesh(geometry, material);
    }

    // function updateTorus(mesh) {
    //     mesh.rotation.x += 0.01;
    //     mesh.rotation.y += 0.01;
    // }

    console.log("canvasTexture:", canvasTexture);

    // const groundInsideMesh = createGround(4, 0, mapColors.get("orangeLight"), null);
    // setLayer(groundInsideMesh, mapLayers.get("inside"));
    // scene.add(groundInsideMesh);

    const skyInsideMesh  = createSphere(50.0, mapColors.get("orangeDark"), canvasTexture);
    skyInsideMesh.position.y = 0.0
    setLayer(skyInsideMesh, mapLayers.get("inside"));
    scene.add(skyInsideMesh);

    // const shelfInsideMesh = createGround(100, 1, mapColors.get("green"), canvasTexture);
    // setLayer(shelfInsideMesh, mapLayers.get("inside"));
    // scene.add(shelfInsideMesh);

    const portalRadialBounds = 1.0; // relative to portal size

    const portalMesh = createPortal(portalRadialBounds * 2);
    portalMesh.position.set(0, 1.2, 0);
    setLayer(portalMesh, mapLayers.get("portal"));
    scene.add(portalMesh);

    // const torusMesh = createTorus(mapColors.get("grey"), canvasTexture);
    // torusMesh.position.set(0, 1, 0);
    // torusMesh.scale.set(2.0, 2.0, 2.0);
    // scene.add(torusMesh);

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
    const pointA = new THREE.Vector3( 0, 0.0, 0.0 );
    const pointB = getDirectionalEndPoint(pointA, new THREE.Vector3( 0.0, -1.0, 0.0 )); // <= , direction

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

        // torusMesh.material.clippingPlanes = (isInsidePortal) ? [
        //     clippingPlaneInside
        // ] : [
        //     clippingPlaneOutside
        // ];

        // portalRenderer.clippingPlanes = (isInsidePortal) ? [
        //     clippingPlaneInside
        // ] : [
        //     clippingPlaneOutside
        // ];

        portalRenderer.render(scene, camera);
        // renderer.render(scene, camera);
    }

    function renderWorld() {

        const delta = clock.getDelta();
        const timeElapsed = clock.getElapsedTime();

        const sceneDataUpdate = {};

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
        const viewingPlaneRight = 1; // x right
        const viewingPlaneTop = 2.5; // y top
        const viewingPlaneBottom = 1; // y bottom
        const viewingPlaneDepth = 0; // z
        const viewingPlaneHorizonalCenter = 0;
        const viewingPlaneVerticalCenter= (viewingPlaneBottom + viewingPlaneTop) / 2; // (viewingPlaneTop - viewingPlaneBottom)/ 2 + viewingPlaneBottom

        const clippingLeftP = new THREE.Vector3(viewingPlaneLeft, xrCameraA.y, viewingPlaneDepth);
        const clippingRightP = new THREE.Vector3(viewingPlaneRight, xrCameraA.y, viewingPlaneDepth);
        const clippingTopP = new THREE.Vector3(xrCameraA.x, viewingPlaneTop, viewingPlaneDepth);
        const clippingBottomP = new THREE.Vector3(xrCameraA.x, viewingPlaneBottom, viewingPlaneDepth);

        const vDLeft = new THREE.Vector3();
        vDLeft.subVectors(clippingLeftP, xrCameraA);
        const vDRight = new THREE.Vector3();
        vDRight.subVectors(clippingRightP, xrCameraA);
        const vDTop = new THREE.Vector3();
        vDTop.subVectors(clippingTopP, xrCameraA);
        const vDBottom = new THREE.Vector3();
        vDBottom.subVectors(clippingBottomP, xrCameraA);

        const clippingLeftUnitVector = new THREE.Vector3(1.0, 0, 0);
        const clippingLeftDirection = vDLeft.clone().cross(new THREE.Vector3(0, 1.0, 0)).normalize();
        const clippingLeftUnitAngleToDirection = clippingLeftUnitVector.angleTo(clippingLeftDirection.clone());
        const clippingLeftX = Math.cos(clippingLeftUnitAngleToDirection) * viewingPlaneLeft;
        const clippingRightUnitVector = new THREE.Vector3(-1.0, 0, 0);
        const clippingRightDirection = vDRight.clone().cross(new THREE.Vector3(0, -1.0, 0)).normalize();
        const clippingRightUnitAngleToDirection = clippingRightUnitVector.angleTo(clippingRightDirection.clone());
        const clippingRightX = Math.cos(clippingRightUnitAngleToDirection) * viewingPlaneRight;
        const clippingTopUnitVector = new THREE.Vector3(0, -1.0, 0);
        const clippingTopDirection = vDTop.clone().cross(new THREE.Vector3(1.0, 0, 0)).normalize();
        const clippingTopUnitAngleToDirection = clippingTopUnitVector.angleTo(clippingTopDirection.clone());
        const clippingTopY = Math.cos(clippingTopUnitAngleToDirection) * viewingPlaneTop;
        const clippingBottomUnitVector = (xrCameraA.z > viewingPlaneDepth) ?
            new THREE.Vector3(0, 1.0, 0) :
            new THREE.Vector3(0, -1.0, 0);
        const clippingBottomDirection = vDBottom.clone().cross(new THREE.Vector3(-1, 0, 0)).normalize(); // new THREE.Vector3(0, 1, 0);
        const clippingBottomUnitAngleToDirection = clippingBottomUnitVector.angleTo(clippingBottomDirection.clone());
        const clippingBottomY = Math.cos(clippingBottomUnitAngleToDirection) * viewingPlaneBottom; // viewingPlaneBottom = 1.0 // length on unit circle

        // // Set points on a line to show projected normal of given clipping plane
        // const lineGeometry = new THREE.BufferGeometry(),
        //     points = [];
        // points[0] = new THREE.Vector3( viewingPlaneLeft, viewingPlaneVerticalCenter, viewingPlaneDepth);
        // points[1] = getDirectionalEndPoint(points[0], clippingLeftDirection.clone());
        // // points[0] = new THREE.Vector3( viewingPlaneRight, viewingPlaneVerticalCenter, viewingPlaneDepth);
        // // points[1] = getDirectionalEndPoint(points[0], clippingRightDirection.clone());
        // // points[0] = new THREE.Vector3( viewingPlaneHorizonalCenter, clippingTopP.y, 0 );
        // // points[1] = getDirectionalEndPoint(points[0], clippingTopDirection.clone()); // clippingBottomDirection.clone()); // xrCameraDirection.clone());
        // lineGeometry.setFromPoints(points);
        // line.geometry = lineGeometry;
        // line.material.clippingPlanes = null;

        // const clippingLeftPlane = new THREE.Plane(clippingLeftUnitVector.clone(), 1.0);
        const clippingLeftPlane = new THREE.Plane(clippingLeftDirection.clone(), -clippingLeftX);
        // const clippingRightPlane = new THREE.Plane(clippingRightUnitVector.clone(), 1.0);
        const clippingRightPlane = new THREE.Plane(clippingRightDirection.clone(), clippingRightX);
        // const clippingTopPlane = new THREE.Plane(clippingTopUnitVector.clone(), 2.0);
        const clippingTopPlane = new THREE.Plane(clippingTopDirection.clone(), clippingTopY);
        // const clippingBottomPlane = new THREE.Plane(clippingBottomUnitVector.clone(), -(viewingPlaneBottom - 0.001));
        const clippingBottomPlane = new THREE.Plane(clippingBottomDirection.clone(), clippingBottomY * -(viewingPlaneBottom - 0.001));

        const new_data = JSON.stringify({
            "leftΘ": clippingLeftUnitAngleToDirection,
            "leftX": clippingLeftX,
             "rightΘ": clippingRightUnitAngleToDirection,
            "rightX": clippingRightX,
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
            clippingLeftPlane,
            clippingRightPlane,
            clippingTopPlane,
            clippingBottomPlane
        ] : [
            clippingPlaneInside,
            clippingPlaneOutside,
            clippingLeftPlane,
            clippingRightPlane,
            clippingTopPlane,
            clippingBottomPlane
        ];

        portalMesh.material.side = isInsidePortal ? THREE.BackSide : THREE.FrontSide;

        if (skyInsideMesh.material.hasOwnProperty("clippingPlanes")) {
            skyInsideMesh.material.clippingPlanes = [
                clippingPlaneOutside,
                clippingLeftPlane,
                clippingRightPlane,
                clippingTopPlane,
                clippingBottomPlane,
                // new THREE.Plane(clippingBottomUnitVector.clone(), -0.999)
            ];
        }

        if (skyInsideMesh.material.hasOwnProperty("uniforms")) {
            skyInsideMesh.material.uniforms.time.value = timeElapsed; // <= DOES NOT WORK w/ MeshBasicMaterial
        }

        // torusMesh.material.clippingPlanes = [
        //     clippingPlaneOutside,
        //     clippingLeftPlane,
        //     clippingRightPlane,
        //     clippingTopPlane,
        //     clippingBottomPlane,
        // ];

        updateScene(
            currentSession,
            delta,
            timeElapsed,
            (Object.keys(sceneDataUpdate).length > 0) ? sceneDataUpdate : null,
            null,
            [
                clippingPlaneOutside,
                clippingLeftPlane,
                clippingRightPlane,
                clippingTopPlane,
                clippingBottomPlane,
                // new THREE.Plane(clippingBottomUnitVector.clone(), -0.999)
            ]);

        uniforms.time["value"] = timeElapsed;

        // // Canvas elements doesn't trigger DOM updates, so we have to mark them for updates
        // portalTexture.needsUpdate = true;
        // statsMesh.material.map.update();

        // // Try to show controllers at all times
        // for (let hand of ["left", "right"]) {
        //     if (!!controllers[hand]
        //         && controllers[hand] !== null
        //         && controllers[hand].hasOwnProperty("mesh") && controllers[hand].mesh.material.hasOwnProperty("clippingPlanes")) {
        //         controllers[hand].mesh.material.clippingPlanes = null;
        //     }
        // }

        renderer.render(scene, camera);
    }




    function animate(t) {

        if (step_t === null) {
            step_t = t
        } else {
            step_t = t - step_t;
        }

        // console.log("step_t:", step_t);

        stats.begin();

        if (!!soundAnalyzer
            && soundAnalyzer.hasOwnProperty("analyser")
            && typeof soundAnalyzer.getFrequencyData === "function"
        ) {

            if (soundMesh.hasOwnProperty("sound") && !!soundMesh['sound'].isPlaying) {

                // sound analysis
                soundData.push([...soundAnalyzer.getFrequencyData()]);

                // console.log("Last soundData:", soundData[(soundData.length - 1)]);
            }

        // } else {
        //     console.log("soundAnalyzer is not ready:", soundAnalyzer);
        }

        // testPortalBounds();

        // updateTorus(torusMesh);
        updateCameraPosition();
        updateCameraTarget();

        if (currentSession === null || !nativeWebXRSupport) renderPortal();
        renderWorld();

        stats.end();
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

        if (soundMesh.hasOwnProperty("sound")) {
            console.log("Play sound!");
            soundMesh['sound'].pause();
            soundMesh['sound'].play();
        }
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

