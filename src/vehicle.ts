import { MavlinkChannel, Schema } from "mavlink.ts";
import {
  type CommandInt,
  mavDoRepositionFlagsMap,
  type PlaneMode,
  planeModeMap,
} from "../gen/schema";

export type Vehicle = Awaited<ReturnType<typeof createVehicle>>;

export const createVehicle = (mavlink: MavlinkChannel<Schema>) => {
  const systemId = 255;
  const componentId = 0;
  let onPosition = (_: [number, number, number]) => {};
  let onStatusText = (_: string) => {};

  const unsubscribe = mavlink.receive(async ({ type, message }) => {
    switch (type) {
      case "GLOBAL_POSITION_INT": {
        const lat = message.lat / 1e7;
        const lon = message.lon / 1e7;
        const alt = message.alt / 1e3;
        onPosition([lon, lat, alt]);
        break;
      }
      case "STATUSTEXT": {
        onStatusText(message.text);
        break;
      }
    }
  });

  const heartbeat = () =>
    mavlink.send({
      systemId,
      componentId,
      type: "HEARTBEAT",
      message: {
        type: "GCS",
        autopilot: "INVALID",
        baseMode: [],
        customMode: 0,
        systemStatus: "ACTIVE",
        mavlinkVersion: 3,
      },
    });

  const sendCommandInt = async (message: Partial<CommandInt>) =>
    mavlink.send({
      systemId,
      componentId,
      type: "COMMAND_INT",
      message: {
        targetSystem: 0,
        targetComponent: 0,
        frame: "GLOBAL_INT",
        command: "NAV_DELAY",
        current: 0,
        autocontinue: 0,
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        x: 0,
        y: 0,
        z: 0,
        ...message,
      },
    });

  const setPlaneMode = async (mode: PlaneMode) =>
    sendCommandInt({
      command: "DO_SET_MODE",
      param1: 1,
      param2: planeModeMap.get(mode) ?? 0,
    });

  const setTakeoffMode = () => setPlaneMode("TAKEOFF");

  const armDisarm = (arm: boolean) =>
    sendCommandInt({
      command: "COMPONENT_ARM_DISARM",
      param1: arm ? 1 : 0,
      param2: 21196,
    });

  const arm = () => armDisarm(true);

  const reposition = ([longitude, latitude, altitude]: [
    number,
    number,
    number,
  ]) =>
    sendCommandInt({
      command: "DO_REPOSITION",
      param2: mavDoRepositionFlagsMap.get("CHANGE_MODE") ?? 0,
      x: Math.round(latitude * 1e7),
      y: Math.round(longitude * 1e7),
      z: altitude,
    });

  const waitForGps = () =>
    new Promise(resolve => {
      const unsubscribe = mavlink.receive(({ type, message }) => {
        if (type !== "GPS_RAW_INT" || message.fixType !== "RTK_FIXED") return;
        unsubscribe();
        resolve(undefined);
      });
    });

  const takeoff = async () => {
    await waitForGps();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await arm();
    await setTakeoffMode();
  };

  const interval = setInterval(heartbeat, 200);
  const close = () => {
    clearInterval(interval);
    unsubscribe();
  };

  return {
    takeoff,
    reposition,
    close,
    set onPosition(_: (_: [number, number, number]) => void) {
      onPosition = _;
    },
    set onStatusText(_: (_: string) => void) {
      onStatusText = _;
    },
  };
};
