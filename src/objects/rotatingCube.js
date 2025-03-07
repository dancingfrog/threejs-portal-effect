import * as THREE from 'three';
import cubeGeometry from "../geometry/cubeGeometry";
import meshMaterial from "../material/meshMaterial";
// import meshMaterials from "../material/meshMaterials";
import meshMaterialsPromise from "../material/meshMaterialsPromise";

const rotatingCube = new THREE.Mesh(cubeGeometry, meshMaterial);

// rotatingCube.material = meshMaterials;
meshMaterialsPromise
    .then((materials) => {
        console.log(materials);
        rotatingCube.material = materials;
    });


rotatingCube.position.y = 2;

rotatingCube.rotX = function (x) {
    // console.log(this);
    this.rotation.x += x;
}

rotatingCube.rotY = function (y) {
    // console.log(this);
    this.rotation.y += y;
}

export default rotatingCube;
