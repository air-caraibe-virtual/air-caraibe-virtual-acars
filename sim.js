// Liaison expérimentale avec Microsoft Flight Simulator 2024 via SimConnect
const { EventEmitter } = require('events');
const {
  open,
  Protocol,
  SimConnectDataType,
  SimConnectPeriod,
  SimConnectConstants
} = require('node-simconnect');

const DEF_ID = 1;
const REQ_ID = 1;
const RETRY_MS = 5000;

class SimLink extends EventEmitter {
  constructor() {
    super();
    this.handle = null;
    this.timer = null;
    this.stopped = false;
    this.status = { connected: false, message: 'Recherche du simulateur…' };
  }

  setStatus(connected, message, extra) {
    this.status = Object.assign({ connected, message }, extra || {});
    this.emit('status', this.status);
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    try { if (this.handle) this.handle.close(); } catch (e) { /* rien */ }
    this.handle = null;
  }

  scheduleRetry() {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), RETRY_MS);
  }

  async connect() {
    if (this.stopped) return;
    // MSFS 2024 parle le protocole « SunRise » ; MSFS 2020 le protocole « KittyHawk ».
    const protocols = [Protocol.SunRise, Protocol.KittyHawk].filter((p) => p !== undefined);
    for (const proto of protocols) {
      try {
        const { recvOpen, handle } = await open('Air Caraibe Virtual ACARS', proto);
        this.attach(handle, recvOpen);
        return;
      } catch (e) {
        // on essaie le protocole suivant
      }
    }
    this.setStatus(false, 'Simulateur non détecté — lance MSFS 2024, nouvel essai dans 5 s');
    this.scheduleRetry();
  }

  attach(handle, recvOpen) {
    this.handle = handle;
    const simName = (recvOpen && recvOpen.applicationName) || 'Microsoft Flight Simulator';
    this.setStatus(true, 'Connecté à ' + simName, { simName });

    const F = SimConnectDataType.FLOAT64;
    handle.addToDataDefinition(DEF_ID, 'TITLE', null, SimConnectDataType.STRING256);
    handle.addToDataDefinition(DEF_ID, 'PLANE LATITUDE', 'degrees', F);
    handle.addToDataDefinition(DEF_ID, 'PLANE LONGITUDE', 'degrees', F);
    handle.addToDataDefinition(DEF_ID, 'PLANE ALTITUDE', 'feet', F);
    handle.addToDataDefinition(DEF_ID, 'GROUND VELOCITY', 'knots', F);
    handle.addToDataDefinition(DEF_ID, 'PLANE HEADING DEGREES TRUE', 'degrees', F);
    handle.addToDataDefinition(DEF_ID, 'VERTICAL SPEED', 'feet per minute', F);
    handle.addToDataDefinition(DEF_ID, 'AIRSPEED INDICATED', 'knots', F);
    handle.addToDataDefinition(DEF_ID, 'SIM ON GROUND', 'bool', SimConnectDataType.INT32);

    handle.requestDataOnSimObject(
      REQ_ID,
      DEF_ID,
      SimConnectConstants.OBJECT_ID_USER,
      SimConnectPeriod.SECOND
    );

    handle.on('simObjectData', (recv) => {
      if (recv.requestID !== REQ_ID) return;
      try {
        const b = recv.data;
        const data = {
          title: b.readString256(),
          lat: b.readFloat64(),
          lon: b.readFloat64(),
          alt: b.readFloat64(),
          gs: b.readFloat64(),
          hdg: b.readFloat64(),
          vs: b.readFloat64(),
          ias: b.readFloat64(),
          onGround: b.readInt32() === 1,
          t: Date.now()
        };
        this.emit('data', data);
      } catch (e) {
        // paquet illisible : on l'ignore
      }
    });

    const lost = (why) => {
      if (this.handle !== handle) return;
      this.handle = null;
      this.setStatus(false, why + ' — nouvel essai dans 5 s');
      this.scheduleRetry();
    };
    handle.on('quit', () => lost('Simulateur fermé'));
    handle.on('close', () => lost('Connexion perdue'));
    handle.on('error', () => lost('Erreur de connexion'));
    handle.on('exception', () => { /* donnée refusée par le simulateur : on continue */ });
  }
}

module.exports = { SimLink };
