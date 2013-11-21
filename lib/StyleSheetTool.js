

/**
 * 读取并解析样式表文件   
 * @return {CSSStyleSheet} 
 * @example
 * CSSStyleSheet: {
 *  cssRules: [
 *      { // CSSStyleDeclaration
 *         selectorText: "img",
 *         style: {
 *             0: "border",
 *             length: 1,
 *              border: "none"
 *          }
 *      }
 *   ]
 *  } 
 */
function readStyleSheet(fileName) {

    fileName = path.join(spriteConfig.workspace, fileName);
    if(!fs.existsSync(fileName)){
        return null;
    }
    var content = fs.readFileSync(fileName);
    var styleSheet = CSSOM.parse(content.toString());
    return styleSheet;
};