const electron = require('electron');
const path = require('path');
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const {
  app,
  BrowserWindow,
} = electron;

// simple parameters initialization
const electronConfig = {
  URL_LAUNCHER_TOUCH: process.env.URL_LAUNCHER_TOUCH === '1' ? 1 : 0,
  URL_LAUNCHER_TOUCH_SIMULATE: process.env.URL_LAUNCHER_TOUCH_SIMULATE === '1' ? 1 : 0,
  URL_LAUNCHER_FRAME: process.env.URL_LAUNCHER_FRAME === '1' ? 1 : 0,
  URL_LAUNCHER_KIOSK: process.env.URL_LAUNCHER_KIOSK === '1' ? 1 : 0,
  URL_LAUNCHER_NODE: process.env.URL_LAUNCHER_NODE === '1' ? 1 : 0,
  URL_LAUNCHER_WIDTH: parseInt(process.env.URL_LAUNCHER_WIDTH || 1920, 10),
  URL_LAUNCHER_HEIGHT: parseInt(process.env.URL_LAUNCHER_HEIGHT || 1080, 10),
  URL_LAUNCHER_TITLE: process.env.URL_LAUNCHER_TITLE || 'RESIN.IO',
  URL_LAUNCHER_CONSOLE: process.env.URL_LAUNCHER_CONSOLE === '1' ? 1 : 0,
  URL_LAUNCHER_URL: process.env.URL_LAUNCHER_URL || `file:///${path.join(__dirname, 'data', 'index.html')}`,
  URL_LAUNCHER_ZOOM: parseFloat(process.env.URL_LAUNCHER_ZOOM || 1.0),
  URL_LAUNCHER_OVERLAY_SCROLLBARS: process.env.URL_LAUNCHER_OVERLAY_SCROLLBARS === '1' ? 1 : 0,
  ELECTRON_ENABLE_HW_ACCELERATION: process.env.ELECTRON_ENABLE_HW_ACCELERATION === '1',
  ELECTRON_RESIN_UPDATE_LOCK: process.env.ELECTRON_RESIN_UPDATE_LOCK === '1',
  ELECTRON_APP_DATA_DIR: process.env.ELECTRON_APP_DATA_DIR,
  ELECTRON_USER_DATA_DIR: process.env.ELECTRON_USER_DATA_DIR,
};

// Enable / disable hardware acceleration
if (!electronConfig.ELECTRON_ENABLE_HW_ACCELERATION) {
  app.disableHardwareAcceleration();
}

// enable touch events if your device supports them
if (electronConfig.URL_LAUNCHER_TOUCH) {
  app.commandLine.appendSwitch('--touch-devices');
}
// simulate touch events - might be useful for touchscreen with partial driver support
if (electronConfig.URL_LAUNCHER_TOUCH_SIMULATE) {
  app.commandLine.appendSwitch('--simulate-touch-screen-with-mouse');
}

// Override the appData directory
// See https://electronjs.org/docs/api/app#appgetpathname
if (electronConfig.ELECTRON_APP_DATA_DIR) {
  electron.app.setPath('appData', electronConfig.ELECTRON_APP_DATA_DIR)
}

// Override the userData directory
// NOTE: `userData` defaults to the `appData` directory appended with the app's name
if (electronConfig.ELECTRON_USER_DATA_DIR) {
  electron.app.setPath('userData', electronConfig.ELECTRON_USER_DATA_DIR)
}

if (process.env.NODE_ENV === 'development') {
  console.log('Running in development mode');
  Object.assign(electronConfig, {
    URL_LAUNCHER_HEIGHT: 600,
    URL_LAUNCHER_WIDTH: 800,
    URL_LAUNCHER_KIOSK: 0,
    URL_LAUNCHER_CONSOLE: 1,
    URL_LAUNCHER_FRAME: 1,
  });
}

// Listen for a 'resin-update-lock' to either enable, disable or check
// the update lock from the renderer process (i.e. the app)
if (electronConfig.ELECTRON_RESIN_UPDATE_LOCK) {
  const lockFile = require('lockfile');
  electron.ipcMain.on('resin-update-lock', (event, command) => {
    switch (command) {
      case 'lock':
        lockFile.lock('/tmp/resin/resin-updates.lock', (error) => {
          event.sender.send('resin-update-lock', error);
        });
        break;
      case 'unlock':
        lockFile.unlock('/tmp/resin/resin-updates.lock', (error) => {
          event.sender.send('resin-update-lock', error);
        });
        break;
      case 'check':
        lockFile.check('/tmp/resin/resin-updates.lock', (error, isLocked) => {
          event.sender.send('resin-update-lock', error, isLocked);
        });
        break;
      default:
        event.sender.send('resin-update-lock', new Error(`Unknown command "${command}"`));
        break;
    }
  });
}

/*
 we initialize our application display as a callback of the electronJS "ready" event
 */
app.on('ready', () => {
  // here we actually configure the behavour of electronJS
  mainWindow = new BrowserWindow({
    width: electronConfig.URL_LAUNCHER_WIDTH,
    height: electronConfig.URL_LAUNCHER_HEIGHT,
    frame: !!(electronConfig.URL_LAUNCHER_FRAME),
    title: electronConfig.URL_LAUNCHER_TITLE,
    kiosk: !!(electronConfig.URL_LAUNCHER_KIOSK),
    webPreferences: {
      sandbox: false,
      nodeIntegration: !!(electronConfig.URL_LAUNCHER_NODE),
      zoomFactor: electronConfig.URL_LAUNCHER_ZOOM,
      overlayScrollbars: !!(electronConfig.URL_LAUNCHER_OVERLAY_SCROLLBARS),
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      mainWindow.show();
    }, 300);
  });

  // if the env-var is set to true,
  // a portion of the screen will be dedicated to the chrome-dev-tools
  if (electronConfig.URL_LAUNCHER_CONSOLE) {
    mainWindow.webContents.openDevTools();
  }

  process.on('uncaughtException', (err) => {
    console.log(err);
  });

  // the big red button, here we go
  mainWindow.loadURL(electronConfig.URL_LAUNCHER_URL);
});

// const Gpio = require('onoff').Gpio;
// const button = new Gpio(4, 'in', 'both');
// button.watch((err, value) => mainWindow.webContents.send('ping', value));
var pigpio = require('pigpio');
const Gpio = require('pigpio').Gpio;

const buttonBrake = new Gpio(4, {
  mode: Gpio.INPUT,
  pullUpDown: Gpio.PUD_DOWN,
  edge: Gpio.EITHER_EDGE
});

const buttonIgnit1 = new Gpio(20, {
  mode: Gpio.INPUT,
  pullUpDown: Gpio.PUD_DOWN,
  edge: Gpio.EITHER_EDGE
});

const buttonIgnit2 = new Gpio(21, {
  mode: Gpio.INPUT,
  pullUpDown: Gpio.PUD_DOWN,
  edge: Gpio.EITHER_EDGE
});

const led1 = new Gpio(5, { mode: Gpio.OUTPUT });
const led2 = new Gpio(6, { mode: Gpio.OUTPUT });
console.log('siema');
buttonBrake.on('interrupt', (level) => {
  mainWindow.webContents.send('ping', level);
});

buttonIgnit1.on('interrupt', (level) => {

  mainWindow.webContents.send('buttonIgnit1', level);
  if (level == 1) {
    led1.pwmWrite(255);
  } else {led1.pwmWrite(0);}
  
});

buttonIgnit2.on('interrupt', (level) => {
  mainWindow.webContents.send('buttonIgnit2', level);
  if (level == 1) {
    led2.pwmWrite(255);
  } else {led2.pwmWrite(0);}
  
});

const smoke1 = new Gpio(17, { mode: Gpio.OUTPUT });
const smoke2 = new Gpio(27, { mode: Gpio.OUTPUT });
var smoke = 0;

const mcpadc = require('mcp-spi-adc');

const gasPotent = mcpadc.open(5, { speedHz: 20000 }, (err) => {
  if (err) throw err;

  setInterval(() => {
    gasPotent.read((err, reading) => {
      if (err) throw err;
      var round =  Math.round(reading.value*200)/200;
      // var gas = Math.round(reading.value * 100 * 2.4);
      var test = Math.round(map_range(round, 0, 0.120, 0, 240));
      mainWindow.webContents.send('ping2', test);
      // var smoke = Math.round(reading.value * 100 * 2.55);
      
      // smoke1.pwmWrite(smoke);
      // smoke2.pwmWrite(smoke);

    });
  }, 100);
});


function map_range(value, low1, high1, low2, high2) {
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
};






// process.on('SIGHUP', shutdown('SIGHUP'));

process.on('SIGTERM', shutdown);

function shutdown(signal) {
  pigpio.terminate();
  // gasPotent.close(cb);
  console.log('zamykam sie!!!!!! bo ${signal}');
  process.exit(0);
};