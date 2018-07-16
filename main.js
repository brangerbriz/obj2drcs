const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow

const dev = (process.argv[2]=="dev"||process.argv[2]=="test") ? true : false

let mainWindow

function createWindow () {

    mainWindow = new BrowserWindow({
        width: 800, height: 600,
        icon:`${__dirname}/BBlogo.png`
    })

    let path = (process.argv[2]=="test") ?
        `file:///${__dirname}/webGL-test.html` :
        `file:///${__dirname}/index.html`
    mainWindow.loadURL(path)

    // Open the DevTools.
    if( dev ) mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', ()=>{ mainWindow = null })
}


app.on('ready', createWindow)
app.on('window-all-closed',()=>{ if(process.platform!=='darwin') app.quit() })
app.on('activate', ()=>{ if (mainWindow === null) createWindow() })
