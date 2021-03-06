// @flow

import {Event} from "./Event.js";
import type {IAGObject} from "./IAGObject.js";
import type {Action, Trigger} from "./EventType.js";
import {IncrementOneCounter} from "./IDGenerator.js";
import {g_gamearea, g_loading, g_playing, g_references, getReferenceById} from "./AGEngine.js";
import {GlobalEvent} from "./GlobalEvent.js";
import {AGItem} from "./AGItem.js";
import {g_history} from "./AGEngine";

/**
 * Eventhandler Class
 */
export class AGEventHandler {
    get ID() {
        return this._ID;
    }

    get events(): Array<Event> {
        return this._events;
    }

    set events(value: Array<Event>) {
        this._events = value;
    }

    /**
     * Adds a new event to the Eventlist.
     * @param eventID The event ID of the event to be added to the Eventlist.
     */
    addEvent(eventID: number) {
        this._events.push(getReferenceById(eventID));
        if (!g_loading && !g_playing) g_history.ike(this._ID, this.addEvent.name, this.constructor.name, arguments);
    }

    /**
     * Removes an Event from the Eventlist by ID.
     * @param eventID The ID of the Event to be removed.
     */
    removeEventByID(eventID: number) {
        this.removeEvent(getReferenceById(eventID));
        if (!g_loading && !g_playing) g_history.ike(this._ID, this.removeEventByID.name, this.constructor.name, arguments);
        g_references.delete(eventID);
    }

    /**
     * Removes an Event from the Eventlist by Event Object.
     * @param event The Object that should be removed.
     */
    removeEvent(event: Event) {
        console.log("[AGEventHandler] Removing Event [ID: " + event.ID + "].");
        this._events.splice(this.findEventIndex(event), 1);
    }

    /**
     * Removes a GlobalEvent from the GlobalEventlist by ID.
     * @param eventID The ID of the GlobalEvent to be removed.
     */
    removeGlobalEventByID(eventID: number) {
        this.removeEvent(getReferenceById(eventID));
        if (!g_loading && !g_playing) g_history.ike(this._ID, this.removeGlobalEventByID.name, this.constructor.name, arguments);
        g_references.delete(eventID);
    }

    /**
     * Removes a GlobalEvent from the Eventlist by GlobalEvent Object.
     * @param event The Object that should be removed.
     */
    removeGlobalEvent(event: GlobalEvent) {
        console.log("[AGEventHandler] Removing Global Event [ID: " + event.ID + "].");
        this._globalEvents.splice(this.findGlobalEventIndex(event), 1);
    }

    _ID: number;
    _events: Array<Event>;
    _globalEvents: Array<GlobalEvent>;

    constructor() {
        this._ID = IncrementOneCounter.next();
        g_references.set(this._ID, this);
        if (!g_loading && !g_playing) g_history.ike(this._ID, this.constructor.name, this.constructor.name, arguments);
        console.log("[AGEventHandler] Creating AGEventHandler object [ID: " + this._ID + "].");
        this._events = [];
        this._globalEvents = [];
    }


    evaluateGlobalEvents() {
        for (let i = 0; i < this._globalEvents.length; i++) {
            this.evaluateGlobalEvent(this._globalEvents[i]);
        }
    }

    addGlobalEvent(eventID: number) {
        this._globalEvents.push(getReferenceById(eventID));
        if (!g_loading && !g_playing) g_history.ike(this._ID, this.addGlobalEvent.name, this.constructor.name, arguments);
    }

    /**
     * Evaluates a GlobalEvent if the conditions are met. Returns true, if the conditions are met.
     * @param event The GlobalEvent object to be evaluated.
     * @returns {boolean} Returns true, if the event's conditions are met, otherwise false.
     */
    evaluateGlobalEvent(event: GlobalEvent): boolean {
        //console.log(event.funcOfConditionObject.apply(event.object.inventory, event.funcArgs));
        if ((event.repeat >= 1 || event.repeat === -1)) {
            switch (event.conditionObject) {
                case "INVENTORY":
                    if (event.object.inventory) {
                        if (event.funcOfConditionObject.apply(event.object.inventory, event.funcArgs) === event.value) {
                            console.log("[AGEventHandler] Requirements for Global Event fulfilled. Executing action.");
                            console.log(event);
                            this.fireAction(event.action);
                            if (event.repeat >= 1) event.repeat--;
                            return true;
                        }
                    }
                    break;
            }
        }
        return false;
    }

    /**
     * Triggers an action. Currently only WINGAME is available.
     * @param action The Action to be triggered.
     */
    fireAction(action: Action) {
        switch (action) {
            case "WINGAME":
                g_gamearea.listener.room.solved = true;
                break;
        }
    }

    /**
     * Returns the index of the event.
     * @param event Event to be queried.
     * @returns {number} Returns the index of the event.
     */
    findEventIndex(event: Event): number {
        for (let i = 0; i < this._events.length; i++) {
            if (this._events[i].origin === event.origin &&
                this._events[i].trigger === event.trigger &&
                this._events[i].action === event.action &&
                this._events[i].object === event.object &&
                this._events[i].addObject === event.addObject
            ) return i;
        }
        return -1;
    }

    /**
     * Returns the index of the GlobalEvent object in the global events list. (function deprecated)
     * @param event The GlobalEvent object to be searched for.
     * @returns {number} Returns the ID of the GlobalEvent.
     */
    findGlobalEventIndex(event: GlobalEvent): number {
        for (let i = 0; i < this._globalEvents.length; i++) {
            if (this._globalEvents[i].ID === event.ID)
                return i;
        }
        return -1;
    }

    /**
     * Deletes all events (also removing from reference table) that contain a specific item (ID).
     * @param itemID The ID of the AGItem.
     */
    deleteEventsContainingItemById(itemID: number) {
        let agitem: AGItem = getReferenceById(itemID);
        let that = this;
        this._events.forEach(function (item) {
            if (item.addObject === agitem) {
                that.removeEventByID(item.ID);
                console.log("[AGEventHandler] Deleted Event [ID: " + item.ID + "] from References Table.");
            }
        })
    }

    /**
     * Deletes all events (also removing from reference table) that contain a specific object (ID).
     * @param objectID The ID of the AGObject.
     */
    deleteEventsContainingObjectById(objectID: number) {
        let agobject: IAGObject = getReferenceById(objectID);
        let that = this;
        this._events.forEach(function (item) {
            if (item.addObject === agobject ||
                item.origin === agobject ||
                item.object === agobject) {
                that.removeEventByID(item.ID);
                console.log("[AGEventHandler] Deleted Event [ID: " + item.ID + "] from References Table.");
            }
        })
    }

    /**
     * Deletes all GlobalEvents (also removing from reference table) that contain a specific object (ID).
     * @param objectID The ID of the AGObject.
     */
    deleteGlobalEventsContainingObjectById(objectID: number) {
        let agobject: IAGObject = getReferenceById(objectID);
        let that = this;
        this._globalEvents.forEach(function (item) {
            if (item.object === agobject) {
                that.removeGlobalEventByID(item.ID);
                console.log("[AGEventHandler] Deleted Global Event [ID: " + item.ID + "] from References Table.");
            }
        })
    }

    /*
    findEvent(event:Event):?Event {
        for(let i = 0; i < this._events.length; i++){
            if(this._events[i].origin === event.origin &&
                this._events[i].trigger === event.trigger &&
                this._events[i].action === event.action &&
                this._events[i].object === event.object &&
                this._events[i].addObject === event.addObject
            ) return this._events[i];
        }
        return null;
    }
    */

    /**
     * Finds and returns events that are connected to a respective AGObject, triggered by a Trigger.
     * @param object The object the Event is expected to be fired.
     * @param trigger The trigger that fires the event.
     * @returns {Array<Event>} Returns an Array of Events that fits the requested AGObject and Trigger.
     */
    findEventsAfterCall(object: IAGObject, trigger: Trigger): Array<Event> {
        let events: Array<Event> = [];
        for (let i = 0; i < this._events.length; i++) {
            if (this._events[i].origin === object &&
                this._events[i].trigger === trigger
            ) {
                events.push(this._events[i]);
            }
        }
        return events;
    }

    /**
     * Function is called if certain events happen (e.g., collision, death) and reacts by triggering the respective function.
     * @param object The IAGObject that called this function.
     * @param trigger The Trigger (e.g., ONCONTACT, ONDEATH)
     */
    call(object: IAGObject, trigger: Trigger) {
        //console.log("[AGEventHandler] Received Event-Call from " + object.name);
        let events: Array<Event> = this.findEventsAfterCall(object, trigger);
        for (let i = 0; i < events.length; i++) {
            if (events[i].repeat >= 1 || events[i].repeat === -1) {
                console.log("[AGEventHandler] Event triggered:");
                console.log(events[i]);
                switch (events[i].trigger) {
                    //TRIGGER: ON CONTACT WITH OTHER OBJECT
                    case "ONCONTACT":
                        switch (events[i].action) {
                            // TRIGGER: ONCONTACT, ACTION: ADD TO INVENTORY
                            case "ADD":
                                events[i].object.inventory.addItem(events[i].addObject);
                                break;
                            // TRIGGER: ONCONTACT, ACTION: REMOVE FROM INVENTORY
                            case "REMOVE":
                                events[i].origin.inventory.removeItem(events[i].addObject);
                                break;
                            // TRIGGER: ONCONTACT, ACTION: MOVE FROM INVENTORY TO OTHER
                            case "MOVE":
                                events[i].origin.inventory.removeItem(events[i].addObject);
                                events[i].object.inventory.addItem(events[i].addObject);
                                break;
                        }
                        break;
                    case "ONDEATH":
                        switch (events[i].action) {
                            // TRIGGER: ONDEATH, ACTION: ADD TO INVENTORY
                            case "ADD":
                                events[i].object.inventory.addItem(events[i].addObject);
                                break;
                            // TRIGGER: ONDEATH, ACTION: REMOVE FROM INVENTORY
                            case "REMOVE":
                                events[i].origin.inventory.removeItem(events[i].addObject);
                                break;
                            // TRIGGER: ONDEATH, ACTION: MOVE FROM INVENTORY TO OTHER
                            case "MOVE":
                                events[i].origin.inventory.removeItem(events[i].addObject);
                                events[i].object.inventory.addItem(events[i].addObject);
                                break;
                        }
                        break;
                }
                events[i].repeat--;
            }
        }
    }
}