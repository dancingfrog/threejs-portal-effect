import * as THREE from "three";
import { Water } from "three/addons/objects/Water";

import loadManager from "../loadManager";

import rotatingTorus from "../objects/rotatingTorus";

import defaultVertexShader from '../shaders/default/vertexShader.glsl';
import defaultFragmentShader from '../shaders/default/fragmentShader.glsl';

import wavesVertexShader from '../shaders/waves/vertexShader.glsl';

const SIZE = 5;
const RESOLUTION = 512;

let sceneGroup, textureRepeatScale, uniforms, water, dream_landed = false;

let sceneX = 0.0;
let sceneY = 1.0;
let sceneZ = -100.0;

export default function setupScene (renderer, scene, camera, controllers, player) {

    // Set player view
    player.add(camera);

    sceneGroup = new THREE.Group();

    textureRepeatScale = 10;

    // Place lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(-0.5, 10, -10);
    sceneGroup.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    sceneGroup.add(ambientLight);

    // const pmremGenerator = new THREE.PMREMGenerator( renderer );
    const sceneEnv = new THREE.Scene();

    uniforms = {
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
        time: { value: 1.0 }
    };

    water = new Water(
        new THREE.PlaneGeometry( 10000, 10000 ),
        {
            clipping: true,
            clipShadows: true,
            distortionScale: 1 / textureRepeatScale,
            fog: scene.fog !== undefined,
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader(loadManager).load( 'assets/material/textures/waternormals.jpg', function ( texture ) {
                texture.repeat.set(textureRepeatScale, textureRepeatScale);
                // texture.repeat.x = textureRepeatScale;
                // texture.repeat.y = textureRepeatScale;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping
            } ),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f
        }
    );

    water.rotation.x = - Math.PI / 2;
    water.scale.x = water.scale.x; // / textureRepeatScale;
    water.scale.y = water.scale.y; // / textureRepeatScale;
    water.position.y = -textureRepeatScale/2;

    // Setup canvas texture
    const textureCanvas = document.createElement('canvas');
    const canvasTexture = new THREE.CanvasTexture(textureCanvas);

    function randInt(min, max) {
        if (max === undefined) {
            max = min;
            min = 0;
        }
        return Math.random() * (max - min) + min | 0;
    }

    function drawRandomDot(texture) {
        const ctx = texture.source.data.getContext('2d');

        ctx.strokeStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
        ctx.fillStyle = `#${randInt(0x1000000).toString(16).padStart(6, '0')}`;
        ctx.beginPath();

        const x = randInt(ctx.canvas.width);
        const y = randInt(ctx.canvas.height);
        const radius = randInt(10, 64);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();

        return ctx;
    }

    // for (let i = 0; i < 1000; i++) {
    //     drawRandomDot(canvasTexture);
    // }

    function generateFaceLabel(texture, faceColor, textColor, text) {
        const ctx = texture.source.data.getContext('2d');

        ctx.canvas.width = ctx.canvas.height = 100;

        ctx.fillStyle = "transparent";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const {width, height} = ctx.canvas;
        ctx.fillStyle = faceColor;
        ctx.fillRect(0, 0, width, height);
        ctx.font = `${width * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(text, width / 2, height / 2);

        return ctx;
    }

    function generateFaceGrid(texture, gridColor, gridSpacingPixels) {

        const textureRepeatScale = gridSpacingPixels * gridSpacingPixels;
        texture.repeat.set(textureRepeatScale, textureRepeatScale);
        texture.repeat.x = textureRepeatScale;
        texture.repeat.y = textureRepeatScale;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        texture.colorSpace = THREE.SRGBColorSpace;

        const ctx = texture.source.data.getContext('2d');

        ctx.canvas.width = ctx.canvas.height = textureRepeatScale;

        const w = ctx.canvas.width,
            h = ctx.canvas.height;

        ctx.fillStyle = "transparent";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.strokeStyle = gridColor;
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

        return ctx;
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
            waveMaterial;

        return new THREE.Mesh(geometry, material);
    }

    function rotateMesh (mesh) {
        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.01;
    }

    // generateFaceLabel(textureCanvasCtx, '#F00', '#0FF', '+X');
    generateFaceGrid(canvasTexture, '#09F', 10.0);

    const waveGeometry = new THREE.PlaneGeometry(SIZE, SIZE, RESOLUTION, RESOLUTION).rotateX(-Math.PI / 2);
    const waveMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: wavesVertexShader, // vertex_shader,
        fragmentShader: defaultFragmentShader,
        lights: true,
        side: THREE.DoubleSide,
        defines: {
            STANDARD: '',
            PHYSICAL: '',
        },
        extensions: {
            derivatives: true,
        },
        clipping: true,
        clipShadows: true
    });

    const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
    waveMesh.position.set(0, -1, 0);

    const rotatingMesh = rotatingTorus;

    rotatingMesh.material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: defaultVertexShader,
        fragmentShader: defaultFragmentShader,
    });

    const torusMesh = createTorus(new THREE.Color(0xdddddd)); //, canvasTexture);
    torusMesh.material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: defaultVertexShader,
        fragmentShader: defaultFragmentShader,
    });
    torusMesh.position.set(0, 1, 0);


    // Place objects
    // sceneGroup.add(water);
    sceneGroup.add(waveMesh);
    sceneGroup.add(rotatingMesh);
    sceneGroup.add(torusMesh);

    scene.add(sceneGroup);

    sceneGroup.translateX(0.0);
    sceneGroup.translateY(1.0);
    sceneGroup.translateZ(-5.0);

    console.log(sceneGroup);

    const zSpeed = 0.05;

    function propagateClippingPlanes (object, clippingPlanes) {
        if (object.hasOwnProperty("material")) {
            // console.log("Apply clipping planes to ", object);
            object.material.clippingPlanes = [
                ...clippingPlanes
            ];
        }
        if (object.hasOwnProperty("traverse")) {
            object.traverse(function (child) {
                propagateClippingPlanes(child, clippingPlanes);
            });
        } else if (object.hasOwnProperty("children")) for (let child of object.children) {
            propagateClippingPlanes(child, clippingPlanes);
        }
    }

    return function (currentSession, delta, time, data_in, sendData_out, clippingPlanes) {

        const data_out = {};

        if (typeof data_in === "object" && data_in != null) {
            console.log("data_in:", data_in);
        }

        rotateMesh(torusMesh);

        // update the time uniform(s)
        waveMesh.material.uniforms.time.value = time
        water.material.uniforms[ 'time' ].value += 0.1 / 60.0;

        if (clippingPlanes !== null && clippingPlanes.length > 0) {
            propagateClippingPlanes (sceneGroup, clippingPlanes);
        }

        if (data_out.hasOwnProperty("event") && typeof sendData_out === "function") {
            sendData_out(data_out);
        }
    }
}
