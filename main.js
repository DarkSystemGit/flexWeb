const fs = require('fs')
const path = require('path')
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
var args = processArgs(['readFile', 'outFile'])
var dom = new JSDOM('<!DOCTYPE html><html><head id="head"></head><body id="__main"></body></html>')
const document = dom.window.document
var appFile = JSON.parse(fs.readFileSync(path.join(__dirname, args.readFile + '.json')).toString())
var componentList = fs.readdirSync(path.join(__dirname, '/components'), { recursive: true })
var root = appFile.root
var app = {}
var xml = new JSDOM(fs.readFileSync(path.join(__dirname, 'app.xml')))
//console.log(xml.window.document.getElementsByTagName('root'))
function processArgs(names) {

    var args = {}
    for (var counter = 2; counter < process.argv.length; counter++) {
        //console.log(process.argv[counter])
        args[names[counter - 2]] = process.argv[counter]
    }
    //console.log(args)
    return args
}
function convertObjectToDom(obj) {
    if (componentList.includes(`${obj.type.replace('.', '/')}.html`)) {
        var include;
        var compHtml = fs.readFileSync(path.join(__dirname, '/components/', `${obj.type.replace('.', '/')}.html`)).toString()
        if (compHtml.includes('@include')) {
            function occurrences(string, subString) {
                var allowOverlapping;
                string += "";
                subString += "";
                if (subString.length <= 0) return (string.length + 1);

                var n = 0,
                    pos = 0,
                    step = allowOverlapping ? 1 : subString.length;

                while (true) {
                    pos = string.indexOf(subString, pos);
                    if (pos >= 0) {
                        ++n;
                        pos += step;
                    } else break;
                }
                return n;
            }
            for(var i=0;i<occurrences(compHtml,'@include');i++){
                try {
                    include = compHtml.split('\n')[i].split(' ')
                    compHtml = compHtml.replaceAll(compHtml.split('\n')[i], '')
                } catch (e) { }
                if (fs.existsSync(path.join(__dirname, '/components/', `${include[1]}.js`))) {
                    var processor = require(path.join(__dirname, '/components/', `${include[1]}.js`))
                    compHtml = processor(compHtml, obj, ...include.slice(2))[0]
                    obj = processor(compHtml, obj, ...include.slice(2))[1]
                }
            }
            
        }

        for (var i = 0; Object.keys(obj).length > i; i++) {
            if (!(Object.keys(obj)[i] == 'type')) {
                compHtml = compHtml.replaceAll('${' + Object.keys(obj)[i] + '}', obj[Object.keys(obj)[i]])
            } else { continue }
        }

        return processImports(compHtml, path.join(__dirname, '/components/', `${obj.type.replace('.', '/')}.html`))
    } else { return }
}
function resolveDependencies(htmlString) {
    //console.log(htmlString)
    if (htmlString.includes('$[__dependencies:')) {
        var html = {}
        var retHtml = ''
        try {
            var dependencies = htmlString.split('$[__dependencies:')[1]
            dependencies = dependencies.split(']', 1)[0].split(';')
            dependencies.forEach((dependency) => {
                //console.log(dependencies)
                var obj = JSON.parse(dependency)
                html[obj.name] = convertObjectToDom(obj)

            })
            //console.log(Object.keys(html).length)

            Object.keys(html).forEach((dep, index) => {

                if (retHtml == '') {
                    retHtml = htmlString
                }
                var dom = new JSDOM(`<!DOCTYPE html><html>${retHtml.replaceAll(`$[__dependencies:${htmlString.split('$[__dependencies:')[1].split(']', 1)[0]}]`, '')}</html>`)
                console.log(dom.window.document.getElementsByTagName(dep).length)
                for (var counter = 0; counter < dom.window.document.getElementsByTagName(dep).length + 1; counter++) {
                    var depChilren = dom.window.document.getElementsByTagName(dep)[counter].innerHTML
                    //console.log("child: "+html[dep].replaceAll('${__children}',depChilren))
                    var parent = dom.window.document.getElementsByTagName(dep)[counter].parentNode
                    //console.log(dom.window.document.getElementsByTagName(dep)[counter].outerHTML)
                    //console.log("parent: "+parent.innerHTML)
                    parent.replaceChild(document.createRange().createContextualFragment(html[dep].replaceAll('${__children}', depChilren)), dom.window.document.getElementsByTagName(dep)[counter])
                    //console.log("parent: "+parent.innerHTML)
                }
                //console.log(count)
                console.log(dom.window.document.getElementsByTagName('html')[0].innerHTML)
            })
        } catch (e) {
            console.log(e)
            return htmlString
        }
    }

    return htmlString;
}
function genChildren(parent) {
    var children = []
    //console.log(parent)
    if (!parent.hasOwnProperty('children')) {
        return ''
    }
    parent.children.forEach(obj => {
        if (!(obj.children == {})) {
            children.push(convertObjectToDom(obj).replace('${__children}', genChildren(obj)))
        } else {
            children.push(convertObjectToDom(obj).replace('${__children}', ''))
        }
    })
    return resolveDependencies(children.join(''))
}
function processImports(html, compPath) {
    let dom = new JSDOM(`<!DOCTYPE html><html><head id="head"></head><body id="__main">${html}</body></html>`)
    let document = dom.window.document
    var scriptElms = [...document.getElementsByTagName('script')]
    var styleElms = [...document.getElementsByTagName('link')]
    var importElms = []
    scriptElms.forEach(elm => {
        if (elm.src) {
            importElms.push(elm)
        }
    })
    styleElms.forEach(elm => {
        if (elm.rel == "stylesheet") {
            importElms.push(elm)
        }
    })
    importElms.forEach(elm => {
        var src = elm.src || elm.href
        if (!src.includes('./')) {
            src = path.dirname(compPath) + src
        } else {
            src.replace('./', path.dirname(compPath))
        }
        if (!elm.src) {
            elm.href = src
        } else {
            elm.src = src
        }

    })
    return document.getElementById('__main').innerHTML
}
document.getElementById('__main').innerHTML = convertObjectToDom(root).replace('${__children}', genChildren(root))

var docRoot = document.getElementById(root.id)
//console.log(genChildren(root))
fs.writeFileSync(path.join(__dirname, args.outFile + ".html"), document.getElementsByTagName('html')[0].outerHTML)
