import * as THREE from "three";
import { Water } from "three/addons/objects/Water";

import loadManager from "../loadManager";

import rotatingTorus from "../objects/rotatingTorus";

import defaultVertexShader from '../shaders/default/vertexShader.glsl';
import defaultFragmentShader from '../shaders/default/fragmentShader.glsl';

import wavesVertexShader from '../shaders/waves/vertexShader.glsl';

const RESOLUTION = 512;
const SIZE = 5;
const TEXTURE_REPEAT_SCALE = 10;

let uniforms = {
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

export default function setupScene (renderer, scene, camera, controllers, player, onSetupComplete = (data) => {}) {

    // Set player view
    player.add(camera);

    const sceneGroup = new THREE.Group();

    let dream_landed = false;

    let sceneX = 0.0;
    let sceneY = 1.0;
    let sceneZ = -100.0;

    // Place lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(-0.5, 10, -10);
    sceneGroup.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    sceneGroup.add(ambientLight);

    // const pmremGenerator = new THREE.PMREMGenerator( renderer );
    // const sceneEnv = new THREE.Scene();

    const water = new Water(
        new THREE.PlaneGeometry( 10000, 10000 ),
        {
            clipping: true,
            clipShadows: true,
            distortionScale: 1 / TEXTURE_REPEAT_SCALE,
            fog: scene.fog !== undefined,
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader(loadManager).load( 'assets/material/textures/waternormals.jpg', function ( texture ) {
                texture.repeat.set(TEXTURE_REPEAT_SCALE, TEXTURE_REPEAT_SCALE);
                // texture.repeat.x = TEXTURE_REPEAT_SCALE;
                // texture.repeat.y = TEXTURE_REPEAT_SCALE;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping
            } ),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f
        }
    );

    water.rotation.x = - Math.PI / 2;
    water.scale.x = water.scale.x; // / TEXTURE_REPEAT_SCALE;
    water.scale.y = water.scale.y; // / TEXTURE_REPEAT_SCALE;
    water.position.y = -TEXTURE_REPEAT_SCALE/2;

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
    sceneGroup.translateZ(sceneZ);

    const zSpeed = 0.05;

    console.log(sceneGroup);

    onSetupComplete({ "soundMesh": torusMesh });

    return function (currentSession, delta, time, data_in, sendData_out, clippingPlanes) {

        const data_out = {};

        if (typeof data_in === "object" && data_in != null) {
            console.log("data_in:", data_in);
        }

        rotateMesh(torusMesh);

        sceneZ += zSpeed;

        if (sceneZ < -2.5) {
            sceneGroup.translateZ(zSpeed);

            if (sceneZ < -25.0) {

                rotatingMesh.rotX(0.05 * (5 * delta));
                rotatingMesh.rotY(0.075 * (5 * delta));
            } else {
                rotatingMesh.rotation.set(
                    rotatingMesh.rotation.x - rotatingMesh.rotation.x / 50,
                    rotatingMesh.rotation.y - rotatingMesh.rotation.y / 50,
                    rotatingMesh.rotation.z - rotatingMesh.rotation.z / 50);
            }
        } else {
            rotatingMesh.rotation.set(0, 0, 0);


            if (!dream_landed) {
                dream_landed = true;
                data_out["event"] = "dream_landed";
            }
        }

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
