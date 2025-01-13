import * as THREE from "three";


export default async function setupScene (scene, camera, controllers, player) {

    // Set player view
    player.add(camera);

    return function (currentSession, delta, time, data_in, sendData_out) {

        const data_out = {};

        if (typeof data_in === "object" && data_in != null) {
            console.log("data_in:", data_in);
        }

        if (data_out.hasOwnProperty("event") && typeof sendData_out === "function") {
            sendData_out(data_out);
        }
    }
}
