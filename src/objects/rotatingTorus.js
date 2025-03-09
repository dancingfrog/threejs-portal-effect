import * as THREE from 'three';
import meshMaterial from "../material/meshMaterial";
import torusGeometry from "../geometry/torusGeometry";

const rotatingTorus = new THREE.Mesh(torusGeometry, meshMaterial);

rotatingTorus.position.y = 2;

rotatingTorus.rotX = function (x) {
    // console.log(this);
    this.rotation.x += x;
}

rotatingTorus.rotY = function (y) {
    // console.log(this);
    this.rotation.y += y;
}

export default rotatingTorus;
