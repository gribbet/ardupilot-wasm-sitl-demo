/// <reference types="vite/client" />

import { createMavlinkChannel } from "mavlink.ts";
import { schema } from "../gen/schema";
import { createSimulation } from "./simulation";
import { createVehicle } from "./vehicle";

const channel = await createSimulation();
const mavlink = createMavlinkChannel(channel, schema);
const vehicle = await createVehicle(mavlink);

const position = document.getElementById("position")!;
const status = document.getElementById("status")!;

vehicle.onPosition = ([lon, lat, alt]) => {
  position.innerText = `${lat.toFixed(5)}, ${lon.toFixed(5)}, ${alt.toFixed(1)} m`;
};

vehicle.onStatusText = _ => {
  status.innerText = _ + "\n" + status.innerText;
};

await vehicle.takeoff();
