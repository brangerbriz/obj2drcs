const fs = require('fs')
const ncp = require('ncp').ncp
const { exec } = require('child_process')

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera( 75, innerWidth/innerHeight, 0.1, 1000 )
const renderer = new THREE.WebGLRenderer()
const dracoLoader = new THREE.DRACOLoader()
const objLoader = new THREE.OBJLoader()
const objExporter = new THREE.OBJExporter();
const controls = new THREE.TrackballControls( camera )
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let mesh, pos = {}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// ------------------------- load fils --------------------
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

let cnsl = document.querySelector('pre > code')
let up = document.querySelector('#uploads')
    up.addEventListener('change', loadNewFile)

function print(str){
    document.querySelector('pre > code').textContent += str
}

function loadNewFile(){
    document.querySelector('pre > code').textContent = ''
    let inF = up.files[0].path.replace(/ /g,'\\ ')
    let dir = up.files[0].name.replace(/\./g,'-')
    let clv = Number(document.querySelector('#cl').value)
    let outF = `OUTPUT/${dir}/${dir}.drc`
    if( !fs.existsSync(`OUTPUT/${dir}`)){
        fs.mkdirSync(`OUTPUT/${dir}`)
    }

    let cmd = `./draco_build/draco_encoder -cl ${clv} -i ${inF} -o ${outF}`
    exec(cmd, (err, stdout, stderr) => {
        if (err) throw new Error(err)
        if(stdout) console.log(`stdout: ${stdout}`)
        if(stderr) console.log(`stderr: ${stderr}`)
        else {
            print(`created: ${outF}\n`)
            // load initial drc to get re-scale/position values
            dracoLoader.load( outF, (geometry)=>{
                // THREE.DRACOLoader.releaseDecoderModule() // optional
                let values = createScaledValues(geometry)
                // once we've got those, load up the initial obj && make kids
                createObjs(up.files[0].path,values,`OUTPUT/${dir}`)
            })
        }
    })
}

function createObjs(path,vals,outDir){
    print(`creaing objs...\n`)
    outDir = outDir+'/objs'
    if( !fs.existsSync(outDir)) fs.mkdirSync(outDir)

    objLoader.load( path, ( object )=>{
        pos = vals
        // use values derived from createScaledValues() to reposition data
        object.scale.multiplyScalar(vals.s)
        object.position.x = vals.x
        object.position.y = vals.y
        object.position.z = vals.z
        // create obj files from newly repositioned/scaled children
        let count = 0
        object.children.forEach((c,i)=>{
            let data = objExporter.parse(c)
            let name = `${outDir}/${i}_${c.name.replace(/ /g,'_')}.obj`
            fs.writeFile(name,data,(err)=>{
                if(err) return console.log(err)
                count++
                if(count==object.children.length) createDrcs(outDir)
            })
        })
    })
}

function createDrcs(path){
    print(`creating drcs...\n`)
    let clv = Number(document.querySelector('#cl').value)
    let dirs = path.split('/')
    let outDir = `OUTPUT/${dirs[1]}/drcs`
    if( !fs.existsSync(outDir)) fs.mkdirSync(outDir)

    fs.readdir(path,(err,files)=>{
        if(err) return console.log(err)
        let count = 0
        files.forEach((f,i)=>{
            let inF = `${path.replace(/ /g,'\\ ')}/${f}`
            let outF = `${outDir}/${f.replace(/.obj/g,'.drc')}`
            let cmd = `./draco_build/draco_encoder -cl ${clv} -i ${inF} -o ${outF}`
            exec(cmd, (err, stdout, stderr) => {
                if (err) throw new Error(err)
                if(stdout) console.log(`stdout: ${stdout}`)
                if(stderr) console.log(`stderr: ${stderr}`)
                else {
                    count++
                    if(count==files.length) loadAllDrcs(outDir)
                }
            })
        })
    })

}

function loadAllDrcs(path){
    print(`loading drcs...\n`)
    let oldMesh = scene.getObjectByName('the-mesh')
    if(oldMesh) scene.remove(oldMesh)

    mesh = new THREE.Object3D()
    mesh.name = 'the-mesh'
    scene.add( mesh )

    let parentDrc = path.split('/')[1]+'.drc'
    fs.readdir(path,(err,files)=>{
        if(err) return console.log(err)

        files.forEach((f,i)=>{
            dracoLoader.load( `${path}/${f}`, function(geometry) {
                // THREE.DRACOLoader.releaseDecoderModule() // optional
                let material = new THREE.MeshPhongMaterial({color:0x00ff00})
                mesh.add( new THREE.Mesh(geometry,material) )
            })
        })

        mesh.scale.multiplyScalar(pos.s)
        mesh.position.x = pos.x
        mesh.position.y = pos.y
        mesh.position.z = pos.z

        createTemplate(path, files, mesh.scale, mesh.position)
    })


}

function createTemplate(path,files,scale,pos){
    path = path.split('/')
    files = files.map(f=>`"drcs/${f}"`)
    let dir = `${path[0]}/${path[1]}`
    let jsDir = `${dir}/js`
    if( !fs.existsSync(jsDir)) fs.mkdirSync(jsDir)

    let js = ["three.min.js","TrackballControls.js","DRACOLoader.js"]
    js.forEach(f=>{
        let from = (f.includes('DRACO')) ?
            `js/draco_libs/${f}`:`js/threejs_libs/${f}`
        let to = `${jsDir}/${f}`
        fs.createReadStream(from).pipe(fs.createWriteStream(to))
    })

    ncp('js/draco_libs', `${jsDir}/draco_libs`, function (err) {
        if (err) return console.error(err)
    })

    let html = 'html/index.html'
    fs.readFile(html,{encoding: 'utf-8'},(err,data)=>{
        if(err) return console.log(err)
        data = data.replace('{{{title}}}',path[1])
        data = data.replace('{{{list}}}',files.toString())
        data = data.replace('{{{scaleX}}}',scale.x)
        data = data.replace('{{{scaleY}}}',scale.y)
        data = data.replace('{{{scaleZ}}}',scale.z)
        data = data.replace('{{{positionX}}}',pos.x)
        data = data.replace('{{{positionY}}}',pos.y)
        data = data.replace('{{{positionZ}}}',pos.z)
        fs.writeFile(`${dir}/index.html`,data,(err)=>{
            if(err) return console.log(err)
            print(`created test project: ${dir}/index.html`)
        })
    })
}




// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// ------------------------- three.js functions --------------------
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function resize() {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
}

function addShadowedLight(x, y, z, color, intensity) {
    let directionalLight = new THREE.DirectionalLight(color, intensity)
    directionalLight.position.set(x, y, z)
    scene.add(directionalLight)
}

function updateRaycaster(e){
    mouse.x = ( e.clientX / innerWidth ) * 2 - 1
    mouse.y = - ( e.clientY / innerHeight ) * 2 + 1
    raycaster.setFromCamera( mouse, camera )
    if(typeof mesh !== 'undefined'){
        let arr = raycaster.intersectObjects(mesh.children)
        updateObjColors( arr )
    }
}

function updateObjColors( arr ){
    // reset all
    mesh.children.forEach((c)=>{ c.material.color.r = 0 })
    // change color of closest intersecting object
    if( arr.length > 0 ){
        arr[0].object.material.color.r = 1
    }
}

function createScaledValues(g){
    g.computeBoundingBox()
    let sx = g.boundingBox.max.x - g.boundingBox.min.x
    let sy = g.boundingBox.max.y - g.boundingBox.min.y
    let sz = g.boundingBox.max.z - g.boundingBox.min.z
    let diagonalSize = Math.sqrt(sx*sx + sy*sy + sz*sz)

    let scale = 1.0 / diagonalSize

    let midX = (g.boundingBox.min.x + g.boundingBox.max.x) / 2
    let midY = (g.boundingBox.min.y + g.boundingBox.max.y) / 2
    let midZ = (g.boundingBox.min.z + g.boundingBox.max.z) / 2

    let mesh = new THREE.Mesh(g, new THREE.MeshNormalMaterial())
        mesh.scale.multiplyScalar(scale)
        mesh.position.x = -midX * scale
        mesh.position.y = -midY * scale
        mesh.position.z = -midZ * scale
    return {
        s:scale,
        x:mesh.position.x,
        y:mesh.position.y,
        z:mesh.position.z
    }
}



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// ----------------------- setup + draw ----------------------------
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function setup(){
    renderer.setSize( innerWidth, innerHeight )
    document.body.appendChild( renderer.domElement )
    window.addEventListener('resize', resize, false)
    window.addEventListener('mousemove', updateRaycaster, false)

    scene.add(new THREE.HemisphereLight(0x443333, 0x111122))
    addShadowedLight(1, 1, 1, 0xffffff, 0.5)
    addShadowedLight(0.5, 1, -1, 0xffaa00, 0.25)
    camera.position.z = 1

    // THREE.DRACOLoader.setDecoderConfig({type: 'js' }) // optional
    THREE.DRACOLoader.setDecoderPath( 'js/draco_libs/' )
}

function draw() {
    requestAnimationFrame( draw )
    controls.update()
    renderer.render( scene, camera )
}

setup()
draw()
