const fs = require('fs')
const path = require('path')
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
var args = processArgs(['readFile','outFile'])
var dom = new JSDOM('<!DOCTYPE html><html><head id="head"></head><body id="__main"></body></html>')
const document = dom.window.document
var appFile= JSON.parse(fs.readFileSync(path.join(__dirname,args.readFile+'.json')).toString())
var componentList =  fs.readdirSync(path.join(__dirname,'/components'))
var root = appFile.root
var app ={}
var xml = new JSDOM(fs.readFileSync(path.join(__dirname,'app.xml')))
//console.log(xml.window.document.getElementsByTagName('root'))
function processArgs(names){

    var args ={}
    for(var counter = 2;counter < process.argv.length;counter++){
        //console.log(process.argv[counter])
        args[names[counter-2]] = process.argv[counter]
    }
    //console.log(args)
    return args
}
function convertObjectToDom(obj){
    if(componentList.includes(`${obj.type}.html`)){
        var compHtml = fs.readFileSync(path.join(__dirname,'/components/',`${obj.type}.html`)).toString()
        for(var i=0;Object.keys(obj).length>i;i++){
            if(!(Object.keys(obj)[i]=='type')){
                compHtml =compHtml.replaceAll('${'+Object.keys(obj)[i]+'}',obj[Object.keys(obj)[i]])
            }else{continue} 
        }
        return compHtml
    }else{return}
}
function resolveDependencies(htmlString){
    //console.log(htmlString)
    if(htmlString.includes('$[__dependencies:')){
        var html = {}
        var retHtml =''
        try{
        var dependencies = htmlString.split('$[__dependencies:')[1]
        dependencies =dependencies.split(']',1)[0].split(';')
        dependencies.forEach((dependency)=>{
            //console.log(dependencies)
            var obj = JSON.parse(dependency)
            html[obj.name]=convertObjectToDom(obj)

        })
        //console.log(Object.keys(html).length)
        
        Object.keys(html).forEach((dep,index)=>{
            
            if (retHtml==''){
                retHtml = htmlString
            }
            var dom = new JSDOM(`<!DOCTYPE html><html>${retHtml.replaceAll(`$[__dependencies:${htmlString.split('$[__dependencies:')[1].split(']',1)[0]}]`,'')}</html>`)
            console.log(dom.window.document.getElementsByTagName(dep).length)
            for(var counter=0;counter<dom.window.document.getElementsByTagName(dep).length+1;counter++){
                var depChilren = dom.window.document.getElementsByTagName(dep)[counter].innerHTML
                //console.log("child: "+html[dep].replaceAll('${__children}',depChilren))
                var parent = dom.window.document.getElementsByTagName(dep)[counter].parentNode
                //console.log(dom.window.document.getElementsByTagName(dep)[counter].outerHTML)
                //console.log("parent: "+parent.innerHTML)
                parent.replaceChild(document.createRange().createContextualFragment(html[dep].replaceAll('${__children}',depChilren)),dom.window.document.getElementsByTagName(dep)[counter])
                //console.log("parent: "+parent.innerHTML)
            }
            //console.log(count)
            console.log(dom.window.document.getElementsByTagName('html')[0].innerHTML)
        })
        }catch(e){
            console.log(e)
            return htmlString
        }
    }

    return htmlString;
}
function genChildren(parent){
    var children =[]
    //console.log(parent)
    if(!parent.hasOwnProperty('children')){
        return ''
    }
    parent.children.forEach(obj =>{
        if(!(obj.children=={})){
            children.push(convertObjectToDom(obj).replace('${__children}',genChildren(obj)))
        }else{
            children.push(convertObjectToDom(obj).replace('${__children}',''))
        }
    })
    return resolveDependencies(children.join(''))
}
document.getElementById('__main').innerHTML =convertObjectToDom(root).replace('${__children}',genChildren(root))
var docRoot = document.getElementById(root.id)
//console.log(genChildren(root))
fs.writeFileSync(path.join(__dirname,args.outFile+".html"),document.getElementsByTagName('html')[0].outerHTML)
