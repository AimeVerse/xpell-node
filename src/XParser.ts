import XCommand from "./XCommand.js"
import * as _XC from "./XConst.js"

/**
 * Xpell Parser - Parse XML, HTML, Raw Text & Json to Xpell Command
 */

export class XParser {


    private static html2XMap = {
            elements:{
                div: "view",
                a: "link",
                b:"xhtml",
                h1: "xhtml",h2: "xhtml",h3: "xhtml",h4: "xhtml",h5: "xhtml",p: "xhtml",small:"xhtml",aside:"xhtml",span:"xhtml",
                table:"xhtml",th:"xhtml",td:"xhtml",tr:"xhtml",thead:"xhtml",tbody:"xhtml",
                ul:"xhtml",li:"xhtml",ol:"xhtml",
                canvas:"xhtml",
                img: "image",
            },
            attributes:{
                id:"_id"
            }
    }


    /**
     * Adds HTML-Xpell Mapping item
     * @param htmlElement HTML element to change from
     * @param xpellElement Xpell element to change to 
     */
    static addHtml2XpellMapItem(htmlElement:string,xpellElement:string) {
        XParser.html2XMap.elements[<"div">htmlElement] = xpellElement
    }


    /**
     * convert text command to Xpell json command
     * @param {string} txt 
     */
    static parse(txt:string,module?:string):XCommand {        
        const carr:string[] = txt.split(" ")
        let rv = new XCommand()
        if(module){

            rv["_module"]= module
            rv["_op"] =  carr[0]
        } else {
            rv["_module"]= carr[0]
            rv["_op"] =  carr[1]
        }
        rv["_params"] = {}
        
        if(carr.length>1){
            for (let i=2;i<carr.length;++i){
                const v = carr[i]                                
                const dl = v.indexOf(":")
                if(dl>-1){
                    const mc = v.split(":")                    
                    rv._params[mc[0]] = mc[1]
                }
                else
                {
                    rv._params[i-1] = carr[i]
                }
                
            }
        }
        
        return rv
    }


    /**
     * Convert raw Xpell command (JSON) to XCommand
     * @param rawXpell JSON of Xpell command
     * @returns {XCommand}
     */
    static parseXpell(rawXpell:string):XCommand {
        let code = rawXpell.trim();

        let args:Array<string> = XParser.parseArguments(code);

        let cmd = new XCommand();
        cmd._module = args[0];
        cmd._op = args[1];
        cmd._params = {};


        // start params from index 2
        for (let i = 2; i < args.length; i++) {
            let paramStr:string = args[i];
            let delimiterIdx = paramStr.indexOf(':');
            let quotesIdx = paramStr.indexOf('"');
            let finalDelimiter = (quotesIdx < delimiterIdx) ? -1 : delimiterIdx;
            
            
            let paramName = (finalDelimiter === -1) ? i.toString() : paramStr.substring(0, delimiterIdx);
            let paramValue = XParser.fixArgumentValue(paramStr.substring(finalDelimiter + 1));

            cmd._params[paramName] = paramValue
        }


        return cmd;
    }


    /**
     * Parse CLI arguments
     * @param code arguments
     * @returns Array<string> 
     */
    static parseArguments(code:string):Array<string>  {
        let args:Array<string> = [];

        while (code.length) {
            let argIndex = XParser.getNextArgumentIndex(code);
            if (argIndex == -1) {
                // error
                console.error('error: ' + code);
                break;
            }
            else {
                args.push(code.substring(0, argIndex));

                let oldCode = code; // this variable is used to check if loop in endless
                code = code.substring(argIndex).trim();

                if (code.length == oldCode.length) {
                    // error - while loop is in endless
                    console.error('error: while loop is in endless - leftovers: ' + code);
                    break;
                }

            }
        }
        return args;
    }

    /**
     * Covent Xpell2 (XP2) Json to Xpell JSON
     * @param XP2Json Xpell 2 JSON
     * @returns 
     */
    static xpellify(XP2Json:{[k:string]:any}):any  {
        const tkeys = Object.keys(XP2Json)
        let outputXpell:any = {_type:tkeys[0]}
        outputXpell[_XC.NODES.children] = [] // child's xpells
        const firstObject = XP2Json[tkeys[0]]
        const foKeys = Object.keys(firstObject)
        
        foKeys.forEach(iKey => {
            if(iKey === "_attr") { Object.assign(outputXpell,firstObject[iKey]) }
            else {
                const lob:{[k:string]:any} ={}
                lob[iKey]=firstObject[iKey]
                
                outputXpell[_XC.NODES.children].push(XParser.xpellify(lob))
            }
        })
        return outputXpell
    }

   
    

    /**
     * Converts XML/HTML Document to Xpell JSON
     * @param xmlNode XML Document Node
     * @param forceXhtml force Xpell XHTML for every unknown object
     * @returns {} Xpell JSON
     */
    static xml2Xpell  (xmlNode:any,forceXhtml?:boolean):{}  {
        //Conversation map for elements and attributes
        const cMap = XParser.html2XMap
        let scanChildren = true
        let outputXpell:{[k:string]:any} = {}
        outputXpell["_children"] = []
        const root_name = xmlNode.nodeName
        const _html_tag_attr = xmlNode.nodeName
        let forceXhtmlOnChildren = forceXhtml
        if(forceXhtml) { 
            outputXpell[_XC.NODES.type] = "xhtml"
            outputXpell["_html_ns"] = 'http://www.w3.org/2000/svg'
        }else {
            outputXpell["_type"] = (cMap.elements[<"div">root_name]) ?cMap.elements[<"div">root_name] : root_name  //html element to xpell object name
        }
        if(xmlNode.attributes) {
            for(let i=0;i<xmlNode.attributes.length;++i)  {
                const n = xmlNode.attributes[i]
                const attr_name = (cMap.attributes[<"id">n.name]) ?cMap.attributes[<"id">n.name] : n.name //replace html attribute to xpell attributes (id -> _id)
                outputXpell[attr_name] = n.value
            }
        }
        if (xmlNode?.firstChild?.nodeValue) {
            outputXpell["text"] = xmlNode?.firstChild.nodeValue.trim();
        }
        if(outputXpell[_XC.NODES.type] == "xhtml") {
            outputXpell["_html_tag"] = _html_tag_attr
        }
        else if(outputXpell[_XC.NODES.type] == "svg" ) {
            forceXhtmlOnChildren = true
            outputXpell["_html_ns"] = 'http://www.w3.org/2000/svg'
        }
        if(scanChildren &&  xmlNode?.childNodes.length>0) {
            for(let i=0;i<xmlNode.childNodes.length;++i)  {
                const node = (xmlNode.childNodes[i])
                if(!node.nodeName.startsWith("#")) {
                    outputXpell[_XC.NODES.children].push(XParser.xml2Xpell(node,forceXhtmlOnChildren))
                }
            }   
        }
        return outputXpell

    }

    static fixArgumentValue(arg:any) {
        let finalArg = "";
        let prevChar = "";
        for (var i = 0; i < arg.length; i++) {
            let char = arg.charAt(i);
            let addToFinal = true;

            if (char === '"' && prevChar !== "\\")
                addToFinal = false;

            if (addToFinal)
                finalArg += char;
            prevChar = char;
        }


        finalArg = finalArg.replace(/\\\"/g, '"');

        return finalArg;
    }


    /**
     * Get next argument from string
     * @param {String} str
     * @return {number} indexOf the end of the argument
     */
    static getNextArgumentIndex(str:string) {
        let idx = -1;
        let count = str.length;
        let zeroCount = count - 1;
        let inQuotes = false;
        let prevChar = "";
        for (let i = 0; i < count; i++) {
            let char = str.charAt(i);


            if (char === '"') {
                if (inQuotes) {
                    if (prevChar === '\\') {
                        // ignore
                    }
                    else {
                        // end of arguments
                        inQuotes = false;
                    }

                }
                else {
                    inQuotes = true;
                }
            }
            else if (char === ' ') {
                if (!inQuotes) {
                    // end of arguments
                    idx = i;
                    break;
                }
            }

            if (i === zeroCount) {
                idx = count;
                break;
            }


            prevChar = char;
            // argument is still processing
        }

        return idx;
    }


}

export default XParser
