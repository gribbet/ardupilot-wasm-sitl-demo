import ardupaneUrl from "./simulation/arduplane.js?url";

const parameters = `
SIM_SPEEDUP=5
THR_FAILSAFE=0
`;

type EmscriptenMod = {
  cwrap: {
    (
      name: string,
      returnType: "number" | null,
      argTypes: string[],
    ): (...args: number[]) => number;
  };
};

type EmscriptenFS = {
  writeFile: (path: string, data: string | Uint8Array) => void;
};

type EmscriptenFactory = (opts: unknown) => Promise<EmscriptenMod>;

export const createSimulation = async () => {
  const pollInterval = 20;
  const handlers = new Set<(data: Uint8Array) => void>();
  const receive = (handler: (data: Uint8Array) => void) => {
    handlers.add(handler);
    return () => handlers.delete(handler);
  };

  if (!crossOriginIsolated)
    throw new Error(
      "The simulator requires cross-origin isolation for shared wasm memory.",
    );

  const wasmMemory = new WebAssembly.Memory({
    initial: 2 ** 8,
    maximum: 2 ** 15,
    shared: true,
  });

  const { default: factory } = (await import(
    /* @vite-ignore */ ardupaneUrl
  )) as {
    default: EmscriptenFactory;
  };

  const mod = await factory({
    wasmMemory,
    arguments: [
      "--model=plane",
      "--defaults=simulation.parm",
      "--serial1=none",
      "--serial2=none",
    ],
    preRun: [
      ({ FS }: { FS: EmscriptenFS }) => {
        FS.writeFile("simulation.parm", parameters);
      },
    ],
    print: console.info,
    printErr: console.warn,
  });

  const write: (ptr: number, len: number) => number = mod.cwrap(
    "ardupilot_serial0_write",
    "number",
    ["number", "number"],
  );
  const read: (ptr: number, len: number) => number = mod.cwrap(
    "ardupilot_serial0_read",
    "number",
    ["number", "number"],
  );
  const available: () => number = mod.cwrap(
    "ardupilot_serial0_read_available",
    "number",
    [],
  );
  const malloc: (size: number) => number = mod.cwrap(
    "ardupilot_malloc",
    "number",
    ["number"],
  );
  const free: (ptr: number) => void = mod.cwrap("ardupilot_free", null, [
    "number",
  ]);

  const bufferSize = 4096;
  const buffer = malloc(bufferSize);

  const timer = setInterval(() => {
    const n = available();
    if (n <= 0) return;
    const got = read(buffer, Math.min(n, bufferSize));
    if (got <= 0) return;
    const data = new Uint8Array(wasmMemory.buffer).slice(buffer, buffer + got);
    handlers.forEach(_ => _(data));
  }, pollInterval);

  const send = (data: Uint8Array) => {
    new Uint8Array(wasmMemory.buffer).set(data, buffer);
    write(buffer, data.length);
    return Promise.resolve();
  };

  const close = () => {
    clearInterval(timer);
    free(buffer);
  };

  return {
    send,
    receive,
    close,
  };
};
