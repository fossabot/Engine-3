// @flow
import {Vector3} from "../lib/js/three/Vector3.js";
import type {IAGObject} from "./IAGObject.js";
import {IncrementOneCounter} from "./IDGenerator.js";
import {objectPartOfCollisions} from "./Collision.js";
import {g_IAudiCom, g_loading, g_playing, g_references} from "./AGEngine.js";
import {frbIntersectionPoint} from "./AGPhysics.js";
import {g_history} from "./AGEngine";

let gForward, gBackward, gLeft, gRight, gInteract;

//let moveTimestamp;

/**
 * Private function: if a collision is allowed (e.g., collision with portal) or not.
 * @param obj The object (IAGObject) to be checked with.
 * @param collArray The array of IAGObjects with the current collisions.
 * @returns {boolean} Returns true if collision is allowed, otherwise false.
 */
function allowedCollision(obj: IAGObject, collArray: Array<IAGObject>): boolean {
    for (let i = 0; i < collArray.length; i++) {
        if (obj !== collArray[i] && collArray[i].type !== "PORTAL") {
            //console.log("[AGNavigation] " + obj.name + ": Condition failed at object " + collArray[i].name + ".");
            return false;
        }
    }
    return true;
}

/**
 * Moves the IAGObject into direction, depending on speed. Needs a timeStamp for deltaTime (frame-independent movement)
 * @param object The IAGObject that should be move.
 * @param direction The direction as Vector3 the object should be moved to.
 * @param timeStamp A current frame-timestamp.
 */
export function move(object: IAGObject, direction: Vector3, timeStamp?: Date) {
    let timeDiff;
    if (timeStamp !== undefined) {
        timeDiff = new Date() - timeStamp;
        timeDiff /= 1000;
    } else {
        timeDiff = 1;
    }

    object.position.add(object.speed.clone().multiply(direction).clone().multiplyScalar(timeDiff));
    object.room.checkForCollision();

    let PoC: Array<IAGObject> = objectPartOfCollisions(object.room.collisions, object);

    if (!allowedCollision(object, PoC)) {
        console.log("[AGNavigation] " + object.name + ": Can't move forward. Colliding with other object.");

        //Calculate position for collision sound, can be put before or after the sub
        pointOfIntersectionForSound(PoC[0], object);
        object.position.sub(object.speed.clone().multiply(direction).clone().multiplyScalar(timeDiff));


    } else if (!object.room.pointInsideRoom(object.position, object.size)) {
        console.log("[AGNavigation] " + object.name + ": Can't move forward. Colliding with room boundaries.");
        object.position.sub(object.speed.clone().multiply(direction).clone().multiplyScalar(timeDiff));
    }
}

function pointOfIntersectionForSound(collisionObject: IAGObject, object: IAGObject) {
    let p1: Vector3, p2: Vector3, p3: Vector3, p4: Vector3;

    //get the 8 corners of the cube
    let p1TOP: Vector3 = extractPlanePoint(object, -1, +1, -1);
    let p1BOTTOM: Vector3 = extractPlanePoint(object, -1, -1, -1);

    let p2TOP: Vector3 = extractPlanePoint(object, +1, +1, -1);
    let p2BOTTOM: Vector3 = extractPlanePoint(object, +1, -1, -1);

    let p3TOP: Vector3 = extractPlanePoint(object, -1, +1, +1);
    let p3BOTTOM: Vector3 = extractPlanePoint(object, -1, -1, +1);

    let p4TOP: Vector3 = extractPlanePoint(object, +1, +1, +1);
    let p4BOTTOM: Vector3 = extractPlanePoint(object, +1, -1, 1);

    //middle it to 4
    p1 = p1TOP.clone().sub((p1TOP.clone().sub(p1BOTTOM).clone().multiplyScalar(0.5)));
    p2 = p2TOP.clone().sub((p2TOP.clone().sub(p2BOTTOM).clone().multiplyScalar(0.5)));
    p3 = p3TOP.clone().sub((p3TOP.clone().sub(p3BOTTOM).clone().multiplyScalar(0.5)));
    p4 = p4TOP.clone().sub((p4TOP.clone().sub(p4BOTTOM).clone().multiplyScalar(0.5)));

    //rotate the corners according to the direction of the object
    p1 = rotateAroundPoint(object.position, p1, getAngle(object.direction));
    p2 = rotateAroundPoint(object.position, p2, getAngle(object.direction));
    p3 = rotateAroundPoint(object.position, p3, getAngle(object.direction));
    p4 = rotateAroundPoint(object.position, p4, getAngle(object.direction));

    //array for the 4 points, so it is easier to iterate later on
    let points: Array<Vector3> = [];
    points.push(p2);
    points.push(p3);
    points.push(p4);
    points.push(p1);

    points.push(p4);
    points.push(p3);
    points.push(p2);
    points.push(p1);

    //build directions between points
    let dirs: Array<Vector3> = [];
    dirs.push(p1.clone().sub(p2).normalize());
    dirs.push(p2.clone().sub(p3).normalize());
    dirs.push(p3.clone().sub(p4).normalize());
    dirs.push(p4.clone().sub(p1).normalize());
    dirs.push(p1.clone().sub(p4).normalize());
    dirs.push(p4.clone().sub(p3).normalize());
    dirs.push(p3.clone().sub(p2).normalize());
    dirs.push(p2.clone().sub(p1).normalize());

    let intersectPoints: Array<Vector3> = [];

    //closest point after iteration
    let smallest: Vector3 = null;
    let smallestDist: number = Number.MAX_VALUE;

    //saves pair of Distance and Vector
    let pairDistancePoint: Array<[number, Vector3]> = [];

    if (g_IAudiCom) g_IAudiCom.deleteDots();

    //shoot rays from 8 directions, over corners
    for (let i = 0; i < 8; i++) {
        let dist: number = extractPointToArray(collisionObject, points[i], dirs[i], intersectPoints);
        if (dist !== undefined && dist !== 0) {
            pairDistancePoint.push([dist, intersectPoints[intersectPoints.length - 1]]);
            //g_IAudiCom.drawDot(pairDistancePoint[pairDistancePoint.length-1][1].x, pairDistancePoint[pairDistancePoint.length-1][1].z);
            if (pairDistancePoint[pairDistancePoint.length - 1][0] < smallestDist) {
                smallestDist = pairDistancePoint[pairDistancePoint.length - 1][0];
                smallest = pairDistancePoint[pairDistancePoint.length - 1][1];
            }
        }
    }

    //console.log(pairDistancePoint);

    //console.log(extractPointToArray(collisionObject, p2, dirs[0], intersectPoints));
    //console.log(extractPointToArray(collisionObject, p3, dirs[1], intersectPoints));
    //console.log(extractPointToArray(collisionObject, p4, dirs[2], intersectPoints));
    //console.log(extractPointToArray(collisionObject, p1, dirs[3], intersectPoints));

    //console.log(extractPointToArray(collisionObject, p4, dirs[4], intersectPoints));
    //console.log(extractPointToArray(collisionObject, p3, dirs[5], intersectPoints));
    //console.log(extractPointToArray(collisionObject, p2, dirs[6], intersectPoints));
    //console.log(extractPointToArray(collisionObject, p1, dirs[7], intersectPoints));

    //console.log(smallest);
    //console.log(smallestDist);


    //console.log(intersectPoints);

    //for(let i = 0; i < intersectPoints.length; i++){

    if (g_IAudiCom && smallest != null) {
        //console.log(intersectPoints[i].distanceTo(object.position));
        g_IAudiCom.drawDot(smallest.x, smallest.z);
        if (object.type === "PLAYER" && object.hitSound) object.hitSound.playOnceAtPosition(smallest);

        for (let i = 0; i < 4; i++) {
            //g_IAudiCom.drawDot(points[i].x, points[i].z);
        }
    }
    //}
}

function getAngle(dir: Vector3): number {
    let angle = Math.atan2(dir.x, dir.z);
    let degrees = 180 * angle / Math.PI;
    return (180 + Math.round(degrees)) % 360;
}

function rotateAroundPoint(center: Vector3, point: Vector3, angle: number): Vector3 {
    let radians = (Math.PI / 180) * angle,
        cos = Math.cos(radians),
        sin = Math.sin(radians),
        nx = (cos * (point.x - center.x)) + (sin * (point.z - center.z)) + center.x,
        nz = (cos * (point.z - center.z)) - (sin * (point.x - center.x)) + center.z;
    return new Vector3(nx, point.y, nz);
}

function extractPointToArray(collisionObject: IAGObject, point: Vector3, dir: Vector3, arrToAdd: Array<Vector3>): number {
    let pt: Vector3 = frbIntersectionPoint(collisionObject, point, dir);
    if (pt !== null) {
        arrToAdd.push(pt);
        return point.distanceTo(pt);
    }
    return 0;
}

/*
function pointOfIntersection(PoC_arr:Array<IAGObject>, obj:IAGObject){
    let point:Vector3;
    for(let i = -1; i <= 1; i+=2){
        for(let j = -1; j <= 1; j+=2){
            for(let k = -1; k <= 1; k+=2){
                point = new Vector3(obj.position.x-(obj.size.x/2)*(i), obj.position.y-(obj.size.y/2)*(j), obj.position.z-(obj.size.z/2)*(k));
                if(isPointInsideAABB(point, PoC_arr[0])){
                    console.log("[AGNavigation] " + obj.name + ": Playing sound at position: " + Math.round(point.x) + " " + Math.round(point.y) + " " + Math.round(point.z));
                }
            }
        }
    }
}*/
/*
//https://stackoverflow.com/questions/6408670/line-of-intersection-between-two-planes
function planeIntersectPlane(PoC_arr:Array<IAGObject>, obj:IAGObject){
    let r_points:Array<Vector3> = [], r_normals:Array<Vector3> = [];
    let plane1_arr:Array<Plane> = calculatePlanesCCW(PoC_arr[0]);
    let plane2_arr:Array<Plane> = calculatePlanesCCW(obj);

    if(g_IAudiCom) g_IAudiCom.deleteDots();

    for(let i = 0; i < plane1_arr.length; i++){
        for(let j = 0; j < plane2_arr.length; j++){
            let plane1:Plane = plane1_arr[i];
            let plane2:Plane = plane2_arr[j];

            let p3_normal:Vector3 = new Vector3();
            p3_normal.crossVectors(plane1.normal, plane2.normal);
            const det:number = p3_normal.lengthSq();

            //console.log(p3_normal.clone().cross(plane2.normal).clone().multiplyScalar(plane1.constant).clone().add(plane1.clone().normal.cross(p3_normal).clone().multiplyScalar(plane2.constant)));
            if(det !== 0.0){
                let vToPush:Vector3 = (p3_normal.clone().cross(plane2.normal).clone().multiplyScalar(plane1.constant).add(plane1.clone().normal.cross(p3_normal).clone().multiplyScalar(plane2.constant))).clone().divideScalar(det);
                if(pointInsideSphere(vToPush, obj)){
                    if(g_IAudiCom) {
                        g_IAudiCom.drawDot(vToPush.x, vToPush.z);
                    }
                    r_points.push(vToPush);
                    r_normals.push(p3_normal);
                }
            } else {
                //console.log("nah");
            }

        }
    }

    //console.log(r_points);
    //console.log(r_normals);
}

 */
/*
function pointInsideSphere(point:Vector3, obj:IAGObject):boolean{
    //console.log((point.clone().distanceTo(obj.position.clone())));
    if((point.clone().distanceTo(obj.position.clone())) <= (obj.position.clone().add(obj.size)).clone().distanceTo(obj.position)) return true;
    return false;
}*/

/*
function calculatePlanesCCW(obj:IAGObject):Array<IAGObject> {
    let return_arr:Array<IAGObject> = [];

    let plane_a:Plane = new Plane();
    let plane_b:Plane = new Plane();
    let plane_c:Plane = new Plane();
    let plane_d:Plane = new Plane();
    let plane_e:Plane = new Plane();
    let plane_f:Plane = new Plane();
    let v1:Vector3, v2:Vector3, v3:Vector3;

    v1 = extractPlanePoint(obj, -1,+1,-1);
    v2 = extractPlanePoint(obj, -1, -1, -1);
    v3 = extractPlanePoint(obj, +1, -1, -1);
    plane_a.setFromCoplanarPoints(v1.clone(), v2.clone(), v3.clone());
    console.log(plane_a);
    return_arr.push(plane_a);

    v1 = extractPlanePoint(obj, +1,+1,-1);
    v2 = extractPlanePoint(obj, +1, -1, -1);
    v3 = extractPlanePoint(obj, +1, -1, +1);
    plane_b.setFromCoplanarPoints(v1.clone(), v2.clone(), v3.clone());
    return_arr.push(plane_b);

    v1 = extractPlanePoint(obj, -1,+1,+1);
    v2 = extractPlanePoint(obj, -1, +1, -1);
    v3 = extractPlanePoint(obj, +1, +1, -1);
    plane_c.setFromCoplanarPoints(v1.clone(), v2.clone(), v3.clone());
    return_arr.push(plane_c);

    v1 = extractPlanePoint(obj, +1,+1,+1);
    v2 = extractPlanePoint(obj, +1, -1, +1);
    v3 = extractPlanePoint(obj, -1, -1, +1);
    plane_d.setFromCoplanarPoints(v1.clone(), v2.clone(), v3.clone());
    return_arr.push(plane_d);

    v1 = extractPlanePoint(obj, -1,+1,+1);
    v2 = extractPlanePoint(obj, -1, -1, +1);
    v3 = extractPlanePoint(obj, -1, -1, -1);
    plane_e.setFromCoplanarPoints(v1.clone(), v2.clone(), v3.clone());
    return_arr.push(plane_e);

    v1 = extractPlanePoint(obj, +1,-1,+1);
    v2 = extractPlanePoint(obj, +1, -1, -1);
    v3 = extractPlanePoint(obj, -1, -1, -1);
    plane_f.setFromCoplanarPoints(v1.clone(), v2.clone(), v3.clone());
    return_arr.push(plane_f);

    return return_arr;
}
 */

function extractPlanePoint(obj: IAGObject, x: number, y: number, z: number): Vector3 {
    let returnV: Vector3 = new Vector3(obj.position.x + (obj.size.x / 2 * x), obj.position.y + (obj.size.x / 2 * y), obj.position.z + (obj.size.z / 2 * z));
    return returnV;
}

/**
 * Class that is responsible for the movement buttons of the respective object.
 */
export class AGNavigation {

    _ID: number;

    get ID() {
        return this._ID;
    }


    get forward(): number {
        return gForward;
    }

    set forward(value: number) {
        // $FlowFixMe
        if (!g_loading && !g_playing) g_history.ike(this._ID, 'set forward', this.constructor.name, arguments);
        gForward = value;
    }

    get backward(): number {
        return gBackward;
    }

    set backward(value: number) {
        // $FlowFixMe
        if (!g_loading && !g_playing) g_history.ike(this._ID, 'set backward', this.constructor.name, arguments);
        gBackward = value;
    }

    get left(): number {
        return gLeft;
    }

    set left(value: number) {
        // $FlowFixMe
        if (!g_loading && !g_playing) g_history.ike(this._ID, 'set left', this.constructor.name, arguments);
        gLeft = value;
    }

    get right(): number {
        return gRight;
    }

    set right(value: number) {
        // $FlowFixMe
        if (!g_loading && !g_playing) g_history.ike(this._ID, 'set right', this.constructor.name, arguments);
        gRight = value;
    }

    get interact(): number {
        return gInteract;
    }

    set interact(value: number) {
        gInteract = value;
    }

    /**
     *
     * @param forward Keycode for forward-movement.
     * @param backward Keycode for backward-movement.
     * @param left Keycode for left-turn.
     * @param right Keycode for right-turn.
     */
    constructor(forward: number, backward: number, left: number, right: number, interact: number) {
        this._ID = IncrementOneCounter.next();
        g_references.set(this._ID, this);
        console.log("[AGNavigation] Creating AGNavigation object [ID: " + this._ID + "].");
        gForward = forward;
        gBackward = backward;
        gLeft = left;
        gRight = right;
        gInteract = interact;

        if (!g_loading && !g_playing) g_history.ike(this._ID, this.constructor.name, this.constructor.name, arguments);
        //moveTimestamp = new Date(0);
    }

    /**
     * draw-loop
     * @param player Object (IAGObject) which can be moved by the player.
     */
    draw(player: IAGObject) {
        //if(moveTimestamp.getTime() === new Date(0).getTime()) moveTimestamp = new Date();
        window.onkeydown = function (e) {
            if (e.keyCode === -1) return;
            switch (e.keyCode) {
                case gForward:
                    //move(player, true);
                    move(player, player.direction);
                    break;
                case gBackward:
                    //move(player, false);
                    move(player, player.direction.clone().multiplyScalar(-1));
                    break;
                case gLeft:
                    player.direction.applyAxisAngle(new Vector3(0, 1, 0), 8 * (Math.PI / 180));
                    break;
                case gRight:
                    player.direction.applyAxisAngle(new Vector3(0, 1, 0), -8 * (Math.PI / 180));
                    break;
                case gInteract:
                    player.interact();
                    break;
            }
            // moveTimestamp = new Date();
            //console.log("Position: " + player.position.x + " " + player.position.y + " " + player.position.z);
            //console.log("Direction: " + player.direction.x + " " + player.direction.y + " " + player.direction.z);
        }

    }
}