const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

const dev = (process.argv[2]=="dev") ? true : false;

let mainWindow

function createWindow () {

    mainWindow = new BrowserWindow({
        width: 800, height: 600,
        icon:`${__dirname}/BBlogo.png`
    })

    mainWindow.loadURL(`file:///${__dirname}/index.html`);

    // Open the DevTools.
    if( dev ) mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', ()=>{ mainWindow = null })
}


app.on('ready', createWindow)
app.on('window-all-closed',()=>{ if(process.platform!=='darwin') app.quit() })
app.on('activate', ()=>{ if (mainWindow === null) createWindow() })
