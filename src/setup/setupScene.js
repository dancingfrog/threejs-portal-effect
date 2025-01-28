import * as THREE from "three";
import { Water } from "three/addons/objects/Water";

import loadManager from "../loadManager";

import defaultVertexShader from '../shaders/default/vertexShader.glsl';
import defaultFragmentShader from '../shaders/default/fragmentShader.glsl';

import wavesVertexShader from '../shaders/waves/vertexShader.glsl';

const SIZE = 5;
const RESOLUTION = 512;

let sceneGroup, textureRepeatScale, uniforms, water;

export default async function setupScene (renderer, scene, camera, controllers, player) {

    // Set player view
    player.add(camera);

    sceneGroup = new THREE.Group();

    textureRepeatScale = 10

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

    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, RESOLUTION, RESOLUTION).rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
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
    });

    const plane = new THREE.Mesh(geometry, material);

    water = new Water(
        new THREE.PlaneGeometry( 10000, 10000 ),
        {
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

    // Place lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
    directionalLight.position.set(-0.5, 10, -10)
    sceneGroup.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    sceneGroup.add(ambientLight)

    // const pmremGenerator = new THREE.PMREMGenerator( renderer );
    // const sceneEnv = new THREE.Scene();

    // Place objects
    sceneGroup.add(plane);
    sceneGroup.add(water);

    scene.add(sceneGroup);

    sceneGroup.translateX(0.0);
    sceneGroup.translateY(1.0);
    sceneGroup.translateZ(-5.0);

    return function (currentSession, delta, time, data_in, sendData_out, clippingPlanes) {

        const data_out = {};

        if (typeof data_in === "object" && data_in != null) {
            console.log("data_in:", data_in);
        }

        // update the time uniform(s)
        plane.material.uniforms.time.value = time
        water.material.uniforms[ 'time' ].value += 0.1 / 60.0;

        if (clippingPlanes !== null && clippingPlanes.length > 0) {
            sceneGroup.traverse(function (child) {
                if (child.hasOwnProperty("material")) {
                    child.material.clippingPlanes = [
                        ...clippingPlanes
                    ];
                }
            });
        }

        if (data_out.hasOwnProperty("event") && typeof sendData_out === "function") {
            sendData_out(data_out);
        }
    }
}
